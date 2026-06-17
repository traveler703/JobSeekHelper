import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.deps import get_current_user
from app.models import InterviewSession, User
from app.schemas import InterviewSessionDetailOut, InterviewSessionOut
from app.security import decode_token
from app.services.interview_service import evaluate_interview, interview_turn
from app.services.speech import DEFAULT_TTS_VOICE, analyze_answer_timing, synthesize_edge_tts
from app.routers.profile import load_profile_dict

router = APIRouter(prefix="/interview", tags=["interview"])


def _utcnow():
    return datetime.now(timezone.utc)


@router.get("/sessions", response_model=list[InterviewSessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    rows = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == current.id)
        .order_by(InterviewSession.id.desc())
        .limit(50)
        .all()
    )
    return [InterviewSessionOut.model_validate(r) for r in rows]


@router.get("/sessions/{session_id}", response_model=InterviewSessionDetailOut)
def get_session_detail(
    session_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    row = db.get(InterviewSession, session_id)
    if row is None or row.user_id != current.id:
        raise HTTPException(404, "会话不存在")
    try:
        messages = json.loads(row.messages_json or "[]")
    except json.JSONDecodeError:
        messages = []
    ev: dict | None = None
    if row.evaluation_json:
        try:
            ev = json.loads(row.evaluation_json)
        except json.JSONDecodeError:
            ev = None
    return InterviewSessionDetailOut(
        id=row.id,
        job_role=row.job_role,
        target_company=row.target_company,
        target_position=row.target_position,
        status=row.status,
        started_at=row.started_at,
        ended_at=row.ended_at,
        ended_reason=row.ended_reason,
        messages=messages if isinstance(messages, list) else [],
        evaluation=ev,
    )


@router.get("/sessions/{session_id}/evaluation")
def get_evaluation(
    session_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    row = db.get(InterviewSession, session_id)
    if row is None or row.user_id != current.id:
        raise HTTPException(404, "会话不存在")
    if not row.evaluation_json:
        raise HTTPException(400, "暂无评价")
    try:
        return json.loads(row.evaluation_json)
    except json.JSONDecodeError:
        raise HTTPException(500, "评价数据损坏")


@router.post("/tts")
async def tts(
    payload: dict,
    current: User = Depends(get_current_user),
):
    _ = current
    text = (payload.get("text") or "").strip()
    voice = (payload.get("voice") or DEFAULT_TTS_VOICE).strip()
    if not text:
        raise HTTPException(400, "播报文本为空")
    try:
        audio = await synthesize_edge_tts(text, voice=voice)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except Exception as e:
        raise HTTPException(503, f"神经语音暂不可用：{e}") from e
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store"},
    )


@router.websocket("/ws")
async def interview_ws(
    websocket: WebSocket,
    token: str | None = Query(None),
):
    await websocket.accept()
    if not token:
        await websocket.close(code=4401)
        return
    sub = decode_token(token)
    if not sub:
        await websocket.close(code=4401)
        return
    try:
        user_id = int(sub)
    except ValueError:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    session_row: InterviewSession | None = None

    try:
        user = db.get(User, user_id)
        if user is None:
            await websocket.close(code=4401)
            return

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "message": "无效的 JSON"}
                )
                continue
            mtype = msg.get("type")

            if mtype == "start":
                job_role = (msg.get("job_role") or "custom").strip()
                target_company = (msg.get("target_company") or "").strip()
                target_position = (msg.get("target_position") or "").strip()
                if not target_position:
                    await websocket.send_json(
                        {"type": "error", "message": "请填写目标岗位"}
                    )
                    continue
                profile = load_profile_dict(db, user_id)

                session_row = InterviewSession(
                    user_id=user_id,
                    job_role=job_role,
                    target_company=target_company,
                    target_position=target_position,
                    status="active",
                    messages_json="[]",
                )
                db.add(session_row)
                db.commit()
                db.refresh(session_row)

                transcript: list[dict] = []
                result = interview_turn(
                    profile=profile,
                    job_role=job_role,
                    user_id=user_id,
                    transcript=transcript,
                    started_at=session_row.started_at,
                    target_company=target_company,
                    target_position=target_position,
                )

                if result["kind"] == "end":
                    await _finish_session(
                        db,
                        session_row,
                        transcript,
                        profile,
                        user_id,
                        result.get("end_reason") or "llm",
                    )
                    ev = json.loads(session_row.evaluation_json or "{}")
                    await websocket.send_json(
                        {
                            "type": "ended",
                            "session_id": session_row.id,
                            "evaluation": ev,
                            "reason": session_row.ended_reason,
                        }
                    )
                    continue

                q = result["question"] or ""
                transcript.append({"role": "assistant", "content": q})
                session_row.messages_json = json.dumps(transcript, ensure_ascii=False)
                db.commit()

                await websocket.send_json(
                    {
                        "type": "question",
                        "session_id": session_row.id,
                        "text": q,
                    }
                )

            elif mtype == "answer":
                if session_row is None:
                    await websocket.send_json(
                        {"type": "error", "message": "请先发送 start"}
                    )
                    continue
                if session_row.status != "active":
                    await websocket.send_json(
                        {"type": "error", "message": "会话已结束"}
                    )
                    continue

                text = (msg.get("text") or "").strip()
                if not text:
                    await websocket.send_json({"type": "error", "message": "回答为空"})
                    continue

                profile = load_profile_dict(db, user_id)
                transcript = json.loads(session_row.messages_json or "[]")
                answer_metrics = analyze_answer_timing(text, msg.get("timing"))
                transcript.append(
                    {
                        "role": "user",
                        "content": text,
                        "answer_metrics": answer_metrics,
                    }
                )

                result = interview_turn(
                    profile=profile,
                    job_role=session_row.job_role,
                    user_id=user_id,
                    transcript=transcript,
                    started_at=session_row.started_at,
                    target_company=session_row.target_company or "",
                    target_position=session_row.target_position or "",
                )

                if result["kind"] == "end":
                    closing = (result.get("question") or "").strip() or "好的，本次面试到此结束。"
                    transcript.append({"role": "assistant", "content": closing})
                    await _finish_session(
                        db,
                        session_row,
                        transcript,
                        profile,
                        user_id,
                        result.get("end_reason") or "llm",
                    )
                    ev = json.loads(session_row.evaluation_json or "{}")
                    await websocket.send_json(
                        {
                            "type": "ended",
                            "session_id": session_row.id,
                            "evaluation": ev,
                            "reason": session_row.ended_reason,
                        }
                    )
                    continue

                q = result["question"] or ""
                transcript.append({"role": "assistant", "content": q})
                session_row.messages_json = json.dumps(transcript, ensure_ascii=False)
                db.commit()

                await websocket.send_json(
                    {
                        "type": "question",
                        "session_id": session_row.id,
                        "text": q,
                    }
                )

            elif mtype == "end_interview":
                if session_row is None or session_row.status != "active":
                    await websocket.send_json(
                        {"type": "error", "message": "无可结束的会话"}
                    )
                    continue
                profile = load_profile_dict(db, user_id)
                transcript = json.loads(session_row.messages_json or "[]")
                await _finish_session(
                    db, session_row, transcript, profile, user_id, "user"
                )
                ev = json.loads(session_row.evaluation_json or "{}")
                await websocket.send_json(
                    {
                        "type": "ended",
                        "session_id": session_row.id,
                        "evaluation": ev,
                        "reason": "user",
                    }
                )

            elif mtype == "cheat":
                if session_row is None or session_row.status != "active":
                    await websocket.send_json(
                        {"type": "error", "message": "无可结束的会话"}
                    )
                    continue
                profile = load_profile_dict(db, user_id)
                transcript = json.loads(session_row.messages_json or "[]")
                await _finish_session(
                    db, session_row, transcript, profile, user_id, "visibility"
                )
                ev = json.loads(session_row.evaluation_json or "{}")
                await websocket.send_json(
                    {
                        "type": "ended",
                        "session_id": session_row.id,
                        "evaluation": ev,
                        "reason": "visibility",
                    }
                )

            else:
                await websocket.send_json({"type": "error", "message": "未知消息类型"})

    except WebSocketDisconnect:
        pass
    finally:
        db.close()


def _finish_session(
    db: Session,
    row: InterviewSession,
    transcript: list[dict],
    profile: dict,
    user_id: int,
    reason: str,
) -> None:
    try:
        ev = evaluate_interview(
            profile=profile,
            job_role=row.job_role,
            user_id=user_id,
            transcript=transcript,
            target_company=row.target_company,
            target_position=row.target_position,
        )
    except Exception as e:
        ev = {
            "overall": f"评估生成失败：{e}",
            "knowledge_score": 0,
            "project_depth_score": 0,
            "strengths": [],
            "gaps": [],
            "rag_alignment": "",
            "suggestions": [],
        }
    row.status = "ended"
    row.ended_at = _utcnow()
    row.ended_reason = reason
    row.evaluation_json = json.dumps(ev, ensure_ascii=False)
    row.messages_json = json.dumps(transcript, ensure_ascii=False)
    db.commit()
