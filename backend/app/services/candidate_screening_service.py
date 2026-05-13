from __future__ import annotations

import re
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.candidate import Candidate
from app.repositories.candidate_repository import list_candidates_for_job
from app.repositories.job_repository import get_job_by_id
from app.services.agentscope_runner import run_agentscope_candidate_review


URL_PATTERN = re.compile(r"https?://[^\s<>()\"]+")
WORD_PATTERN = re.compile(r"[a-zA-Z][a-zA-Z0-9_+#.-]{2,}")
PROJECT_DOMAINS = {
    "github.com",
    "www.github.com",
    "gitlab.com",
    "www.gitlab.com",
    "bitbucket.org",
    "www.bitbucket.org",
    "devpost.com",
    "www.devpost.com",
    "netlify.app",
    "vercel.app",
}
CLAIM_STOPWORDS = {
    "https",
    "http",
    "github",
    "portfolio",
    "project",
    "projects",
    "repository",
    "repo",
    "website",
    "site",
    "application",
    "built",
    "using",
    "with",
    "developer",
    "developers",
    "fullstack",
    "full",
    "stack",
    "backend",
    "frontend",
}


def screen_and_rank_job_candidates(
    session: Session,
    *,
    job_id: int,
    settings: Settings | None = None,
) -> dict:
    resolved_settings = settings or get_settings()
    job = get_job_by_id(session, job_id)
    if job is None:
        raise ValueError("Job not found.")

    candidates = list_candidates_for_job(session, job_id)
    ranked_candidates: list[Candidate] = []
    rejected_candidates: list[Candidate] = []

    for candidate in candidates:
        verification = _verify_candidate(candidate)
        _apply_verification(candidate, verification)
        if verification["screening_decision"] == "reject":
            candidate.match_score = None
            candidate.match_rank = None
            candidate.match_summary = None
            candidate.final_report_json = {
                "decision": "reject",
                "reason": verification["screening_reason"],
            }
            rejected_candidates.append(candidate)
            continue

        match_payload = _score_candidate(job.structured_jd_json or {}, candidate)
        verified_links = candidate.verified_links_json or []
        if resolved_settings.matching_review_mode == "agentscope":
            agentscope_payload = run_agentscope_candidate_review(
                payload={
                    "job": job.structured_jd_json or {},
                    "candidate": candidate.structured_cv_json or {},
                    "candidate_name": candidate.full_name,
                    "deterministic_score": match_payload["match_score"],
                    "deterministic_summary": match_payload["match_summary"],
                    "verified_links": verified_links,
                },
                settings=resolved_settings,
            )
            match_payload.update(
                {
                    "match_summary": agentscope_payload.get(
                        "match_summary",
                        match_payload["match_summary"],
                    ),
                    "final_report_json": agentscope_payload.get(
                        "final_report_json",
                        match_payload["final_report_json"],
                    ),
                }
            )
        candidate.match_score = match_payload["match_score"]
        candidate.match_summary = match_payload["match_summary"]
        candidate.final_report_json = match_payload["final_report_json"]
        ranked_candidates.append(candidate)

    ranked_candidates.sort(
        key=lambda candidate: (
            -(candidate.match_score or 0.0),
            candidate.full_name.lower(),
        )
    )
    for index, candidate in enumerate(ranked_candidates, start=1):
        candidate.match_rank = index

    rejected_candidates.sort(key=lambda candidate: candidate.full_name.lower())
    session.add_all(candidates)
    session.commit()
    for candidate in candidates:
        session.refresh(candidate)

    return {
        "total_candidates": len(candidates),
        "ranked_count": len(ranked_candidates),
        "rejected_count": len(rejected_candidates),
        "ranked_candidates": ranked_candidates,
        "rejected_candidates": rejected_candidates,
    }


def get_job_candidate_ranking(session: Session, *, job_id: int) -> dict:
    job = get_job_by_id(session, job_id)
    if job is None:
        raise ValueError("Job not found.")

    candidates = list_candidates_for_job(session, job_id)
    ranked_candidates = sorted(
        [candidate for candidate in candidates if candidate.screening_decision == "pass"],
        key=lambda candidate: (
            candidate.match_rank is None,
            candidate.match_rank if candidate.match_rank is not None else 10**9,
            -(candidate.match_score or 0.0),
            candidate.full_name.lower(),
        ),
    )
    rejected_candidates = sorted(
        [candidate for candidate in candidates if candidate.screening_decision == "reject"],
        key=lambda candidate: candidate.full_name.lower(),
    )
    return {
        "total_candidates": len(candidates),
        "ranked_count": len(ranked_candidates),
        "rejected_count": len(rejected_candidates),
        "ranked_candidates": ranked_candidates,
        "rejected_candidates": rejected_candidates,
    }


def _apply_verification(candidate: Candidate, verification: dict) -> None:
    candidate.verification_status = verification["verification_status"]
    candidate.verification_score = verification["verification_score"]
    candidate.verification_summary = verification["verification_summary"]
    candidate.verified_links_json = verification["verified_links_json"]
    candidate.screening_decision = verification["screening_decision"]
    candidate.screening_reason = verification["screening_reason"]


def _verify_candidate(candidate: Candidate) -> dict:
    resume_text = candidate.resume_text or ""
    urls = _extract_urls(resume_text)
    project_urls = [url for url in urls if _is_project_like_url(url)]
    if not project_urls:
        return {
            "verification_status": "missing_evidence",
            "verification_score": 0.0,
            "verification_summary": "No project, GitHub, or portfolio link was found in the CV text.",
            "verified_links_json": [],
            "screening_decision": "reject",
            "screening_reason": "Missing project evidence links.",
        }

    claim_map = _extract_project_claims(resume_text, project_urls)
    verified_links: list[dict] = []
    failed_links: list[dict] = []
    for url in project_urls:
        probe = _probe_link(url)
        if probe["reachable"]:
            fetched = _fetch_link_content(probe["final_url"])
            evaluated = _evaluate_project_link_claim(
                probe=probe,
                fetched=fetched,
                claim=claim_map.get(url) or {},
            )
            verified_links.append(evaluated)
        else:
            failed_links.append(probe)

    matched_links = [
        item for item in verified_links if item.get("claim_match_status") == "matched"
    ]

    if not verified_links:
        return {
            "verification_status": "invalid_link",
            "verification_score": 10.0,
            "verification_summary": "Project links were found but none could be reached successfully.",
            "verified_links_json": failed_links,
            "screening_decision": "reject",
            "screening_reason": "Project links are invalid or unreachable.",
        }

    if not matched_links:
        return {
            "verification_status": "weak_evidence",
            "verification_score": 25.0,
            "verification_summary": "Project links are reachable, but their content does not clearly support the project claims written in the CV.",
            "verified_links_json": verified_links,
            "screening_decision": "reject",
            "screening_reason": "Project links do not clearly match the project claims in the CV.",
        }

    github_bonus = 10.0 if any("github.com" in item["final_url"] for item in matched_links) else 0.0
    score = min(100.0, 70.0 + github_bonus + (min(len(verified_links), 2) * 10.0))
    return {
        "verification_status": "verified",
        "verification_score": score,
        "verification_summary": f"Verified {len(matched_links)} project link(s) whose content aligns with the project claims in the CV.",
        "verified_links_json": verified_links,
        "screening_decision": "pass",
        "screening_reason": None,
    }


def _extract_urls(text: str) -> list[str]:
    return list(dict.fromkeys(match.rstrip(".,)") for match in URL_PATTERN.findall(text)))


def _is_project_like_url(url: str) -> bool:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if host in PROJECT_DOMAINS:
        return True
    if host == "linkedin.com" or host == "www.linkedin.com":
        return False
    return bool(host) and parsed.path not in {"", "/"}


def _probe_link(url: str, timeout_seconds: int = 5) -> dict:
    try:
        with httpx.Client(timeout=timeout_seconds, follow_redirects=True) as client:
            response = client.get(url)
            reachable = response.status_code < 400
            final_url = str(response.url)
            status_code = response.status_code
    except httpx.HTTPError as error:
        return {
            "url": url,
            "reachable": False,
            "status_code": None,
            "final_url": url,
            "reason": str(error),
        }

    return {
        "url": url,
        "reachable": reachable,
        "status_code": status_code,
        "final_url": final_url,
        "reason": None if reachable else f"HTTP {status_code}",
    }


def _fetch_link_content(url: str, timeout_seconds: int = 5) -> dict:
    try:
        with httpx.Client(timeout=timeout_seconds, follow_redirects=True) as client:
            response = client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as error:
        return {
            "url": url,
            "reachable": False,
            "title": None,
            "content": "",
            "reason": str(error),
        }

    body = response.text or ""
    title_match = re.search(r"<title[^>]*>(.*?)</title>", body, flags=re.IGNORECASE | re.DOTALL)
    title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else None
    plain_text = re.sub(r"(?is)<script.*?>.*?</script>", " ", body)
    plain_text = re.sub(r"(?is)<style.*?>.*?</style>", " ", plain_text)
    plain_text = re.sub(r"(?s)<[^>]+>", " ", plain_text)
    plain_text = re.sub(r"\s+", " ", plain_text).strip()
    return {
        "url": url,
        "reachable": True,
        "title": title,
        "content": plain_text[:6000],
        "reason": None,
    }


def _extract_project_claims(text: str, urls: list[str]) -> dict[str, dict]:
    lines = [line.strip() for line in text.splitlines()]
    claims: dict[str, dict] = {}
    for url in urls:
        line_indexes = [index for index, line in enumerate(lines) if url in line]
        if not line_indexes:
            claims[url] = {"claim_text": "", "claim_title": None, "claim_keywords": []}
            continue

        index = line_indexes[0]
        claim_lines: list[str] = []
        for offset in range(max(0, index - 6), min(len(lines), index + 3)):
            line = lines[offset].strip()
            if not line:
                continue
            if url in line:
                line = line.replace(url, " ").strip(" :-")
            if line:
                claim_lines.append(line)

        claim_title = None
        for candidate_line in reversed(claim_lines[:3]):
            if len(candidate_line.split()) <= 8:
                claim_title = candidate_line
                break
        claim_text = " ".join(claim_lines).strip()
        claim_keywords = _extract_keywords(
            " ".join(part for part in [claim_title or "", claim_text] if part)
        )
        if not claim_keywords:
            claim_keywords = _extract_keywords(_slug_tokens(url))
        claims[url] = {
            "claim_text": claim_text,
            "claim_title": claim_title,
            "claim_keywords": claim_keywords,
        }
    return claims


def _evaluate_project_link_claim(*, probe: dict, fetched: dict, claim: dict) -> dict:
    combined_text = " ".join(
        part for part in [fetched.get("title") or "", fetched.get("content") or "", _slug_tokens(probe["final_url"])] if part
    ).lower()
    claim_keywords = claim.get("claim_keywords") or []
    matched_terms = sorted(
        {
            keyword
            for keyword in claim_keywords
            if keyword in combined_text
        }
    )
    denominator = max(len(claim_keywords), 1)
    score = round((len(matched_terms) / denominator) * 100, 2)
    match_threshold = 2 if len(claim_keywords) >= 3 else 1
    claim_match_status = "matched" if len(matched_terms) >= match_threshold else "mismatch"

    mismatch_notes = None
    if claim_match_status == "mismatch":
        mismatch_notes = "The reachable link content does not clearly reflect the project title, stack, or features described in the CV."

    return {
        **probe,
        "claim_title": claim.get("claim_title"),
        "claim_text": claim.get("claim_text"),
        "claim_keywords": claim_keywords,
        "fetched_title": fetched.get("title"),
        "fetched_excerpt": (fetched.get("content") or "")[:280],
        "claim_match_status": claim_match_status,
        "claim_match_score": score,
        "matched_terms": matched_terms,
        "mismatch_notes": mismatch_notes,
    }


def _extract_keywords(text: str) -> list[str]:
    seen: set[str] = set()
    keywords: list[str] = []
    for match in WORD_PATTERN.findall(text.lower()):
        token = match.strip("._-+#")
        if len(token) < 4 or token in CLAIM_STOPWORDS:
            continue
        if token in seen:
            continue
        seen.add(token)
        keywords.append(token)
    return keywords[:12]


def _slug_tokens(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.replace("/", " ").replace("-", " ").replace("_", " ").replace(".", " ")
    return f"{parsed.netloc} {path}".strip()


def _score_candidate(job_payload: dict, candidate: Candidate) -> dict:
    candidate_payload = candidate.structured_cv_json or {}
    required_skills = _collect_skill_names(job_payload, ("required_skills",))
    must_have_skills = {
        skill["canonical"]
        for skill in job_payload.get("required_skills", [])
        if isinstance(skill, dict) and skill.get("canonical") and skill.get("requirement_type") == "must_have"
    }
    if not must_have_skills:
        must_have_skills = _collect_skill_names(job_payload, ("technical_skills",))

    job_skills = _collect_skill_names(
        job_payload,
        ("technical_skills", "platforms_cloud", "tooling_devops"),
    )
    candidate_skills = _collect_skill_names(
        candidate_payload,
        ("technical_skills", "platforms_cloud", "tooling_devops"),
    )
    matched_required = job_skills & candidate_skills
    missing_required = sorted(job_skills - candidate_skills)
    matched_must_have = must_have_skills & candidate_skills

    must_have_score = len(matched_must_have) / len(must_have_skills) if must_have_skills else 1.0
    overlap_score = len(matched_required) / len(job_skills) if job_skills else 0.0
    verified_links = candidate.verified_links_json or []
    project_score = min(len(verified_links), 2) / 2 if verified_links else 0.0
    experience_score = 1.0 if candidate_payload.get("experience") else 0.4
    evidence_items = _count_evidence_items(candidate_payload)
    evidence_score = min(evidence_items / max(len(candidate_skills), 1), 1.0) if candidate_skills else 0.0

    overall_score = round(
        (
            (must_have_score * 0.35)
            + (project_score * 0.25)
            + (overlap_score * 0.20)
            + (experience_score * 0.10)
            + (evidence_score * 0.10)
        )
        * 100,
        2,
    )

    strengths = sorted(matched_required)
    gaps = missing_required
    return {
        "match_score": overall_score,
        "match_summary": (
            f"Matched {len(matched_required)}/{len(job_skills) or 0} job skills and "
            f"{len(matched_must_have)}/{len(must_have_skills) or 0} must-have skills."
        ),
        "final_report_json": {
            "strengths": strengths,
            "gaps": gaps,
            "verified_links": verified_links,
            "explanation": (
                f"{candidate.full_name} passed verification and matched {len(strengths)} core skill(s)."
            ),
            "critic_review": "Deterministic workflow output reviewed for evidence consistency.",
        },
    }


def _collect_skill_names(payload: dict, groups: tuple[str, ...]) -> set[str]:
    names: set[str] = set()
    for group in groups:
        for skill in payload.get(group, []):
            if not isinstance(skill, dict):
                continue
            canonical = skill.get("canonical")
            if isinstance(canonical, str) and canonical:
                names.add(canonical)
    return names


def _count_evidence_items(payload: dict) -> int:
    count = 0
    for group in ("technical_skills", "platforms_cloud", "tooling_devops"):
        for skill in payload.get(group, []):
            if isinstance(skill, dict):
                evidence = skill.get("evidence")
                if isinstance(evidence, list):
                    count += len(evidence)
    return count
