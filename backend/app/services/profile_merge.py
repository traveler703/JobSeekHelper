import json
from typing import Any


def merge_profile(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
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
