from __future__ import annotations

import re
from typing import Any


DEFAULT_TTS_VOICE = "zh-CN-XiaoxiaoNeural"


def normalize_tts_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text[:1200]


async def synthesize_edge_tts(
    text: str,
    *,
    voice: str = DEFAULT_TTS_VOICE,
    rate: str = "-6%",
    volume: str = "+0%",
) -> bytes:
    """Generate MP3 audio with optional edge-tts.

    edge-tts is kept as an optional dependency at runtime so the interview still
    works in offline/dev environments through the browser Web Speech fallback.
    """

    try:
        import edge_tts  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local environment
        raise RuntimeError("edge-tts 未安装，无法生成神经语音") from exc

    normalized = normalize_tts_text(text)
    if not normalized:
        raise ValueError("播报文本为空")

    communicate = edge_tts.Communicate(
        normalized,
        voice=voice,
        rate=rate,
        volume=volume,
    )
    chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            data = chunk.get("data")
            if isinstance(data, bytes):
                chunks.append(data)
    audio = b"".join(chunks)
    if not audio:
        raise RuntimeError("语音生成失败")
    return audio


FILLER_PATTERNS = [
    "嗯",
    "呃",
    "额",
    "啊",
    "哦",
    "诶",
    "这个",
    "那个",
    "就是",
    "然后",
    "就是说",
    "怎么说呢",
    "我觉得",
    "我认为",
    "大概",
    "可能",
    "呃这个",
    "嗯这个",
]


def clean_answer_text(text: str) -> str:
    cleaned = re.sub(r"\s+", "", text or "")
    cleaned = re.sub(r"[，。！？、；：,.!?;:\-—…]+", "", cleaned)
    for filler in sorted(FILLER_PATTERNS, key=len, reverse=True):
        cleaned = cleaned.replace(filler, "")
    return cleaned


def analyze_answer_timing(text: str, timing: dict[str, Any] | None) -> dict[str, Any]:
    timing = timing if isinstance(timing, dict) else {}
    char_events_raw = timing.get("char_events")
    char_events = char_events_raw if isinstance(char_events_raw, list) else []
    events: list[dict[str, Any]] = []
    for item in char_events:
        if not isinstance(item, dict):
            continue
        ch = str(item.get("char") or "")[:1]
        if not ch.strip():
            continue
        try:
            t = float(item.get("t"))
        except (TypeError, ValueError):
            continue
        events.append({"char": ch, "t": max(0.0, t)})

    cleaned = clean_answer_text(text)
    cleaned_chars = set(cleaned)
    first_core_latency = None
    for item in events:
        if item["char"] in cleaned_chars and item["char"] not in "，。！？、；：,.!?;:-—…":
            first_core_latency = round(item["t"], 2)
            break

    gaps: list[float] = []
    for prev, cur in zip(events, events[1:]):
        gap = float(cur["t"]) - float(prev["t"])
        if gap > 0:
            gaps.append(gap)
    stall_gaps = [g for g in gaps if g >= 1.2]
    duration = 0.0
    if events:
        duration = max(float(events[-1]["t"]), 0.0)
    else:
        try:
            duration = max(0.0, (float(timing.get("submitted_at")) - float(timing.get("started_at"))) / 1000.0)
        except (TypeError, ValueError):
            duration = 0.0

    core_char_count = len(cleaned)
    avg_core_chars_per_second = round(core_char_count / duration, 2) if duration > 0 else None
    filler_count = max(0, len(re.sub(r"\s+", "", text or "")) - core_char_count)
    filler_ratio = round(filler_count / max(1, len(re.sub(r"\s+", "", text or ""))), 2)

    return {
        "raw_char_count": len(re.sub(r"\s+", "", text or "")),
        "core_text": cleaned[:400],
        "core_char_count": core_char_count,
        "filler_count_estimate": filler_count,
        "filler_ratio": filler_ratio,
        "first_core_latency_seconds": first_core_latency,
        "max_pause_seconds": round(max(stall_gaps), 2) if stall_gaps else 0,
        "stall_count": len(stall_gaps),
        "answer_duration_seconds": round(duration, 2),
        "avg_core_chars_per_second": avg_core_chars_per_second,
    }


def summarize_fluency_metrics(transcript: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    idx = 1
    for msg in transcript:
        if msg.get("role") != "user":
            continue
        metrics = msg.get("answer_metrics")
        if not isinstance(metrics, dict):
            continue
        lines.append(
            "第{idx}次回答：首个核心词延迟 {first}s，最长卡顿 {pause}s，卡壳 {stalls} 次，"
            "核心字数 {core}，语气/填充占比 {ratio}，核心语速 {speed} 字/秒。".format(
                idx=idx,
                first=metrics.get("first_core_latency_seconds"),
                pause=metrics.get("max_pause_seconds"),
                stalls=metrics.get("stall_count"),
                core=metrics.get("core_char_count"),
                ratio=metrics.get("filler_ratio"),
                speed=metrics.get("avg_core_chars_per_second"),
            )
        )
        idx += 1
    return "\n".join(lines)
