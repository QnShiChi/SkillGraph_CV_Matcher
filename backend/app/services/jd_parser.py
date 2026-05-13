from __future__ import annotations

import json
import re
from collections import OrderedDict
from typing import Any

from app.services.jd_llm_schema import JDLLMParseResult, JDLLMSkill, JDLLMTextItem
from app.services.openrouter_client import OpenRouterClient
from app.services.skill_taxonomy import SKILL_ALIAS_INDEX, SKILL_TAXONOMY, SkillCategory


SECTION_ALIASES = {
    "summary": ["overview", "summary", "about the role", "role overview", "job summary"],
    "responsibilities": [
        "responsibilities",
        "key responsibilities",
        "what you will do",
        "what you'll do",
    ],
    "qualifications": [
        "qualifications",
        "requirements",
        "required qualifications",
        "required skills and qualifications",
    ],
    "required_skills": [
        "required skills",
        "technical skills",
        "must have",
    ],
    "preferred_skills": [
        "preferred skills",
        "preferred qualifications",
        "nice to have",
        "bonus",
        "plus",
    ],
}

GROUP_ORDER: list[SkillCategory] = [
    "technical_skills",
    "platforms_cloud",
    "tooling_devops",
    "competencies",
    "role_descriptors",
    "soft_skills",
]
TEXT_GROUP_ORDER: list[SkillCategory] = [
    "technical_skills",
    "platforms_cloud",
    "tooling_devops",
    "competencies",
]

CONTEXTUAL_COMPETENCY_CANONICALS = {
    "code_reviews",
    "architectural_planning",
    "performance_optimization",
    "software_development_lifecycle",
}


def parse_jd_text(raw_text: str) -> dict[str, Any]:
    context = _build_rule_based_context(raw_text)
    description = _build_description(context["sections"])
    flat_skills = _extract_skills(context["sections"])
    grouped_skills = _group_skills(flat_skills)
    return _assemble_result(
        title=context["title"],
        description=description,
        grouped_skills=grouped_skills,
        sections=context["sections"],
        raw_text=context["cleaned"],
        soft_skills=[],
        language_requirements=[],
        experience_years=_extract_experience_years(context["cleaned"]),
        parse_source="rule_based",
        parse_confidence=_compute_rule_based_confidence(
            description=description,
            grouped_skills=grouped_skills,
            sections=context["sections"],
        ),
    )


def parse_jd_text_hybrid(
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

    llm_sections = _build_sections_from_llm(llm_payload)
    llm_grouped_skills = _normalize_llm_grouped_skills(llm_payload)
    rule_based_grouped_skills = _group_skills(_extract_skills(context["sections"]))
    grouped_skills = _merge_grouped_skills(llm_grouped_skills, rule_based_grouped_skills)
    description = llm_payload.summary or _build_description(llm_sections) or _build_description(
        context["sections"]
    )
    experience_years = llm_payload.experience_years or _extract_experience_years(context["cleaned"])

    return _assemble_result(
        title=llm_payload.title or context["title"],
        description=description,
        grouped_skills=grouped_skills,
        sections=llm_sections,
        raw_text=context["cleaned"],
        soft_skills=llm_payload.soft_skills,
        language_requirements=llm_payload.language_requirements,
        experience_years=experience_years,
        parse_source="llm_hybrid",
        parse_confidence=_compute_hybrid_confidence(
            llm_confidence=llm_payload.parser_confidence,
            description=description,
            grouped_skills=grouped_skills,
            sections=llm_sections,
        ),
    )


def _build_rule_based_context(raw_text: str) -> dict[str, Any]:
    cleaned = _clean_text(raw_text)
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    if not lines:
        raise ValueError("Unable to extract readable text from JD.")

    return {
        "cleaned": cleaned,
        "lines": lines,
        "title": _extract_title(lines),
        "sections": _extract_sections(lines),
    }


def _assemble_result(
    *,
    title: str,
    description: str | None,
    grouped_skills: dict[SkillCategory, list[dict[str, Any]]],
    sections: dict[str, list[str]],
    raw_text: str,
    soft_skills: list[str],
    language_requirements: list[str],
    experience_years: int | None,
    parse_source: str,
    parse_confidence: float,
) -> dict[str, Any]:
    flat_skills = _flatten_grouped_skills(grouped_skills)
    return {
        "title": title,
        "description": description,
        "required_skills_text": _build_required_skills_text(grouped_skills),
        "responsibilities_text": _join_items(sections.get("responsibilities", [])),
        "qualifications_text": _join_items(sections.get("qualifications", [])),
        "raw_jd_text": raw_text,
        "parse_source": parse_source,
        "parse_confidence": parse_confidence,
        "structured_jd_json": {
            "title": title,
            "summary": description,
            "required_skills": flat_skills,
            "technical_skills": grouped_skills["technical_skills"],
            "platforms_cloud": grouped_skills["platforms_cloud"],
            "tooling_devops": grouped_skills["tooling_devops"],
            "competencies": grouped_skills["competencies"],
            "role_descriptors": grouped_skills["role_descriptors"],
            "responsibilities": [
                {
                    "text": item,
                    "section_origin": "responsibilities",
                    "confidence": 0.75,
                }
                for item in sections.get("responsibilities", [])
            ],
            "qualifications": [
                {
                    "text": item,
                    "section_origin": "qualifications",
                    "confidence": 0.85,
                }
                for item in sections.get("qualifications", [])
            ],
            "skill_groups": sorted(
                {
                    group
                    for category in GROUP_ORDER
                    for skill in grouped_skills[category]
                    for group in skill["skill_groups"]
                }
            ),
            "soft_skills": soft_skills,
            "language_requirements": language_requirements,
            "experience_years": experience_years,
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
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned


def _extract_title(lines: list[str]) -> str:
    for line in lines[:6]:
        normalized = line.lower().strip(" :")
        if normalized in {"about the job", "overview", "summary", "responsibilities", "requirements"}:
            continue
        if normalized.startswith("job title:"):
            return line.split(":", 1)[1].strip()
        if len(line) >= 3:
            return line
    return lines[0]


def _extract_sections(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {name: [] for name in SECTION_ALIASES}
    current_section = "summary"
    started_content = False

    for line in lines[1:]:
        section_name = _match_section_heading(line)
        if section_name:
            current_section = section_name
            started_content = True
            continue

        if not started_content:
            current_section = "summary"

        cleaned_line = re.sub(r"^[\-\u2022]\s*", "", line).strip()
        if cleaned_line:
            sections.setdefault(current_section, []).append(cleaned_line)

    return sections


def _match_section_heading(line: str) -> str | None:
    normalized = line.lower().strip(" :")
    for canonical, aliases in SECTION_ALIASES.items():
        if normalized in aliases:
            return canonical
    return None


def _build_description(sections: dict[str, list[str]]) -> str | None:
    for key in ("summary", "responsibilities"):
        items = sections.get(key, [])
        if items:
            return " ".join(items)
    return None


def _join_items(items: list[str]) -> str | None:
    if not items:
        return None
    return "\n".join(items)


def _extract_experience_years(text: str) -> int | None:
    match = re.search(r"(\d+)\+?\s+years?", text, flags=re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def _extract_skills(sections: dict[str, list[str]]) -> list[dict[str, Any]]:
    matches: "OrderedDict[str, dict[str, Any]]" = OrderedDict()
    section_order = [
        ("required_skills", "must_have", 5, 0.95),
        ("preferred_skills", "nice_to_have", 3, 0.85),
        ("qualifications", "must_have", 4, 0.85),
        ("responsibilities", "contextual", 3, 0.75),
        ("summary", "contextual", 2, 0.6),
    ]

    for section_name, requirement_type, importance, confidence in section_order:
        section_items = sections.get(section_name, [])
        section_text = "\n".join(section_items).lower()

        for alias, canonical in SKILL_ALIAS_INDEX.items():
            if not _contains_alias(section_text, alias):
                continue

            record = _build_skill_record(
                canonical=canonical,
                display_name=SKILL_TAXONOMY[canonical]["display_name"],
                aliases=SKILL_TAXONOMY[canonical]["aliases"],
                section_origin=section_name,
                confidence=confidence,
                importance=importance,
                requirement_type=requirement_type,
                source="exact_match" if alias == canonical else "alias_match",
            )
            existing = matches.get(canonical)
            if existing is None or record["importance"] > existing["importance"]:
                matches[canonical] = record
            elif existing is not None:
                matches[canonical] = _merge_skill_record(existing, record)

    return list(matches.values())


def _contains_alias(text: str, alias: str) -> bool:
    pattern = re.compile(rf"(?<!\w){re.escape(alias.lower())}(?!\w)")
    return bool(pattern.search(text))


def _build_llm_prompts(context: dict[str, Any]) -> tuple[str, str]:
    section_hints = json.dumps(context["sections"], ensure_ascii=True, indent=2)
    system_prompt = (
        "You are an expert HR and technical recruiting analyst. "
        "Return only valid JSON matching the requested schema. "
        "Separate technical skills from cloud/platforms, tooling/devops, competencies, "
        "role descriptors, and soft skills. "
        "Do not invent prerequisites or graph relations."
    )
    user_prompt = f"""
Parse the following job description into strict JSON.

Required JSON shape:
{{
  "title": "string",
  "summary": "string or null",
  "technical_skills": [{{"name":"string","importance":1-5,"requirement_type":"must_have|nice_to_have|contextual","section_origin":"required_skills|preferred_skills|qualifications|responsibilities|summary","confidence":0.0-1.0,"aliases":["string"]}}],
  "platforms_cloud": [{{"name":"string","importance":1-5,"requirement_type":"must_have|nice_to_have|contextual","section_origin":"required_skills|preferred_skills|qualifications|responsibilities|summary","confidence":0.0-1.0,"aliases":["string"]}}],
  "tooling_devops": [{{"name":"string","importance":1-5,"requirement_type":"must_have|nice_to_have|contextual","section_origin":"required_skills|preferred_skills|qualifications|responsibilities|summary","confidence":0.0-1.0,"aliases":["string"]}}],
  "competencies": [{{"name":"string","importance":1-5,"requirement_type":"must_have|nice_to_have|contextual","section_origin":"required_skills|preferred_skills|qualifications|responsibilities|summary","confidence":0.0-1.0,"aliases":["string"]}}],
  "role_descriptors": [{{"name":"string","importance":1-5,"requirement_type":"must_have|nice_to_have|contextual","section_origin":"required_skills|preferred_skills|qualifications|responsibilities|summary","confidence":0.0-1.0,"aliases":["string"]}}],
  "soft_skills": ["string"],
  "responsibilities": ["string"] or [{{"text":"string","confidence":0.0-1.0}}],
  "qualifications": ["string"] or [{{"text":"string","confidence":0.0-1.0}}],
  "language_requirements": ["string"],
  "experience_years": integer or null,
  "parser_confidence": 0.0-1.0 or null
}}

Rules:
- Put programming languages, frameworks, databases, and mobile platforms in technical_skills.
- Put AWS, GCP, Azure, and similar providers in platforms_cloud.
- Put Docker, CI/CD, Git, version control, and containerization in tooling_devops.
- Put software development, full-stack development, scalable systems, and agile environment items in competencies.
- Put remote collaboration, distributed work, and cross-functional context in role_descriptors.
- Do not place soft skills into technical_skills.
- Do not invent prerequisites or related skills.

Use these rule-based section hints as weak guidance:
{section_hints}

Raw JD text:
{context["cleaned"]}
""".strip()
    return system_prompt, user_prompt


def _call_and_validate_llm(
    *,
    client: OpenRouterClient,
    system_prompt: str,
    user_prompt: str,
) -> JDLLMParseResult:
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


def _parse_llm_payload(response_text: str) -> JDLLMParseResult:
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    payload = json.loads(cleaned)
    return JDLLMParseResult.model_validate(payload)


def _build_sections_from_llm(payload: JDLLMParseResult) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {name: [] for name in SECTION_ALIASES}
    if payload.summary:
        sections["summary"] = [payload.summary]
    sections["responsibilities"] = _normalize_text_items(payload.responsibilities)
    sections["qualifications"] = _normalize_text_items(payload.qualifications)

    for group_name, group_items in _llm_group_collections(payload).items():
        for skill in group_items:
            target = "preferred_skills" if (skill.requirement_type or "must_have") == "nice_to_have" else "required_skills"
            sections[target].append(skill.name)
            if group_name == "role_descriptors" and target == "required_skills":
                sections["summary"].append(skill.name)

    return sections


def _normalize_text_items(items: list[JDLLMTextItem | str]) -> list[str]:
    normalized: list[str] = []
    for item in items:
        if isinstance(item, str):
            value = item.strip()
        else:
            value = item.text.strip()
        if value:
            normalized.append(value)
    return normalized


def _normalize_llm_grouped_skills(
    payload: JDLLMParseResult,
) -> dict[SkillCategory, list[dict[str, Any]]]:
    grouped = _empty_grouped_skills()
    for declared_group, skills in _llm_group_collections(payload).items():
        for item in skills:
            record = _normalize_llm_skill(item)
            target_group = _resolve_skill_group(record, declared_group)
            grouped[target_group].append(_apply_group_policy(record, target_group))
    return _deduplicate_grouped_skills(grouped)


def _llm_group_collections(payload: JDLLMParseResult) -> dict[SkillCategory, list[JDLLMSkill]]:
    return {
        "technical_skills": payload.technical_skills,
        "platforms_cloud": payload.platforms_cloud,
        "tooling_devops": payload.tooling_devops,
        "competencies": payload.competencies,
        "role_descriptors": payload.role_descriptors,
        "soft_skills": [],
    }


def _normalize_llm_skill(item: JDLLMSkill) -> dict[str, Any]:
    canonical = _canonicalize_skill(item.name)
    taxonomy = SKILL_TAXONOMY.get(canonical)
    return _build_skill_record(
        canonical=canonical,
        display_name=taxonomy["display_name"] if taxonomy else item.name.strip(),
        aliases=taxonomy["aliases"] if taxonomy else list(dict.fromkeys([item.name, *item.aliases])),
        section_origin=item.section_origin or "required_skills",
        confidence=_bound_confidence(item.confidence or 0.88),
        importance=_normalize_importance(item.importance),
        requirement_type=_normalize_requirement_type(item.requirement_type),
        source="llm_structured",
    )


def _build_skill_record(
    *,
    canonical: str,
    display_name: str,
    aliases: list[str],
    section_origin: str,
    confidence: float,
    importance: int,
    requirement_type: str,
    source: str,
) -> dict[str, Any]:
    meta = SKILL_TAXONOMY.get(canonical)
    classification_target = meta["classification_target"] if meta else _infer_fallback_group(display_name)
    record = {
        "name": display_name,
        "canonical": canonical,
        "source": source,
        "section_origin": section_origin,
        "aliases": aliases,
        "confidence": confidence,
        "importance": importance,
        "requirement_type": requirement_type,
        "skill_groups": meta["skill_groups"] if meta else [],
        "prerequisites": meta["prerequisites"] if meta else [],
        "related_skills": meta["related_skills"] if meta else [],
        "specializations": meta["specializations"] if meta else [],
        "classification_target": classification_target,
    }
    return _apply_group_policy(record, classification_target)


def _group_skills(skills: list[dict[str, Any]]) -> dict[SkillCategory, list[dict[str, Any]]]:
    grouped = _empty_grouped_skills()
    for skill in skills:
        group = skill["classification_target"]
        grouped[group].append(_apply_group_policy(skill, group))
    return _deduplicate_grouped_skills(grouped)


def _empty_grouped_skills() -> dict[SkillCategory, list[dict[str, Any]]]:
    return {group: [] for group in GROUP_ORDER}


def _resolve_skill_group(skill: dict[str, Any], declared_group: SkillCategory) -> SkillCategory:
    taxonomy = SKILL_TAXONOMY.get(skill["canonical"])
    if taxonomy:
        return taxonomy["classification_target"]
    return declared_group


def _deduplicate_grouped_skills(
    grouped: dict[SkillCategory, list[dict[str, Any]]],
) -> dict[SkillCategory, list[dict[str, Any]]]:
    canonical_to_group: dict[str, SkillCategory] = {}
    canonical_to_record: dict[str, dict[str, Any]] = {}

    for group in GROUP_ORDER:
        for skill in grouped[group]:
            existing_group = canonical_to_group.get(skill["canonical"])
            if existing_group is None:
                canonical_to_group[skill["canonical"]] = group
                canonical_to_record[skill["canonical"]] = skill
                continue

            if GROUP_ORDER.index(group) < GROUP_ORDER.index(existing_group):
                canonical_to_group[skill["canonical"]] = group
                canonical_to_record[skill["canonical"]] = _merge_skill_record(
                    canonical_to_record[skill["canonical"]],
                    skill,
                )
            else:
                canonical_to_record[skill["canonical"]] = _merge_skill_record(
                    canonical_to_record[skill["canonical"]],
                    skill,
                )

    deduped = _empty_grouped_skills()
    for canonical, group in canonical_to_group.items():
        deduped[group].append(canonical_to_record[canonical])
    return deduped


def _merge_grouped_skills(
    left: dict[SkillCategory, list[dict[str, Any]]],
    right: dict[SkillCategory, list[dict[str, Any]]],
) -> dict[SkillCategory, list[dict[str, Any]]]:
    merged = _empty_grouped_skills()
    for group in GROUP_ORDER:
        merged[group] = [*left[group], *right[group]]
    return _deduplicate_grouped_skills(merged)


def _merge_skill_record(existing: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    return {
        **existing,
        "confidence": max(existing["confidence"], new["confidence"]),
        "importance": max(existing["importance"], new["importance"]),
        "requirement_type": (
            existing["requirement_type"]
            if existing["importance"] >= new["importance"]
            else new["requirement_type"]
        ),
        "section_origin": (
            existing["section_origin"]
            if existing["importance"] >= new["importance"]
            else new["section_origin"]
        ),
        "skill_groups": sorted(set(existing["skill_groups"]) | set(new["skill_groups"])),
        "prerequisites": sorted(set(existing["prerequisites"]) | set(new["prerequisites"])),
        "related_skills": sorted(set(existing["related_skills"]) | set(new["related_skills"])),
        "specializations": sorted(set(existing["specializations"]) | set(new["specializations"])),
    }


def _flatten_grouped_skills(grouped: dict[SkillCategory, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    flat: list[dict[str, Any]] = []
    for group in TEXT_GROUP_ORDER:
        flat.extend(grouped[group])
    return flat


def _build_required_skills_text(grouped: dict[SkillCategory, list[dict[str, Any]]]) -> str | None:
    names: list[str] = []
    seen: set[str] = set()
    for group in TEXT_GROUP_ORDER:
        for skill in grouped[group]:
            if skill["canonical"] in seen:
                continue
            seen.add(skill["canonical"])
            names.append(skill["name"])
    return _join_items(names)


def _apply_group_policy(skill: dict[str, Any], group: SkillCategory) -> dict[str, Any]:
    skill = {**skill}
    if group not in {"technical_skills", "tooling_devops", "platforms_cloud"}:
        skill["prerequisites"] = []
        skill["related_skills"] = []
    if group == "competencies" and skill["canonical"] in CONTEXTUAL_COMPETENCY_CANONICALS:
        skill["requirement_type"] = "contextual"
        skill["importance"] = min(skill["importance"], 3)
    if group == "role_descriptors":
        skill["requirement_type"] = "contextual"
        skill["importance"] = min(skill["importance"], 3)
    return {**skill, "classification_target": group}


def _canonicalize_skill(name: str) -> str:
    normalized = name.strip().lower()
    return SKILL_ALIAS_INDEX.get(normalized, _slugify_skill_name(normalized))


def _slugify_skill_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name).strip("_")


def _normalize_importance(value: int | None) -> int:
    if value is None:
        return 3
    return max(1, min(5, value))


def _normalize_requirement_type(value: str | None) -> str:
    if value in {"must_have", "nice_to_have", "contextual"}:
        return value
    return "must_have"


def _infer_fallback_group(name: str) -> SkillCategory:
    normalized = name.lower()
    if any(token in normalized for token in ["aws", "gcp", "azure", "cloud"]):
        return "platforms_cloud"
    if any(token in normalized for token in ["docker", "container", "ci/cd", "ci cd", "version control", "git", "devops"]):
        return "tooling_devops"
    if any(token in normalized for token in ["communication", "ownership", "problem-solving", "problem solving", "detail", "professionalism"]):
        return "soft_skills"
    if any(token in normalized for token in ["remote", "distributed", "cross-functional", "cross functional"]):
        return "role_descriptors"
    if any(token in normalized for token in ["development", "systems", "agile", "tooling"]):
        return "competencies"
    return "technical_skills"


def _compute_rule_based_confidence(
    *,
    description: str | None,
    grouped_skills: dict[SkillCategory, list[dict[str, Any]]],
    sections: dict[str, list[str]],
) -> float:
    score = 0.45
    if description:
        score += 0.1
    technical_count = len(grouped_skills["technical_skills"])
    if technical_count:
        score += 0.15
    if sections.get("responsibilities"):
        score += 0.07
    if sections.get("qualifications"):
        score += 0.07
    score += min(technical_count, 5) * 0.03
    return round(min(score, 0.84), 2)


def _compute_hybrid_confidence(
    *,
    llm_confidence: float | None,
    description: str | None,
    grouped_skills: dict[SkillCategory, list[dict[str, Any]]],
    sections: dict[str, list[str]],
) -> float:
    score = 0.55
    if description:
        score += 0.08
    if sections.get("responsibilities"):
        score += 0.06
    if sections.get("qualifications"):
        score += 0.05
    flat_skills = _flatten_grouped_skills(grouped_skills)
    if flat_skills:
        score += 0.08
        known = sum(1 for skill in flat_skills if skill["skill_groups"])
        score += min(known / max(len(flat_skills), 1), 1.0) * 0.08
    if llm_confidence is not None:
        score += _bound_confidence(llm_confidence) * 0.1
    return round(min(score, 0.99), 2)


def _bound_confidence(value: float) -> float:
    return max(0.0, min(1.0, value))
