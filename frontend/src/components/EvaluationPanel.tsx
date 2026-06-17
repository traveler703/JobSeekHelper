function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asString(x)).filter(Boolean);
}

type Props = {
  evaluation: Record<string, unknown> | null;
  endedReason?: string | null;
  reasonLabel?: (r: string | null) => string;
};

export default function EvaluationPanel({
  evaluation,
  endedReason,
  reasonLabel,
}: Props) {
  if (!evaluation || Object.keys(evaluation).length === 0) {
    return <p className="muted">暂无评价内容。</p>;
  }

  const overall = asString(evaluation.overall);
  const strengths = asStringArray(evaluation.strengths);
  const gaps = asStringArray(evaluation.gaps);
  const suggestions = asStringArray(evaluation.suggestions);
  const rag = asString(evaluation.rag_alignment);
  const fluency = asString(evaluation.fluency_analysis);
  const ks = evaluation.knowledge_score;
  const ps = evaluation.project_depth_score;
  const fs = evaluation.fluency_score;

  const restKeys = Object.keys(evaluation).filter(
    (k) =>
      ![
        "overall",
        "strengths",
        "gaps",
        "suggestions",
        "rag_alignment",
        "knowledge_score",
        "project_depth_score",
        "fluency_score",
        "fluency_analysis",
      ].includes(k)
  );

  return (
    <div className="evaluation-panel">
      {endedReason != null && reasonLabel && (
        <p className="muted">
          <strong>结束原因：</strong>
          {reasonLabel(endedReason)}
        </p>
      )}
      {overall && (
        <section className="eval-section">
          <h4>总评</h4>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{overall}</p>
        </section>
      )}
      {(typeof ks === "number" || typeof ks === "string") && (
        <p>
          <strong>知识掌握：</strong>
          {String(ks)} / 10
        </p>
      )}
      {(typeof ps === "number" || typeof ps === "string") && (
        <p>
          <strong>项目深度：</strong>
          {String(ps)} / 10
        </p>
      )}
      {(typeof fs === "number" || typeof fs === "string") && (
        <p>
          <strong>熟练程度：</strong>
          {String(fs)} / 10
        </p>
      )}
      {fluency && (
        <section className="eval-section">
          <h4>回答熟练度</h4>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{fluency}</p>
        </section>
      )}
      {strengths.length > 0 && (
        <section className="eval-section">
          <h4>亮点</h4>
          <ul className="eval-list">
            {strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
      {gaps.length > 0 && (
        <section className="eval-section">
          <h4>不足与改进</h4>
          <ul className="eval-list">
            {gaps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
      {rag && (
        <section className="eval-section">
          <h4>与资料 / 考点的对照</h4>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{rag}</p>
        </section>
      )}
      {suggestions.length > 0 && (
        <section className="eval-section">
          <h4>学习建议</h4>
          <ul className="eval-list">
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
      {restKeys.map((k) => (
        <section key={k} className="eval-section">
          <h4>{k}</h4>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {typeof evaluation[k] === "object"
              ? JSON.stringify(evaluation[k], null, 2)
              : String(evaluation[k])}
          </p>
        </section>
      ))}
    </div>
  );
}
