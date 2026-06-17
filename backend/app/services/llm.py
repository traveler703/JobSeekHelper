import json
import re
from typing import Any

from openai import OpenAI

from app.config import settings

_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        if not settings.deepseek_api_key:
            raise RuntimeError("未配置 DEEPSEEK_API_KEY")
        _client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url.rstrip("/"),
        )
    return _client


def chat(
    messages: list[dict[str, str]],
    temperature: float = 0.4,
    response_format_json: bool = False,
) -> str:
    kwargs: dict[str, Any] = {
        "model": settings.llm_model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format_json:
        kwargs["response_format"] = {"type": "json_object"}
    resp = get_client().chat.completions.create(**kwargs)
    return (resp.choices[0].message.content or "").strip()


def parse_json_loose(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            return json.loads(m.group())
        raise


def resume_parse_prompt(raw_text: str) -> dict[str, Any]:
    system = (
        "你是简历解析助手。根据用户提供的简历全文，提取结构化信息。"
        "必须输出合法 JSON，除下列 resume_form 外，可保留 basic_info 等兼容字段。\n"
        "resume_form 结构：\n"
        "personal: full_name, gender, birth_ym(YYYY-MM), phone, email\n"
        "education: 数组，每项 school, major, level(大专|本科|硕士|博士|博士后之一), start_ym, end_ym\n"
        "projects: 数组，每项 name, start_ym, end_ym, role, summary, work\n"
        "internships: 数组，每项 company, position, start_ym, end_ym, work\n"
        "awards: 数组，每项 name, level, award_ym(YYYY-MM)\n"
        "languages: 数组，每项 lang, proficiency(入门|日常沟通|专业沟通|精通掌握之一)\n"
        "skills: 数组，每项 name, level(文字描述掌握程度)\n"
        "未知项用空字符串或空数组。日期尽量规范为 YYYY-MM。"
        "另可输出 education/projects 等顶层键（与旧版兼容），系统会合并。"
    )
    user = f"简历全文如下：\n\n{raw_text[:12000]}"
    out = chat(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
        response_format_json=True,
    )
    return parse_json_loose(out)
