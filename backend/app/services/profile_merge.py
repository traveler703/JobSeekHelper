import json
from typing import Any


_DEFAULT_ONLY_VALUES = {"本科", "日常沟通"}


def _has_meaningful_value(value: Any) -> bool:
    if isinstance(value, dict):
        return any(_has_meaningful_value(v) for v in value.values())
    if isinstance(value, list):
        return any(_has_meaningful_value(v) for v in value)
    text = str(value or "").strip()
    return bool(text) and text not in _DEFAULT_ONLY_VALUES


def _non_empty_items(items: list[Any]) -> list[Any]:
    return [item for item in items if _has_meaningful_value(item)]


def normalize_profile_structure(profile: dict[str, Any]) -> dict[str, Any]:
    """Keep legacy parser output usable by the current resume form UI."""
    out = dict(profile)
    rf = out.get("resume_form")
    resume_form: dict[str, Any] = dict(rf) if isinstance(rf, dict) else {}

    personal = out.get("personal")
    basic = out.get("basic_info")
    if isinstance(personal, dict):
        base = resume_form.get("personal") if isinstance(resume_form.get("personal"), dict) else {}
        resume_form["personal"] = {**base, **personal}
    elif isinstance(basic, dict):
        base = resume_form.get("personal") if isinstance(resume_form.get("personal"), dict) else {}
        resume_form["personal"] = {
            **base,
            "full_name": basic.get("full_name") or basic.get("name") or base.get("full_name", ""),
            "gender": basic.get("gender") or base.get("gender", ""),
            "birth_ym": basic.get("birth_ym") or base.get("birth_ym", ""),
            "phone": basic.get("phone") or basic.get("tel") or base.get("phone", ""),
            "email": basic.get("email") or base.get("email", ""),
        }

    for key in ("education", "projects", "internships", "awards", "languages", "skills"):
        value = out.get(key)
        if isinstance(value, list) and key not in resume_form:
            resume_form[key] = _non_empty_items(value)

    if resume_form:
        for key in ("education", "projects", "internships", "awards", "languages", "skills"):
            value = resume_form.get(key)
            if isinstance(value, list):
                resume_form[key] = _non_empty_items(value)
        out["resume_form"] = resume_form
    return out


def merge_profile(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    old = normalize_profile_structure(old)
    new = normalize_profile_structure(new)
    out = dict(old)
    list_keys = {
        "projects",
        "internships",
        "education",
        "awards",
        "languages",
        "skills",
    }
    for k, v in new.items():
        if k == "resume_form" and isinstance(v, dict):
            prev = out.get("resume_form")
            prev_d: dict[str, Any] = prev if isinstance(prev, dict) else {}
            merged_rf = dict(prev_d)
            for sub_k, sub_v in v.items():
                if sub_k in list_keys and isinstance(sub_v, list):
                    ex = merged_rf.get(sub_k) or []
                    if not isinstance(ex, list):
                        ex = []
                    ex = _non_empty_items(ex)
                    sub_v = _non_empty_items(sub_v)
                    seen = {
                        json.dumps(x, sort_keys=True) if isinstance(x, dict) else str(x)
                        for x in ex
                    }
                    m = list(ex)
                    for item in sub_v:
                        key = (
                            json.dumps(item, sort_keys=True)
                            if isinstance(item, dict)
                            else str(item)
                        )
                        if key not in seen:
                            m.append(item)
                            seen.add(key)
                    merged_rf[sub_k] = m
                elif sub_k == "personal" and isinstance(sub_v, dict):
                    base = (
                        merged_rf.get("personal")
                        if isinstance(merged_rf.get("personal"), dict)
                        else {}
                    )
                    merged_rf["personal"] = {**base, **sub_v}
                elif isinstance(sub_v, dict) and isinstance(merged_rf.get(sub_k), dict):
                    merged_rf[sub_k] = {**merged_rf[sub_k], **sub_v}
                else:
                    merged_rf[sub_k] = sub_v
            out["resume_form"] = merged_rf
        elif k in list_keys and isinstance(v, list):
            existing = out.get(k) or []
            if not isinstance(existing, list):
                existing = []
            existing = _non_empty_items(existing)
            v = _non_empty_items(v)
            seen = {
                json.dumps(x, sort_keys=True) if isinstance(x, dict) else str(x)
                for x in existing
            }
            merged = list(existing)
            for item in v:
                key = (
                    json.dumps(item, sort_keys=True)
                    if isinstance(item, dict)
                    else str(item)
                )
                if key not in seen:
                    merged.append(item)
                    seen.add(key)
            out[k] = merged
        elif k == "basic_info" and isinstance(v, dict):
            base = out.get("basic_info") if isinstance(out.get("basic_info"), dict) else {}
            out["basic_info"] = {**base, **v}
        elif isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = {**out[k], **v}
        else:
            out[k] = v
    return out
