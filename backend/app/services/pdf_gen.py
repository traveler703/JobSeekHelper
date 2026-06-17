import html
import json
import re
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

from app.config import settings
from app.services import llm

_pdfmetrics_registered = False


def _ensure_cjk_font() -> str:
    global _pdfmetrics_registered
    name = "STSong-Light"
    if not _pdfmetrics_registered:
        pdfmetrics.registerFont(UnicodeCIDFont(name))
        _pdfmetrics_registered = True
    return name


def _profile_to_text(profile: dict[str, Any]) -> str:
    return json.dumps(profile, ensure_ascii=False, indent=2)


def _extract_contact(profile: dict[str, Any]) -> str:
    rf = profile.get("resume_form")
    if isinstance(rf, dict):
        p = rf.get("personal")
        if isinstance(p, dict):
            candidates = [
                p.get("full_name"),
                p.get("phone"),
                p.get("email"),
            ]
            contact = " / ".join([str(v).strip() for v in candidates if v])
            if contact:
                return contact[:120]
    candidates = [
        profile.get("name"),
        profile.get("email"),
        profile.get("phone"),
        profile.get("city"),
    ]
    contact = " / ".join([str(v).strip() for v in candidates if v])
    return contact[:120] if contact else "求职者信息"


def _normalize_line(raw: str) -> str:
    return raw.strip().lstrip("-•·").strip()


def _is_heading(line: str) -> bool:
    if not line:
        return False
    key = _normalize_line(line).replace("：", "").replace(":", "")
    known = {
        "个人信息",
        "教育背景",
        "专业技能",
        "技能",
        "项目经历",
        "工作经历",
        "实习经历",
        "校园经历",
        "获奖经历",
        "证书",
        "个人优势",
        "其他",
    }
    if key in known:
        return True
    return bool(re.fullmatch(r"[一二三四五六七八九十0-9]+[、.]\s*[\u4e00-\u9fa5A-Za-z]{2,20}", line))


def _looks_like_bullet(line: str) -> bool:
    if not line:
        return False
    return bool(re.match(r"^([-•·]|\d+[.)、])\s*", line))


def _split_resume_blocks(text: str) -> list[tuple[str, str]]:
    lines = [ln.rstrip() for ln in text.splitlines()]
    sections: list[tuple[str, list[str]]] = []
    current_title = "简历正文"
    current_lines: list[str] = []

    for raw in lines:
        line = raw.strip()
        if not line:
            if current_lines and current_lines[-1] != "":
                current_lines.append("")
            continue
        if _is_heading(line):
            if current_lines:
                sections.append((current_title, current_lines))
            current_title = _normalize_line(line).replace("：", "").replace(":", "")
            current_lines = []
            continue
        current_lines.append(line)

    if current_lines:
        sections.append((current_title, current_lines))

    normalized: list[tuple[str, str]] = []
    for title, section_lines in sections:
        content = "\n".join(section_lines).strip()
        if content:
            normalized.append((title, content))
    if not normalized:
        normalized.append(("简历正文", text.strip()))
    return normalized


def generate_resume_pdf(
    profile: dict[str, Any],
    job_role: str,
    target_company: str,
    target_position: str,
    job_role_name: str,
) -> bytes:
    md = llm.chat(
        [
            {
                "role": "system",
                "content": (
                    "你是专业简历撰写助手。根据用户档案 JSON、目标公司与目标岗位，"
                    "生成一份针对性强、与岗位高度匹配、排版层次清晰的简历正文（中文）。"
                    "不建议直接照抄用户档案 JSON 中的内容，而应当根据目标公司和岗位重新组织调整语言，突出用户在这方面的能力素质。"
                    "突出与该公司该岗位相关的项目与实习经历，用要点描述职责与成果。"
                    "输出纯文本分段：个人信息、教育背景、技能、项目经历、实习/工作、其他。"
                    "不要使用 Markdown 标题符号。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"目标公司：{target_company or '未指定'}\n"
                    f"投递岗位：{target_position}（{job_role_name}，内部标识 {job_role}）\n\n"
                    f"用户档案：\n{_profile_to_text(profile)}"
                ),
            },
        ],
        temperature=0.35,
    )

    font_name = _ensure_cjk_font()
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleCJK",
        parent=styles["Title"],
        fontName=font_name,
        fontSize=19,
        leading=24,
        alignment=1,
    )
    meta_style = ParagraphStyle(
        "MetaCJK",
        parent=styles["BodyText"],
        fontName=font_name,
        fontSize=9.5,
        textColor=HexColor("#4B5563"),
        alignment=1,
        leading=13,
    )
    sec_title_style = ParagraphStyle(
        "SectionTitleCJK",
        parent=styles["Heading3"],
        fontName=font_name,
        fontSize=12.5,
        leading=18,
        textColor=HexColor("#1E3A8A"),
        spaceBefore=4,
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        "BodyCJK",
        parent=styles["BodyText"],
        fontName=font_name,
        fontSize=10.5,
        leading=16,
    )
    bullet_style = ParagraphStyle(
        "BulletCJK",
        parent=body_style,
        leftIndent=12,
        bulletIndent=2,
    )

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    story: list = []
    title_main = f"{target_position} - 简历"
    if (target_company or "").strip():
        title_main = f"{target_company.strip()} · {title_main}"
    story.append(Paragraph(html.escape(title_main), title_style))
    story.append(Spacer(1, 0.12 * cm))
    story.append(Paragraph(html.escape(_extract_contact(profile)), meta_style))
    story.append(Spacer(1, 0.24 * cm))
    story.append(
        HRFlowable(
            width="100%",
            thickness=0.8,
            lineCap="round",
            color=HexColor("#93C5FD"),
            spaceBefore=0,
            spaceAfter=0,
        )
    )
    story.append(Spacer(1, 0.4 * cm))

    for sec_title, sec_body in _split_resume_blocks(md):
        story.append(Paragraph(html.escape(sec_title), sec_title_style))
        for ln in sec_body.split("\n"):
            line = ln.strip()
            if not line:
                story.append(Spacer(1, 0.08 * cm))
                continue
            normalized = _normalize_line(line)
            if _looks_like_bullet(line):
                story.append(Paragraph(html.escape(normalized), bullet_style, bulletText="•"))
            else:
                story.append(Paragraph(html.escape(normalized), body_style))
            story.append(Spacer(1, 0.1 * cm))
        story.append(Spacer(1, 0.12 * cm))

    doc.build(story)
    return buf.getvalue()


def save_pdf_bytes(data: bytes, user_id: int, name: str) -> Path:
    d = settings.storage_path() / "resumes" / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    path = d / name
    path.write_bytes(data)
    return path
