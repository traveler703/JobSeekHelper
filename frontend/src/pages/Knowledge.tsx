import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import LoadingOverlay from "../components/LoadingOverlay";
import { formatLocalDateTime } from "../utils/datetime";

type Doc = { id: number; filename: string; created_at: string };
type CommonPoint = { topic: string; question: string; answer: string };

export default function Knowledge() {
  const [list, setList] = useState<Doc[]>([]);
  const [points, setPoints] = useState<CommonPoint[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pointsErr, setPointsErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyTitle, setBusyTitle] = useState("请稍候");

  async function refresh() {
    const { data } = await api.get("/knowledge");
    setList(data);
  }

  async function refreshPoints() {
    setPointsErr(null);
    try {
      const { data } = await api.get<{ points: CommonPoint[] }>("/knowledge/common-points");
      setPoints(data.points ?? []);
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { detail?: string } } };
      setPointsErr(ax?.response?.data?.detail ?? "常见考点生成失败");
      setPoints([]);
    }
  }

  useEffect(() => {
    refresh()
      .then(() => refreshPoints())
      .catch(() => setErr("加载失败"));
  }, []);

  async function upload(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (files.length === 0) {
      setErr("请选择至少一个文件");
      return;
    }
    const fd = new FormData();
    for (const f of files) {
      fd.append("files", f);
    }
    setBusy(true);
    setBusyTitle("正在上传并向量化，请稍候…");
    try {
      await api.post("/knowledge/upload", fd);
      setFiles([]);
      await refresh();
      await refreshPoints();
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { detail?: string } } };
      setErr(ax?.response?.data?.detail ?? "上传失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setErr(null);
    setBusy(true);
    setBusyTitle("正在删除…");
    try {
      await api.delete(`/knowledge/${id}`);
      await refresh();
      await refreshPoints();
    } catch {
      setErr("删除失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <LoadingOverlay open={busy} title={busyTitle} />
      <h1>知识库管理</h1>
      <p className="muted">
        上传与应聘岗位相关的笔记或资料（支持批量），系统将做 RAG 解析并写入本地向量库，供模拟面试评价引用。
      </p>
      <div className="card">
        <form onSubmit={upload}>
          <input
            type="file"
            accept=".pdf,.docx,.pptx,.txt"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <div style={{ height: 12 }} />
          <button type="submit">上传并向量化</button>
          <p className="muted">已选择 {files.length} 个文件；支持 pdf、docx、pptx、txt，单个不超过 500MB。</p>
        </form>
      </div>
      <div className="card">
        <h3>已上传</h3>
        <ul>
          {list.map((d) => (
            <li key={d.id} className="row">
              <span>
                {d.filename}{" "}
                <span className="muted">({formatLocalDateTime(d.created_at)})</span>
              </span>
              <button type="button" className="danger" onClick={() => void remove(d.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="muted">暂无文档</p>}
      </div>
      <div className="knowledge-points-section">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <h2 style={{ margin: "0 0 0.25rem" }}>常见考点</h2>
            <p className="muted" style={{ margin: 0 }}>
              基于已上传资料自动归纳，点击卡片查看参考答案。
            </p>
          </div>
          <button type="button" className="secondary" onClick={() => void refreshPoints()}>
            重新整理
          </button>
        </div>
        {points.length > 0 ? (
          <div className="knowledge-card-grid">
            {points.map((p, i) => (
              <button type="button" className="flip-card" key={`${p.question}-${i}`}>
                <span className="flip-card-inner">
                  <span className="flip-face flip-front">
                    <span className="point-topic">{p.topic || "常见考点"}</span>
                    <strong>{p.question}</strong>
                  </span>
                  <span className="flip-face flip-back">
                    <span className="point-topic">{p.topic || "参考答案"}</span>
                    <span>{p.answer}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">上传资料后，可在这里生成常见考点卡片。</p>
        )}
        {pointsErr && <p className="error">{pointsErr}</p>}
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  );
}
