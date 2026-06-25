import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, wsUrl } from "../api";
import EvaluationPanel from "../components/EvaluationPanel";
import { formatLocalDateTime } from "../utils/datetime";

type SessionRow = {
  id: number;
  job_role: string;
  target_company?: string;
  target_position?: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  ended_reason: string | null;
};

type SessionDetail = SessionRow & {
  messages: { role: string; content: string; answer_metrics?: Record<string, unknown> }[];
  evaluation: Record<string, unknown> | null;
};

type CharEvent = {
  char: string;
  t: number;
  source: "speech" | "typing";
};

let activeAudio: HTMLAudioElement | null = null;
let speechSerial = 0;

function stopSpeechNow() {
  speechSerial += 1;
  window.speechSynthesis.cancel();
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
}

function pickZhVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefer = (pred: (v: SpeechSynthesisVoice) => boolean) =>
    voices.find(pred) ?? null;
  return (
    prefer(
      (v) =>
        /zh|cn|yue|Chinese/i.test(v.lang) &&
        /Xiaoxiao|Xiaoyi|Yunxi|Yaoyao|Tingting|Huihui|Xiaochen|female|premium|neural|Natural/i.test(
          v.name
        )
    ) ||
    prefer((v) => /zh|cn|Chinese/i.test(v.lang)) ||
    null
  );
}

/** 按句切分并排队播报，减轻「机器一口气读完」的生硬感 */
function speakNatural(text: string) {
  const serial = ++speechSerial;
  window.speechSynthesis.cancel();
  const raw = text.replace(/\r/g, "").trim();
  if (!raw) return;
  const parts = raw
    .split(/(?<=[。！？；\n])/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks = parts.length ? parts : [raw];
  let i = 0;
  const run = () => {
    if (serial !== speechSerial) return;
    if (i >= chunks.length) return;
    const u = new SpeechSynthesisUtterance(chunks[i++]);
    u.lang = "zh-CN";
    u.rate = 0.88;
    u.pitch = 1.02;
    const voice = pickZhVoice();
    if (voice) u.voice = voice;
    u.onend = () => {
      window.setTimeout(run, 90);
    };
    u.onerror = () => run();
    window.speechSynthesis.speak(u);
  };
  run();
}

async function speakWithNeuralTts(text: string, fallback: () => void) {
  const serial = ++speechSerial;
  const normalized = text.trim();
  if (!normalized) return;
  try {
    window.speechSynthesis.cancel();
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }
    const res = await api.post(
      "/interview/tts",
      { text: normalized },
      { responseType: "blob" }
    );
    if (serial !== speechSerial) return;
    const audioUrl = URL.createObjectURL(res.data);
    const audio = new Audio(audioUrl);
    activeAudio = audio;
    audio.playbackRate = 0.96;
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      if (activeAudio === audio) activeAudio = null;
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      if (activeAudio === audio) activeAudio = null;
      if (serial === speechSerial) fallback();
    };
    await audio.play();
  } catch {
    if (serial === speechSerial) fallback();
  }
}

function appendCharEvents(
  prev: string,
  next: string,
  source: CharEvent["source"],
  startedAt: number,
  current: CharEvent[]
) {
  if (next.length <= prev.length || !startedAt) return current;
  const added = next.slice(prev.length);
  const t = Math.max(0, (Date.now() - startedAt) / 1000);
  return [
    ...current,
    ...Array.from(added)
      .filter((char) => char.trim())
      .map((char) => ({ char, t, source })),
  ];
}

function reasonLabel(r: string | null) {
  if (r === "user") return "用户结束";
  if (r === "visibility") return "切换界面/离开页面";
  if (r === "time") return "时长或覆盖度达标";
  if (r === "llm") return "系统判定结束";
  return r ?? "—";
}

function sessionSummaryLine(s: SessionRow): string {
  const c = (s.target_company || "").trim();
  const p = (s.target_position || "").trim();
  if (c && p) return `${c} · ${p}`;
  if (p) return p;
  if (c) return c;
  return s.job_role;
}

export default function Interview() {
  const [ivCompany, setIvCompany] = useState("");
  const [ivPosition, setIvPosition] = useState("");
  const [question, setQuestion] = useState("");
  const [draft, setDraft] = useState("");
  const [evalJson, setEvalJson] = useState<Record<string, unknown> | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [fsOpen, setFsOpen] = useState(false);
  const [endingInBackground, setEndingInBackground] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailModalErr, setDetailModalErr] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  /** 本次「语音听写」开始前的输入框内容；听写过程中只在其后追加识别结果，避免把每次中间稿整段重复拼接 */
  const speechBaseRef = useRef("");
  const cheatSent = useRef(false);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const pendingInterviewRef = useRef({ company: "", position: "" });
  const answerStartedAtRef = useRef(0);
  const charEventsRef = useRef<CharEvent[]>([]);
  const keepWsAfterFsCloseRef = useRef(false);
  const endingRequestedRef = useRef(false);

  const token = localStorage.getItem("token") || "";

  const refreshSessions = useCallback(() => {
    api
      .get<SessionRow[]>("/interview/sessions")
      .then((r) => setSessions(r.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    loadVoices();
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      closeWs();
      stopSpeechNow();
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [closeWs]);

  useEffect(() => {
    function onVis() {
      if (!document.hidden || !sessionActive || cheatSent.current) return;
      cheatSent.current = true;
      const w = wsRef.current;
      if (w && w.readyState === WebSocket.OPEN) {
        w.send(JSON.stringify({ type: "cheat" }));
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [sessionActive]);

  useEffect(() => {
    function onFs() {
      if (document.fullscreenElement) return;
      if (!sessionActive || cheatSent.current) return;
      const w = wsRef.current;
      if (w && w.readyState === WebSocket.OPEN) {
        cheatSent.current = true;
        w.send(JSON.stringify({ type: "cheat" }));
      }
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [sessionActive]);

  const exitFs = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setFsOpen(false);
  }, []);

  const connectWs = useCallback((): WebSocket => {
    const url = wsUrl("/api/interview/ws", { token });
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as {
          type: string;
          text?: string;
          evaluation?: Record<string, unknown>;
          reason?: string;
          message?: string;
        };
        if (data.type === "question" && data.text) {
          if (endingRequestedRef.current) {
            stopSpeechNow();
            return;
          }
          setQuestion(data.text);
          void speakWithNeuralTts(data.text, () => speakNatural(data.text ?? ""));
          setDraft("");
          answerStartedAtRef.current = Date.now();
          charEventsRef.current = [];
          setSessionActive(true);
        } else if (data.type === "ended") {
          stopSpeechNow();
          setQuestion("");
          setEvalJson(data.evaluation ?? null);
          setEndedReason(data.reason ?? null);
          setSessionActive(false);
          setEndingInBackground(false);
          endingRequestedRef.current = false;
          closeWs();
          exitFs();
          refreshSessions();
        } else if (data.type === "error") {
          setErr(data.message ?? "错误");
        }
      } catch {
        setErr("消息解析失败");
      }
    };
    ws.onerror = () => {
      setErr("连接异常");
    closeWs();
    stopSpeechNow();
      exitFs();
    };
    return ws;
  }, [closeWs, exitFs, refreshSessions, token]);

  useEffect(() => {
    if (!fsOpen) return;

    let cancelled = false;

    async function boot() {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      if (cancelled) return;
      const el = portalRef.current;
      if (!el) {
        setFsOpen(false);
        return;
      }
      try {
        await el.requestFullscreen();
      } catch {
        setErr("无法进入全屏，请允许全屏后重试");
        setFsOpen(false);
        return;
      }
      if (cancelled) return;
      closeWs();
      setErr(null);
      setEvalJson(null);
      setEndedReason(null);
      setQuestion("");
      cheatSent.current = false;
      endingRequestedRef.current = false;
      const { company, position } = pendingInterviewRef.current;
      const ws = connectWs();
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "start",
            job_role: "custom",
            target_company: company,
            target_position: position,
          })
        );
      };
    }

    void boot();
    return () => {
      cancelled = true;
      if (keepWsAfterFsCloseRef.current) {
        keepWsAfterFsCloseRef.current = false;
      } else {
        closeWs();
      }
    };
  }, [fsOpen, closeWs, connectWs]);

  function sendAnswer(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const text = draft.trim();
    if (!text) {
      setErr("请先输入或识别回答内容");
      return;
    }
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) {
      setErr("连接已断开");
      return;
    }
    const now = Date.now();
    w.send(
      JSON.stringify({
        type: "answer",
        text,
        timing: {
          started_at: answerStartedAtRef.current,
          submitted_at: now,
          char_events: charEventsRef.current,
        },
      })
    );
  }

  function endByUser() {
    setErr(null);
    stopSpeechNow();
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) {
      setSessionActive(false);
      exitFs();
      return;
    }
    setSessionActive(false);
    setListening(false);
    setQuestion("");
    setDraft("");
    setEndingInBackground(true);
    keepWsAfterFsCloseRef.current = true;
    endingRequestedRef.current = true;
    w.send(JSON.stringify({ type: "end_interview" }));
    exitFs();
    refreshSessions();
  }

  function toggleListen() {
    setErr(null);
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setErr("当前浏览器不支持语音识别，请手动输入");
      return;
    }
    if (listening && recRef.current) {
      recRef.current.stop();
      setListening(false);
      return;
    }
    speechBaseRef.current = draft;
    const rec = new Ctor();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let recognized = "";
      for (let i = 0; i < ev.results.length; i++) {
        recognized += ev.results[i][0].transcript;
      }
      const next = speechBaseRef.current + recognized;
      setDraft((prev) => {
        charEventsRef.current = appendCharEvents(
          prev,
          next,
          "speech",
          answerStartedAtRef.current,
          charEventsRef.current
        );
        return next;
      });
    };
    rec.onerror = () => setErr("语音识别出错");
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function openRecordModal(id: number) {
    setRecordModalOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setDetailModalErr(null);
    setErr(null);
    try {
      const { data } = await api.get<SessionDetail>(`/interview/sessions/${id}`);
      setDetail(data);
    } catch {
      setDetailModalErr("加载面试详情失败");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeRecordModal() {
    setRecordModalOpen(false);
    setDetail(null);
    setDetailLoading(false);
    setDetailModalErr(null);
  }

  async function deleteRecord(id: number) {
    setErr(null);
    try {
      await api.delete(`/interview/sessions/${id}`);
      if (detail?.id === id) {
        closeRecordModal();
      }
      await refreshSessions();
    } catch {
      setErr("删除面试记录失败");
    }
  }

  const portalUi =
    fsOpen &&
    createPortal(
      <div ref={portalRef} className="interview-portal-root">
        <div className="interview-portal-inner">
          {fsOpen && !question && !evalJson && (
            <div className="card interview-portal-card">
              <p style={{ marginTop: 0 }}>正在进入面试，请稍候…</p>
              <p className="muted">若长时间无题目，请检查网络或 API 配置。</p>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  closeWs();
                  exitFs();
                }}
              >
                取消并退出全屏
              </button>
            </div>
          )}

          {question && (
            <div className="card interview-portal-card">
              <h3 style={{ marginTop: 0 }}>当前题目</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{question}</p>
              <form onSubmit={sendAnswer}>
                <label>你的回答（可编辑语音识别结果）</label>
                <textarea
                  value={draft}
                  onChange={(e) => {
                    const next = e.target.value;
                    charEventsRef.current = appendCharEvents(
                      draft,
                      next,
                      "typing",
                      answerStartedAtRef.current,
                      charEventsRef.current
                    );
                    setDraft(next);
                  }}
                  rows={8}
                />
                <div className="row" style={{ marginTop: 12 }}>
                  <button type="submit" disabled={!sessionActive}>
                    提交回答
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={toggleListen}
                    disabled={!sessionActive}
                  >
                    {listening ? "停止听写" : "语音听写"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void speakWithNeuralTts(question, () => speakNatural(question))}
                    disabled={!sessionActive}
                  >
                    重播题目
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={endByUser}
                    disabled={!sessionActive}
                  >
                    结束面试
                  </button>
                </div>
              </form>
            </div>
          )}

          {evalJson && (
            <div className="card interview-portal-card">
              <h3 style={{ marginTop: 0 }}>面试评价</h3>
              <EvaluationPanel evaluation={evalJson} endedReason={endedReason} reasonLabel={reasonLabel} />
            </div>
          )}
        </div>
      </div>,
      document.body
    );

  return (
    <div>
      <h1>模拟面试</h1>
      <p className="muted">
        建议使用 Chrome/Edge，并尽量选用系统自带的中文语音包，播报会更自然。
      </p>

      <div className="interview-two-col">
        <div className="card interview-col-card">
          <h3 style={{ marginTop: 0 }}>模拟面试对话</h3>
          {!fsOpen && (
            <>
              <label>要求职的公司</label>
              <input
                value={ivCompany}
                onChange={(e) => setIvCompany(e.target.value)}
                placeholder="例如：某某科技有限公司"
              />
              <div className="space-sm" />
              <label>目标岗位</label>
              <input
                value={ivPosition}
                onChange={(e) => setIvPosition(e.target.value)}
                placeholder="例如：Java 后端开发"
                required
              />
              <div style={{ height: 12 }} />
              <button
                type="button"
                onClick={() => {
                  const pos = ivPosition.trim();
                  if (!pos) {
                    setErr("请填写目标岗位后再开始");
                    return;
                  }
                  setErr(null);
                  pendingInterviewRef.current = {
                    company: ivCompany.trim(),
                    position: pos,
                  };
                  setFsOpen(true);
                }}
              >
                进入全屏并开始面试
              </button>
              <p className="muted" style={{ marginTop: 10 }}>
                点击后将进入仅含面试内容的全屏界面；切换标签页或离开页面将立即结束面试。
              </p>
            </>
          )}
          {fsOpen && (
            <p className="muted">全屏面试进行中… 结束或退出全屏后将回到此处。</p>
          )}
          {endingInBackground && (
            <p className="muted" style={{ marginTop: 10 }}>
              已退出面试界面，系统正在生成评价；完成后右侧记录会自动刷新。
            </p>
          )}
        </div>

        <div className="card interview-col-card">
          <h3 style={{ marginTop: 0 }}>面试记录查看</h3>
          <p className="muted">按时间倒序，最新的记录在最上面。</p>
          <ul className="session-list">
            {sessions.map((s) => (
              <li key={s.id} className="session-list-item">
                <button
                  type="button"
                  className="linklike"
                  onClick={() => void openRecordModal(s.id)}
                >
                  #{s.id} · {sessionSummaryLine(s)} · {formatLocalDateTime(s.started_at)}
                  {s.status === "ended" ? "（已结束）" : ""}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void deleteRecord(s.id)}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
          {sessions.length === 0 && <p className="muted">暂无记录</p>}
        </div>
      </div>

      {recordModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRecordModal();
          }}
        >
          <div className="modal-card card session-record-modal">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>面试详情</h3>
              <button type="button" className="secondary" onClick={closeRecordModal}>
                关闭
              </button>
            </div>
            {detailLoading && (
              <div className="record-modal-loading">
                <div className="loading-spinner" aria-hidden />
                <p className="muted">正在加载记录…</p>
              </div>
            )}
            {!detailLoading && detail && (
              <>
                <p className="muted">
                  {sessionSummaryLine(detail)} · {formatLocalDateTime(detail.started_at)}
                  {detail.ended_at ? ` — ${formatLocalDateTime(detail.ended_at)}` : ""}
                </p>
                <h4>对话记录</h4>
                <div className="chat-log">
                  {detail.messages.map((m, i) => (
                    <div key={i} className={`chat-bubble chat-${m.role}`}>
                      <span className="chat-role">{m.role === "assistant" ? "考官" : "你"}</span>
                      <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{m.content}</p>
                      {m.role === "user" && m.answer_metrics && (
                        <p className="muted answer-metrics">
                          首词 {String(m.answer_metrics.first_core_latency_seconds ?? "—")}s ·
                          最长卡顿 {String(m.answer_metrics.max_pause_seconds ?? "—")}s ·
                          卡壳 {String(m.answer_metrics.stall_count ?? "—")} 次 ·
                          填充占比 {String(m.answer_metrics.filler_ratio ?? "—")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <h4>系统评价</h4>
                {detail.evaluation ? (
                  <EvaluationPanel evaluation={detail.evaluation} />
                ) : (
                  <p className="muted">该会话暂无评价或未结束。</p>
                )}
              </>
            )}
            {!detailLoading && detailModalErr && <p className="error">{detailModalErr}</p>}
          </div>
        </div>
      )}

      {portalUi}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
