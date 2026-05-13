from __future__ import annotations

import json
import re
from typing import Any

from app.services.cv_llm_schema import (
    CVLLMEvidenceItem,
    CVLLMParseResult,
    CVLLMSkill,
    CVLLMTextItem,
)
from app.services.openrouter_client import OpenRouterClient
from app.services.skill_taxonomy import SKILL_ALIAS_INDEX, SKILL_TAXONOMY, SkillCategory


SECTION_ALIASES = {
    "summary": ["summary", "profile", "about"],
    "experience": ["experience", "work experience", "professional experience"],
    "education": ["education"],
    "skills": ["skills", "technical skills", "core skills"],
}

GROUP_ORDER: list[SkillCategory] = [
    "technical_skills",
    "platforms_cloud",
    "tooling_devops",
    "competencies",
    "role_descriptors",
    "soft_skills",
]

GRAPH_SAFE_GROUPS: list[SkillCategory] = [
    "technical_skills",
    "platforms_cloud",
    "tooling_devops",
]

SOFT_SKILL_PATTERNS = {
    "communication": ["communication", "communicate"],
    "problem-solving": ["problem-solving", "problem solving"],
    "collaboration": ["collaboration", "collaborative", "collaborate"],
    "leadership": ["leadership", "lead"],
}


def parse_cv_text(raw_text: str) -> dict[str, Any]:
    context = _build_rule_based_context(raw_text)
    grouped_skills = _extract_grouped_skills(context["sections"])
    summary = _build_summary(context["sections"])
    soft_skills = _extract_soft_skills(context["cleaned"])
    return _assemble_result(
        full_name=context["full_name"],
        email=context["email"],
        summary=summary,
        grouped_skills=grouped_skills,
        soft_skills=soft_skills,
        experience_items=context["sections"].get("experience", []),
        education_items=context["sections"].get("education", []),
        language_requirements=[],
        raw_text=context["cleaned"],
        parse_source="rule_based",
        parse_confidence=_compute_confidence(
            grouped_skills=grouped_skills,
            sections=context["sections"],
        ),
    )


def parse_cv_text_hybrid(
    raw_text: str,
    *,
    client: OpenRouterClient,
) -> dict[str, Any]:
    context = _build_rule_based_context(raw_text)
    system_prompt, user_prompt = _build_llm_prompts(context)
    llm_payload = _call_and_validate_llm(
        client=client,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
    )

    llm_grouped_skills = _normalize_llm_grouped_skills(llm_payload)
    rule_based_grouped_skills = _extract_grouped_skills(context["sections"])
    grouped_skills = _merge_grouped_skills(llm_grouped_skills, rule_based_grouped_skills)
    soft_skills = _merge_soft_skills(llm_payload.soft_skills, _extract_soft_skills(context["cleaned"]))
    summary = llm_payload.summary or _build_summary(context["sections"])

    return _assemble_result(
        full_name=llm_payload.full_name or context["full_name"],
        email=context["email"],
        summary=summary,
        grouped_skills=grouped_skills,
        soft_skills=soft_skills,
        experience_items=_normalize_text_items(llm_payload.experience) or context["sections"].get("experience", []),
        education_items=_normalize_text_items(llm_payload.education) or context["sections"].get("education", []),
        language_requirements=llm_payload.language_requirements,
        raw_text=context["cleaned"],
        parse_source="llm_hybrid",
        parse_confidence=_compute_hybrid_confidence(
            llm_confidence=llm_payload.parser_confidence,
            grouped_skills=grouped_skills,
            sections=context["sections"],
        ),
    )


def _build_rule_based_context(raw_text: str) -> dict[str, Any]:
    cleaned = _clean_text(raw_text)
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    if not lines:
        raise ValueError("Unable to extract readable text from CV.")

    return {
        "cleaned": cleaned,
        "lines": lines,
        "full_name": lines[0],
        "email": _extract_email(cleaned),
        "sections": _extract_sections(lines),
    }


def _assemble_result(
    *,
    full_name: str,
    email: str | None,
    summary: str | None,
    grouped_skills: dict[SkillCategory, list[dict[str, Any]]],
    soft_skills: list[str],
    experience_items: list[str],
    education_items: list[str],
    language_requirements: list[str],
    raw_text: str,
    parse_source: str,
    parse_confidence: float,
) -> dict[str, Any]:
    return {
        "full_name": full_name,
        "email": email,
        "summary": summary,
        "resume_text": raw_text,
        "skills_text": _build_skills_text(grouped_skills),
        "parse_source": parse_source,
        "parse_confidence": parse_confidence,
        "structured_cv_json": {
            "summary": summary,
            "technical_skills": grouped_skills["technical_skills"],
            "platforms_cloud": grouped_skills["platforms_cloud"],
            "tooling_devops": grouped_skills["tooling_devops"],
            "competencies": grouped_skills["competencies"],
            "soft_skills": soft_skills,
            "experience": [{"text": item} for item in experience_items],
            "education": [{"text": item} for item in education_items],
            "language_requirements": language_requirements,
        },
    }


def _clean_text(raw_text: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in raw_text.splitlines()]
    kept_lines: list[str] = []
    for line in lines:
        if not line:
            if kept_lines and kept_lines[-1] != "":
                kept_lines.append("")
            continue
        kept_lines.append(line)
    cleaned = "\n".join(kept_lines).strip()
    return re.sub(r"\n{3,}", "\n\n", cleaned)


def _extract_sections(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {name: [] for name in SECTION_ALIASES}
    current_section = "summary"
    for line in lines[1:]:
        section_name = _match_section_heading(line)
        if section_name:
            current_section = section_name
            continue
        cleaned_line = re.sub(r"^[\-\u2022]\s*", "", line).strip()
        if cleaned_line:
            sections[current_section].append(cleaned_line)
    return sections


def _match_section_heading(line: str) -> str | None:
    normalized = line.lower().strip(" :")
    for name, aliases in SECTION_ALIASES.items():
        if normalized in aliases:
            return name
    return None


def _build_summary(sections: dict[str, list[str]]) -> str | None:
    for key in ("summary", "experience"):
        if sections.get(key):
            return " ".join(sections[key][:3])
    return None


def _extract_email(text: str) -> str | None:
    match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, flags=re.IGNORECASE)
    return match.group(0) if match else None


def _extract_grouped_skills(sections: dict[str, list[str]]) -> dict[SkillCategory, list[dict[str, Any]]]:
    grouped = _empty_grouped_skills()
    seen: dict[str, dict[str, Any]] = {}

    section_order = [
        ("skills", 0.95),
        ("experience", 0.9),
        ("summary", 0.8),
        ("education", 0.6),
    ]

    for section_name, confidence in section_order:
        section_items = sections.get(section_name, [])
        section_text = "\n".join(section_items).lower()
        for alias, canonical in SKILL_ALIAS_INDEX.items():
            if not _contains_alias(section_text, alias):
                continue
            meta = SKILL_TAXONOMY.get(canonical)
            if not meta:
                continue
            group = meta["classification_target"]
            if group == "role_descriptors":
                continue
            evidence = _build_evidence(section_items, alias, section_name, confidence)
            record = {
                "name": meta["display_name"],
                "canonical": canonical,
                "source": "exact_match" if alias == canonical else "alias_match",
                "section_origin": section_name,
                "aliases": meta["aliases"],
                "confidence": confidence,
                "skill_groups": meta["skill_groups"],
                "prerequisites": meta["prerequisites"] if group in GRAPH_SAFE_GROUPS else [],
                "related_skills": meta["related_skills"] if group in GRAPH_SAFE_GROUPS else [],
                "specializations": meta["specializations"],
                "classification_target": group,
                "evidence": evidence,
            }
            existing = seen.get(canonical)
            if existing is None:
                seen[canonical] = record
            else:
                existing["confidence"] = max(existing["confidence"], record["confidence"])
                existing["evidence"].extend(record["evidence"])
                existing["evidence"] = _dedupe_evidence(existing["evidence"])

    for record in seen.values():
        grouped[record["classification_target"]].append(record)
    return _deduplicate_grouped_skills(grouped)


def _contains_alias(text: str, alias: str) -> bool:
    pattern = re.compile(rf"(?<!\w){re.escape(alias.lower())}(?!\w)")
    return bool(pattern.search(text))


def _build_evidence(
    section_items: list[str],
    alias: str,
    section_origin: str,
    confidence: float,
) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    for item in section_items:
        if _contains_alias(item.lower(), alias.lower()):
            evidence.append(
                {
                    "text": item,
                    "section_origin": section_origin,
                    "confidence": confidence,
                }
            )
    return evidence or [
        {
            "text": alias,
            "section_origin": section_origin,
            "confidence": confidence,
        }
    ]


def _dedupe_evidence(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str]] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        key = (item["text"], item["section_origin"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _extract_soft_skills(text: str) -> list[str]:
    lowered = text.lower()
    detected: list[str] = []
    for label, patterns in SOFT_SKILL_PATTERNS.items():
        if any(pattern in lowered for pattern in patterns):
            detected.append(label.title())
    return detected


def _build_skills_text(grouped_skills: dict[SkillCategory, list[dict[str, Any]]]) -> str | None:
    names: list[str] = []
    seen: set[str] = set()
    for group in GRAPH_SAFE_GROUPS + ["competencies"]:
        for skill in grouped_skills[group]:
            if skill["canonical"] in seen:
                continue
            seen.add(skill["canonical"])
            names.append(skill["name"])
    return "\n".join(names) if names else None


def _compute_confidence(
    *,
    grouped_skills: dict[SkillCategory, list[dict[str, Any]]],
    sections: dict[str, list[str]],
) -> float:
    score = 0.45
    graph_safe_count = sum(len(grouped_skills[group]) for group in GRAPH_SAFE_GROUPS)
    if sections.get("summary"):
        score += 0.1
    if sections.get("experience"):
        score += 0.15
    if sections.get("skills"):
        score += 0.15
    score += min(graph_safe_count, 6) * 0.04
    return round(min(score, 0.92), 2)


def _compute_hybrid_confidence(
    *,
    llm_confidence: float | None,
    grouped_skills: dict[SkillCategory, list[dict[str, Any]]],
    sections: dict[str, list[str]],
) -> float:
    baseline = _compute_confidence(grouped_skills=grouped_skills, sections=sections)
    if llm_confidence is None:
        return round(min(baseline + 0.04, 0.95), 2)
    blended = (baseline * 0.45) + (_bound_confidence(llm_confidence) * 0.55)
    return round(min(blended, 0.97), 2)


def _build_llm_prompts(context: dict[str, Any]) -> tuple[str, str]:
    section_hints = json.dumps(context["sections"], ensure_ascii=True, indent=2)
    system_prompt = (
        "You are an expert technical recruiter and resume analyst. "
        "Return only valid JSON matching the requested schema. "
        "Extract graph-safe technical skills separately from platforms/cloud, tooling/devops, "
        "competencies, and soft skills. "
        "Do not invent prerequisites or graph relations."
    )
    user_prompt = f"""
Parse the following CV into strict JSON.

Required JSON shape:
{{
  "full_name": "string or null",
  "summary": "string or null",
  "technical_skills": [{{"name":"string","section_origin":"summary|experience|education|skills","confidence":0.0-1.0,"aliases":["string"],"evidence":["string"] or [{{"text":"string","section_origin":"summary|experience|education|skills","confidence":0.0-1.0}}]}}],
  "platforms_cloud": [{{"name":"string","section_origin":"summary|experience|education|skills","confidence":0.0-1.0,"aliases":["string"],"evidence":["string"] or [{{"text":"string","section_origin":"summary|experience|education|skills","confidence":0.0-1.0}}]}}],
  "tooling_devops": [{{"name":"string","section_origin":"summary|experience|education|skills","confidence":0.0-1.0,"aliases":["string"],"evidence":["string"] or [{{"text":"string","section_origin":"summary|experience|education|skills","confidence":0.0-1.0}}]}}],
  "competencies": [{{"name":"string","section_origin":"summary|experience|education|skills","confidence":0.0-1.0,"aliases":["string"],"evidence":["string"] or [{{"text":"string","section_origin":"summary|experience|education|skills","confidence":0.0-1.0}}]}}],
  "soft_skills": ["string"],
  "experience": ["string"] or [{{"text":"string","confidence":0.0-1.0}}],
  "education": ["string"] or [{{"text":"string","confidence":0.0-1.0}}],
  "language_requirements": ["string"],
  "parser_confidence": 0.0-1.0 or null
}}

Rules:
- Put programming languages, frameworks, databases, mobile platforms, and core AI/ML technologies in technical_skills.
- Put AWS, GCP, Azure, and similar providers in platforms_cloud.
- Put Docker, Git, CI/CD, version control, containerization, and MLOps tooling in tooling_devops.
- Put software engineering scope, domain competency, and delivery capability in competencies.
- Keep soft skills out of technical_skills.
- Provide short evidence snippets for each extracted skill when possible.
- Do not invent prerequisites or graph relations.

Use these local section hints as weak guidance:
{section_hints}

Raw CV text:
{context["cleaned"]}
""".strip()
    return system_prompt, user_prompt


def _call_and_validate_llm(
    *,
    client: OpenRouterClient,
    system_prompt: str,
    user_prompt: str,
) -> CVLLMParseResult:
    response_text = client.create_chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
    )
    try:
        return _parse_llm_payload(response_text)
    except ValueError:
        repair_prompt = (
            "The previous response was invalid. Return only valid JSON that matches the schema. "
            f"Original response:\n{response_text}"
        )
        repaired = client.create_chat_completion(
            system_prompt=system_prompt,
            user_prompt=repair_prompt,
        )
        return _parse_llm_payload(repaired)


def _parse_llm_payload(response_text: str) -> CVLLMParseResult:
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    payload = json.loads(cleaned)
    return CVLLMParseResult.model_validate(payload)


def _normalize_text_items(items: list[CVLLMTextItem | str]) -> list[str]:
    normalized: list[str] = []
    for item in items:
        value = item if isinstance(item, str) else item.text
        value = value.strip()
        if value:
            normalized.append(value)
    return normalized


def _normalize_llm_grouped_skills(
    payload: CVLLMParseResult,
) -> dict[SkillCategory, list[dict[str, Any]]]:
    grouped = _empty_grouped_skills()
    for declared_group, skills in _llm_group_collections(payload).items():
        for item in skills:
            record = _normalize_llm_skill(item, declared_group)
            grouped[record["classification_target"]].append(record)
    return _deduplicate_grouped_skills(grouped)


def _llm_group_collections(payload: CVLLMParseResult) -> dict[SkillCategory, list[CVLLMSkill]]:
    return {
        "technical_skills": payload.technical_skills,
        "platforms_cloud": payload.platforms_cloud,
        "tooling_devops": payload.tooling_devops,
        "competencies": payload.competencies,
        "role_descriptors": [],
        "soft_skills": [],
    }


def _normalize_llm_skill(
    item: CVLLMSkill,
    declared_group: SkillCategory,
) -> dict[str, Any]:
    canonical = _canonicalize_skill(item.name)
    meta = SKILL_TAXONOMY.get(canonical)
    classification_target = (
        meta["classification_target"]
        if meta and meta["classification_target"] != "role_descriptors"
        else declared_group
    )
    if classification_target == "role_descriptors":
        classification_target = "competencies"
    evidence = _normalize_llm_evidence(
        item.evidence,
        skill_name=item.name,
        section_origin=item.section_origin or "experience",
        confidence=item.confidence,
    )
    return {
        "name": meta["display_name"] if meta else item.name.strip(),
        "canonical": canonical,
        "source": "llm_structured",
        "section_origin": item.section_origin or "experience",
        "aliases": meta["aliases"] if meta else list(dict.fromkeys([item.name, *item.aliases])),
        "confidence": _bound_confidence(item.confidence or 0.9),
        "skill_groups": meta["skill_groups"] if meta else [],
        "prerequisites": meta["prerequisites"] if meta and classification_target in GRAPH_SAFE_GROUPS else [],
        "related_skills": meta["related_skills"] if meta and classification_target in GRAPH_SAFE_GROUPS else [],
        "specializations": meta["specializations"] if meta else [],
        "classification_target": classification_target,
        "evidence": evidence,
    }


def _normalize_llm_evidence(
    items: list[CVLLMEvidenceItem | str],
    *,
    skill_name: str,
    section_origin: str,
    confidence: float | None,
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in items:
        if isinstance(item, str):
            text = item.strip()
            current_origin = section_origin
            current_confidence = _bound_confidence(confidence or 0.9)
        else:
            text = item.text.strip()
            current_origin = item.section_origin or section_origin
            current_confidence = _bound_confidence(item.confidence or confidence or 0.9)
        if text:
            normalized.append(
                {
                    "text": text,
                    "section_origin": current_origin,
                    "confidence": current_confidence,
                }
            )
    if not normalized:
        normalized.append(
            {
                "text": skill_name.strip(),
                "section_origin": section_origin,
                "confidence": _bound_confidence(confidence or 0.9),
            }
        )
    return _dedupe_evidence(normalized)


def _canonicalize_skill(value: str) -> str:
    slug = value.strip().lower()
    if slug in SKILL_TAXONOMY:
        return slug
    return SKILL_ALIAS_INDEX.get(slug, re.sub(r"[^a-z0-9]+", "_", slug).strip("_"))


def _merge_grouped_skills(
    primary: dict[SkillCategory, list[dict[str, Any]]],
    fallback: dict[SkillCategory, list[dict[str, Any]]],
) -> dict[SkillCategory, list[dict[str, Any]]]:
    grouped = _empty_grouped_skills()
    for group in grouped:
        merged: dict[str, dict[str, Any]] = {}
        for source_group in (primary[group], fallback[group]):
            for item in source_group:
                existing = merged.get(item["canonical"])
                if existing is None:
                    merged[item["canonical"]] = dict(item)
                    continue
                existing["confidence"] = max(existing["confidence"], item["confidence"])
                existing["evidence"] = _dedupe_evidence(existing["evidence"] + item["evidence"])
                existing["section_origin"] = existing["section_origin"] or item["section_origin"]
                if existing["source"] != "llm_structured":
                    existing["source"] = item["source"]
        grouped[group] = list(merged.values())
    return _deduplicate_grouped_skills(grouped)


def _merge_soft_skills(primary: list[str], fallback: list[str]) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for item in [*primary, *fallback]:
        normalized = item.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        merged.append(normalized)
    return merged


def _empty_grouped_skills() -> dict[SkillCategory, list[dict[str, Any]]]:
    return {group: [] for group in GROUP_ORDER}


def _deduplicate_grouped_skills(
    grouped: dict[SkillCategory, list[dict[str, Any]]],
) -> dict[SkillCategory, list[dict[str, Any]]]:
    deduped = _empty_grouped_skills()
    for group, items in grouped.items():
        seen: dict[str, dict[str, Any]] = {}
        for item in items:
            existing = seen.get(item["canonical"])
            if existing is None:
                seen[item["canonical"]] = dict(item)
                continue
            existing["confidence"] = max(existing["confidence"], item["confidence"])
            existing["evidence"] = _dedupe_evidence(existing["evidence"] + item["evidence"])
        deduped[group] = list(seen.values())
    return deduped


def _bound_confidence(value: float) -> float:
    return max(0.0, min(round(value, 2), 1.0))
