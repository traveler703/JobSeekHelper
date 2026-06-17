import json
import re
from datetime import datetime, timezone
from typing import Any

from app.constants import JOB_ROLE_NAMES
from app.services import llm
from app.services.rag import retrieve
from app.services.speech import summarize_fluency_metrics


def _user_answer_text(transcript: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for m in transcript:
        if m.get("role") == "user":
            parts.append((m.get("content") or "").strip())
    return "\n".join(parts)


def _llm_user_answer_has_substance(raw: str) -> bool:
    """用语义模型区分「有实质内容」与「仅套话/语气词/空泛承接」（如「这个问题我是这么理解的」）。"""
    system = (
        "你是面试作答判别器。输入为候选人在整场面试中所有「用户」发言的汇总（可能多段，换行分隔）。\n"
        "请你 mentally 去掉：纯语气词与填充词、无信息寒暄；以及仅起承接作用、不包含具体信息的套话，例如："
        "「这个问题我是这么理解的」「我是这么理解的」「让我想想」「关于这个问题」「我的理解是」"
        "「怎么说呢」「怎么说呢我觉得」「我来说说」等后面没有紧跟实质内容的情况。\n"
        "若去掉上述无效部分后，仍残留对题目的具体观点、步骤、经历、技术点、数据、结论等可评价信息，则 meaningful 为 true；"
        "若几乎只剩套话、语气词、空泛表态或完全未展开，则 meaningful 为 false。\n"
        "不要臆测候选人未写出的内容；只根据已出现的文字判断。\n"
        "只输出一个 JSON 对象，键仅含 meaningful（布尔值），不要 Markdown 或其它说明。"
    )
    user = f"候选人作答汇总：\n{raw[:8000]}"
    out = llm.chat(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.05,
        response_format_json=True,
    )
    data = llm.parse_json_loose(out)
    if "meaningful" not in data:
        return True
    return bool(data["meaningful"])


def _has_meaningful_user_answer(transcript: list[dict[str, Any]]) -> bool:
    """先快速排除明显无效文本，再调用 LLM 做语义级「是否有实质作答」判定。"""
    raw = _user_answer_text(transcript)
    t = re.sub(r"\s+", "", raw)
    if len(t) < 2:
        return False
    if re.fullmatch(r"(?:[嗯啊哦呃诶额哈呀呐吧\.。,，、;；:!？…\-—_])+", t):
        return False
    try:
        return _llm_user_answer_has_substance(raw)
    except Exception:
        # API 未配置、超时或 JSON 异常时：不因判别失败阻断面试，退回「有内容即认为可能有效」
        return True


def _empty_interview_evaluation() -> dict[str, Any]:
    return {
        "overall": "未获取到用户有意义的回答",
        "knowledge_score": 0,
        "project_depth_score": 0,
        "fluency_score": 0,
        "fluency_analysis": "未获取到有效回答，无法分析首词反应、卡顿与熟练程度。",
        "strengths": [],
        "gaps": [],
        "rag_alignment": "面试记录中无有效候选人作答；评价未结合简历或其它外部资料。",
        "suggestions": [],
    }


def _profile_summary(profile: dict[str, Any]) -> str:
    try:
        return json.dumps(profile, ensure_ascii=False)[:8000]
    except Exception:
        return "{}"


def interview_turn(
    *,
    profile: dict[str, Any],
    job_role: str,
    user_id: int,
    transcript: list[dict[str, Any]],
    started_at: datetime,
    target_company: str = "",
    target_position: str = "",
) -> dict[str, Any]:
    role_name = JOB_ROLE_NAMES.get(job_role, job_role)
    now = datetime.now(timezone.utc)
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    elapsed = (now - started_at).total_seconds() / 60.0

    last = transcript[-1] if transcript else None
    if last and last.get("role") == "user":
        user_answer = (last.get("content") or "").strip()
        prior = transcript[:-1]
    else:
        user_answer = None
        prior = transcript

    rag_query = f"{target_position or role_name} 面试 {role_name}"
    if user_answer:
        rag_query += " " + user_answer[:400]
    rag_hits = retrieve(user_id, rag_query, n_results=5)
    rag_text = "\n".join(
        f"[资料{i+1}] {h['text'][:600]}" for i, h in enumerate(rag_hits)
    )

    history_lines: list[str] = []
    for m in prior[-24:]:
        role = m.get("role", "")
        content = (m.get("content") or "").strip()
        if content:
            history_lines.append(f"{role}: {content}")

    system = (
        "你是资深面试官，进行中文模拟技术/行为面试。"
        "你需要结合岗位特点、候选人简历与参考资料提问。"
        "每次只输出一个 JSON 对象，不要 Markdown，不要多余说明。"
        '格式：{"action":"continue"|"end","question":"","end_reason":"","should_end":false}。\n'
        "规则：\n"
        "1. action=continue 时必须提供 question（下一道题）。\n"
        "2. 题目应覆盖：岗位通用考点（可参考参考资料）、候选人项目/实习细节。\n"
        "3. 当面试已进行超过 40 分钟且已覆盖大部分重要知识点时，可将 should_end 设为 true；"
        "或你认为已充分考察时也可结束。\n"
        f"4. 当前已进行约 {elapsed:.1f} 分钟。\n"
        "5. action=end 时填写 end_reason（如 coverage、time），question 可为空。\n"
        "6. 若候选人已回答上一题，应先简要回应再进入下一题（continue 时 question 为下一题）。"
        "7. 若尚无候选人回答（面试刚开始），直接给出第一道正式题目，不要冗长寒暄。"
    )

    user_parts = [
        f"候选人目标公司：{target_company or '（未填写）'}",
        f"候选人目标岗位：{target_position or '（未填写）'}",
        f"岗位类型参考：{role_name}（内部标识 {job_role}）",
        f"候选人简历摘要：{_profile_summary(profile)}",
    ]
    if rag_text:
        user_parts.append(f"参考资料（RAG）：\n{rag_text}")
    else:
        user_parts.append("参考资料：暂无上传文档，请结合岗位常识与简历提问。")
    if history_lines:
        user_parts.append("对话历史：\n" + "\n".join(history_lines))
    if user_answer is not None:
        user_parts.append(f"候选人最新回答：\n{user_answer}")

    raw = llm.chat(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": "\n\n".join(user_parts)},
        ],
        temperature=0.45,
        response_format_json=True,
    )
    data = llm.parse_json_loose(raw)
    action = data.get("action") or "continue"
    question = (data.get("question") or "").strip()
    should_end = bool(data.get("should_end"))
    end_reason = (data.get("end_reason") or "").strip()

    if action == "end" or should_end or elapsed >= 42:
        return {
            "kind": "end",
            "question": question or None,
            "end_reason": end_reason or ("time" if elapsed >= 40 else "llm"),
        }

    if not question:
        question = "请简要介绍一个你负责过的项目：背景、你的职责、技术难点与结果。"
    return {"kind": "continue", "question": question}


def evaluate_interview(
    *,
    profile: dict[str, Any],
    job_role: str,
    user_id: int,
    transcript: list[dict[str, Any]],
    target_company: str = "",
    target_position: str = "",
) -> dict[str, Any]:
    _ = profile, user_id  # 保留签名；评价不引用简历或检索资料
    role_name = JOB_ROLE_NAMES.get(job_role, job_role)
    if not _has_meaningful_user_answer(transcript):
        return _empty_interview_evaluation()

    lines = []
    for m in transcript:
        line = f"{m.get('role')}: {m.get('content', '')}"
        metrics = m.get("answer_metrics")
        if m.get("role") == "user" and isinstance(metrics, dict):
            line += f"\nanswer_metrics: {json.dumps(metrics, ensure_ascii=False)}"
        lines.append(line)
    joined = "\n".join(lines)[:12000]
    fluency_summary = summarize_fluency_metrics(transcript)

    system = (
        "你是面试评估专家。你只能根据下面「面试记录」里候选人（role 为 user）的发言进行评价与打分，"
        "禁止依据简历、上传资料、岗位常识或对话外的任何信息推断候选人是否掌握某知识点；"
        "不得在候选人未明确提及某内容时，声称其掌握或不懂。\n"
        "你还会收到 answer_metrics 或「回答熟练度统计」。这些统计只用于评价表达熟练程度，"
        "包括首个核心词出现时间、中间卡壳时间、语气/填充词比例、核心语速；不得用它们替代知识正确性判断。\n"
        "若面试官（assistant）提出某问题后，记录中无对应的 user 发言，须在 gaps 中写明「未作答」，"
        "不得根据题目或岗位臆测候选人会如何回答。\n"
        "输出结构化评价（中文 JSON）。\n"
        "键：overall（总评）, strengths（仅来自 user 发言中可核实的亮点）, "
        "gaps（不足与改进建议；含未答题）, knowledge_score（1-10）, project_depth_score（1-10）, "
        "fluency_score（1-10，依据 answer_metrics 评价熟练程度）, fluency_analysis（说明首词反应、卡顿与填充词情况）, "
        "rag_alignment（简短说明：本条评价依据了哪些 user 原话，并声明未使用简历或其它外部资料）, "
        "suggestions（可操作的后续学习建议）。\n"
        "若 user 有效内容很少，评分须明显偏低，overall 须如实说明依据不足。"
    )
    user = (
        f"目标公司：{target_company or '（未填写）'}\n"
        f"目标岗位：{target_position or '（未填写）'}\n"
        f"岗位类型参考：{role_name}\n\n"
        "面试记录（仅可引用其中 user 发言作为评价依据）：\n"
        f"{joined}\n\n"
        f"回答熟练度统计：\n{fluency_summary or '暂无'}"
    )
    raw = llm.chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.3,
        response_format_json=True,
    )
    return llm.parse_json_loose(raw)
