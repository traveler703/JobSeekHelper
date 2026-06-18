import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import LoadingOverlay from "../components/LoadingOverlay";

type Personal = {
  full_name: string;
  gender: string;
  birth_ym: string;
  phone: string;
  email: string;
};

type Education = {
  school: string;
  major: string;
  level: string;
  start_ym: string;
  end_ym: string;
};

type Project = {
  name: string;
  start_ym: string;
  end_ym: string;
  role: string;
  summary: string;
  work: string;
};

type Internship = {
  company: string;
  position: string;
  start_ym: string;
  end_ym: string;
  work: string;
};

type Award = {
  name: string;
  level: string;
  award_ym: string;
};

type Language = {
  lang: string;
  proficiency: string;
};

type Skill = {
  name: string;
  level: string;
};

type ResumeForm = {
  personal: Personal;
  education: Education[];
  projects: Project[];
  internships: Internship[];
  awards: Award[];
  languages: Language[];
  skills: Skill[];
};

const EDU_LEVELS = ["大专", "本科", "硕士", "博士", "博士后"] as const;
const LANG_LEVELS = ["入门", "日常沟通", "专业沟通", "精通掌握"] as const;

const emptyPersonal = (): Personal => ({
  full_name: "",
  gender: "",
  birth_ym: "",
  phone: "",
  email: "",
});

const emptyEducation = (): Education => ({
  school: "",
  major: "",
  level: "本科",
  start_ym: "",
  end_ym: "",
});

const emptyProject = (): Project => ({
  name: "",
  start_ym: "",
  end_ym: "",
  role: "",
  summary: "",
  work: "",
});

const emptyInternship = (): Internship => ({
  company: "",
  position: "",
  start_ym: "",
  end_ym: "",
  work: "",
});

const emptyAward = (): Award => ({
  name: "",
  level: "",
  award_ym: "",
});

const emptyLanguage = (): Language => ({
  lang: "",
  proficiency: "日常沟通",
});

const emptySkill = (): Skill => ({
  name: "",
  level: "",
});

const defaultForm = (): ResumeForm => ({
  personal: emptyPersonal(),
  education: [emptyEducation()],
  projects: [emptyProject()],
  internships: [emptyInternship()],
  awards: [emptyAward()],
  languages: [emptyLanguage()],
  skills: [emptySkill()],
});

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function hasContent(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(hasContent);
  if (v && typeof v === "object") return Object.values(v).some(hasContent);
  const text = String(v ?? "").trim();
  return text.length > 0 && text !== "本科" && text !== "日常沟通";
}

function ensureRows<T>(rows: T[], one: () => T): T[] {
  const filtered = rows.filter(hasContent);
  return filtered.length > 0 ? filtered : [one()];
}

function ymOrder(a: string, b: string): number {
  const na = a.replace(/\D/g, "").padStart(6, "0");
  const nb = b.replace(/\D/g, "").padStart(6, "0");
  return na.localeCompare(nb);
}

function validRange(start: string, end: string): boolean {
  if (!start || !end) return true;
  return ymOrder(start, end) <= 0;
}

function normalizeFromProfile(profile: Record<string, unknown>): ResumeForm {
  const base = defaultForm();
  const rf = asRecord(profile.resume_form);
  const r = Object.keys(rf).length > 0 ? rf : profile;
  const p = asRecord(r.personal ?? profile.personal ?? profile.basic_info);
  if (Object.keys(p).length > 0) {
    base.personal = {
      full_name: asText(p.full_name ?? p.name),
      gender: asText(p.gender),
      birth_ym: asText(p.birth_ym),
      phone: asText(p.phone ?? p.tel),
      email: asText(p.email),
    };
  }

  const pickArr = <T,>(v: unknown, map: (o: Record<string, unknown>) => T, one: () => T): T[] => {
    if (!Array.isArray(v) || v.length === 0) return [one()];
    return v.map((item) =>
      item && typeof item === "object" ? map(item as Record<string, unknown>) : one()
    );
  };
  base.education = ensureRows(
    pickArr(
      r.education,
      (o) => ({
        school: asText(o.school),
        major: asText(o.major ?? o.research),
        level: EDU_LEVELS.includes(o.level as (typeof EDU_LEVELS)[number])
          ? (o.level as string)
          : "本科",
        start_ym: asText(o.start_ym),
        end_ym: asText(o.end_ym),
      }),
      emptyEducation
    ),
    emptyEducation
  );
  base.projects = ensureRows(
    pickArr(
      r.projects,
      (o) => ({
        name: asText(o.name),
        start_ym: asText(o.start_ym),
        end_ym: asText(o.end_ym),
        role: asText(o.role),
        summary: asText(o.summary ?? o.intro),
        work: asText(o.work),
      }),
      emptyProject
    ),
    emptyProject
  );
  base.internships = ensureRows(
    pickArr(
      r.internships,
      (o) => ({
        company: asText(o.company),
        position: asText(o.position),
        start_ym: asText(o.start_ym),
        end_ym: asText(o.end_ym),
        work: asText(o.work),
      }),
      emptyInternship
    ),
    emptyInternship
  );
  base.awards = ensureRows(
    pickArr(
      r.awards,
      (o) => ({
        name: asText(o.name),
        level: asText(o.level),
        award_ym: asText(o.award_ym),
      }),
      emptyAward
    ),
    emptyAward
  );
  base.languages = ensureRows(
    pickArr(
      r.languages,
      (o) => ({
        lang: asText(o.lang ?? o.language),
        proficiency: LANG_LEVELS.includes(o.proficiency as (typeof LANG_LEVELS)[number])
          ? (o.proficiency as string)
          : "日常沟通",
      }),
      emptyLanguage
    ),
    emptyLanguage
  );
  base.skills = ensureRows(
    pickArr(
      r.skills,
      (o) => {
        if (typeof o.name === "string" || typeof o.level === "string") {
          return { name: asText(o.name), level: asText(o.level) };
        }
        return { name: asText(o.skill ?? o), level: "" };
      },
      emptySkill
    ),
    emptySkill
  );
  return base;
}

export default function Resume() {
  const [form, setForm] = useState<ResumeForm>(() => defaultForm());
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showGen, setShowGen] = useState(false);
  const [targetCompany, setTargetCompany] = useState("");
  const [targetPosition, setTargetPosition] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyTitle, setBusyTitle] = useState("请稍候");

  useEffect(() => {
    (async () => {
      setBusy(true);
      setBusyTitle("正在加载档案…");
      try {
        const { data } = await api.get("/profile");
        setForm(normalizeFromProfile((data.profile ?? {}) as Record<string, unknown>));
      } catch {
        setErr("加载档案失败");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const rangeErrors = useMemo(() => {
    const errs: string[] = [];
    form.education.forEach((e, i) => {
      if (!validRange(e.start_ym, e.end_ym)) errs.push(`教育经历 #${i + 1}：结束年月不能早于开始年月`);
    });
    form.projects.forEach((e, i) => {
      if (!validRange(e.start_ym, e.end_ym)) errs.push(`项目经历 #${i + 1}：结束年月不能早于开始年月`);
    });
    form.internships.forEach((e, i) => {
      if (!validRange(e.start_ym, e.end_ym)) errs.push(`实习经历 #${i + 1}：结束年月不能早于开始年月`);
    });
    return errs;
  }, [form]);

  function setPersonal(p: Partial<Personal>) {
    setForm((f) => ({ ...f, personal: { ...f.personal, ...p } }));
  }

  async function saveForm(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (rangeErrors.length) {
      setErr(rangeErrors[0]);
      return;
    }
    setBusy(true);
    setBusyTitle("正在保存…");
    try {
      await api.put("/profile", { resume_form: form });
      setMsg("已保存，下次进入本页面将自动加载。");
    } catch {
      setErr("保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function uploadDoc(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!file) {
      setErr("请选择文件");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    setBusyTitle("正在上传并解析文档…");
    try {
      const { data } = await api.post("/resume/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const merged = (data.parsed_preview ?? {}) as Record<string, unknown>;
      setForm(normalizeFromProfile(merged));
      setMsg("上传并解析成功，已填入表单（可与原内容合并核对）");
    } catch {
      setErr("上传或解析失败");
    } finally {
      setBusy(false);
    }
  }

  async function genPdf(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const pos = targetPosition.trim();
    if (!pos) {
      setErr("请填写投递的岗位");
      return;
    }
    if (rangeErrors.length) {
      setErr(rangeErrors[0]);
      return;
    }
    setBusy(true);
    setBusyTitle("正在生成 PDF…");
    try {
      await api.put("/profile", { resume_form: form });
      const res = await api.post(
        "/resume/generate-pdf",
        {
          job_role: "custom",
          target_company: targetCompany.trim(),
          target_position: pos,
        },
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("已开始下载 PDF");
      setShowGen(false);
    } catch {
      setErr("生成失败（请先保存填写内容）");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-resume">
      <LoadingOverlay open={busy} title={busyTitle} />
      <h1>在线简历生成</h1>
      <p className="muted">
        可直接填写下列信息，或上传 pdf / docx / pptx / txt 由系统解析后填入对应栏位。
      </p>

      <div className="card">
        <h3>上传文档解析</h3>
        <p className="muted">支持 pdf、docx、pptx、txt，解析结果将合并进下方表单。</p>
        <form onSubmit={uploadDoc} className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <input
            type="file"
            accept=".pdf,.docx,.pptx,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ maxWidth: 280 }}
          />
          <button type="submit">上传并解析</button>
        </form>
      </div>

      <form onSubmit={saveForm}>
        <div className="card">
          <h3>个人信息</h3>
          <div className="form-grid-2">
            <div>
              <label>用户姓名</label>
              <input
                value={form.personal.full_name}
                onChange={(e) => setPersonal({ full_name: e.target.value })}
              />
            </div>
            <div>
              <label>性别</label>
              <input
                value={form.personal.gender}
                onChange={(e) => setPersonal({ gender: e.target.value })}
                placeholder="男 / 女"
              />
            </div>
            <div>
              <label>出生年月</label>
              <input
                type="month"
                value={form.personal.birth_ym}
                onChange={(e) => setPersonal({ birth_ym: e.target.value })}
              />
            </div>
            <div>
              <label>联系电话</label>
              <input
                value={form.personal.phone}
                onChange={(e) => setPersonal({ phone: e.target.value })}
              />
            </div>
            <div className="form-span-2">
              <label>电子邮箱</label>
              <input
                type="email"
                value={form.personal.email}
                onChange={(e) => setPersonal({ email: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3>教育经历</h3>
          {form.education.map((row, idx) => (
            <div key={idx} className="repeat-block">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>记录 {idx + 1}</strong>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      education: f.education.filter((_, i) => i !== idx),
                    }))
                  }
                  disabled={form.education.length <= 1}
                >
                  删除
                </button>
              </div>
              <div className="form-grid-2">
                <div>
                  <label>就读学校</label>
                  <input
                    value={row.school}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.education];
                        next[idx] = { ...next[idx], school: v };
                        return { ...f, education: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>研究方向 / 专业</label>
                  <input
                    value={row.major}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.education];
                        next[idx] = { ...next[idx], major: v };
                        return { ...f, education: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>层次</label>
                  <select
                    value={row.level}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.education];
                        next[idx] = { ...next[idx], level: v };
                        return { ...f, education: next };
                      });
                    }}
                  >
                    {EDU_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div />
                <div>
                  <label>开始年月</label>
                  <input
                    type="month"
                    value={row.start_ym}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.education];
                        next[idx] = { ...next[idx], start_ym: v };
                        return { ...f, education: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>结束年月</label>
                  <input
                    type="month"
                    value={row.end_ym}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.education];
                        next[idx] = { ...next[idx], end_ym: v };
                        return { ...f, education: next };
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() => setForm((f) => ({ ...f, education: [...f.education, emptyEducation()] }))}
          >
            添加教育经历
          </button>
        </div>

        <div className="card">
          <h3>项目经历</h3>
          {form.projects.map((row, idx) => (
            <div key={idx} className="repeat-block">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>记录 {idx + 1}</strong>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      projects: f.projects.filter((_, i) => i !== idx),
                    }))
                  }
                  disabled={form.projects.length <= 1}
                >
                  删除
                </button>
              </div>
              <label>项目名称</label>
              <input
                value={row.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => {
                    const next = [...f.projects];
                    next[idx] = { ...next[idx], name: v };
                    return { ...f, projects: next };
                  });
                }}
              />
              <div className="form-grid-2">
                <div>
                  <label>开始年月</label>
                  <input
                    type="month"
                    value={row.start_ym}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.projects];
                        next[idx] = { ...next[idx], start_ym: v };
                        return { ...f, projects: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>结束年月</label>
                  <input
                    type="month"
                    value={row.end_ym}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.projects];
                        next[idx] = { ...next[idx], end_ym: v };
                        return { ...f, projects: next };
                      });
                    }}
                  />
                </div>
              </div>
              <label>担任角色</label>
              <input
                value={row.role}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => {
                    const next = [...f.projects];
                    next[idx] = { ...next[idx], role: v };
                    return { ...f, projects: next };
                  });
                }}
              />
              <label>项目简介</label>
              <textarea
                value={row.summary}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => {
                    const next = [...f.projects];
                    next[idx] = { ...next[idx], summary: v };
                    return { ...f, projects: next };
                  });
                }}
                rows={3}
              />
              <label>完成的工作</label>
              <textarea
                value={row.work}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => {
                    const next = [...f.projects];
                    next[idx] = { ...next[idx], work: v };
                    return { ...f, projects: next };
                  });
                }}
                rows={3}
              />
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() => setForm((f) => ({ ...f, projects: [...f.projects, emptyProject()] }))}
          >
            添加项目经历
          </button>
        </div>

        <div className="card">
          <h3>实习经历</h3>
          {form.internships.map((row, idx) => (
            <div key={idx} className="repeat-block">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>记录 {idx + 1}</strong>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      internships: f.internships.filter((_, i) => i !== idx),
                    }))
                  }
                  disabled={form.internships.length <= 1}
                >
                  删除
                </button>
              </div>
              <div className="form-grid-2">
                <div>
                  <label>实习公司</label>
                  <input
                    value={row.company}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.internships];
                        next[idx] = { ...next[idx], company: v };
                        return { ...f, internships: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>实习岗位</label>
                  <input
                    value={row.position}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.internships];
                        next[idx] = { ...next[idx], position: v };
                        return { ...f, internships: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>开始年月</label>
                  <input
                    type="month"
                    value={row.start_ym}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.internships];
                        next[idx] = { ...next[idx], start_ym: v };
                        return { ...f, internships: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>结束年月</label>
                  <input
                    type="month"
                    value={row.end_ym}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.internships];
                        next[idx] = { ...next[idx], end_ym: v };
                        return { ...f, internships: next };
                      });
                    }}
                  />
                </div>
              </div>
              <label>完成的工作</label>
              <textarea
                value={row.work}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => {
                    const next = [...f.internships];
                    next[idx] = { ...next[idx], work: v };
                    return { ...f, internships: next };
                  });
                }}
                rows={4}
              />
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setForm((f) => ({ ...f, internships: [...f.internships, emptyInternship()] }))
            }
          >
            添加实习经历
          </button>
        </div>

        <div className="card">
          <h3>获奖经历</h3>
          {form.awards.map((row, idx) => (
            <div key={idx} className="repeat-block">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>记录 {idx + 1}</strong>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      awards: f.awards.filter((_, i) => i !== idx),
                    }))
                  }
                  disabled={form.awards.length <= 1}
                >
                  删除
                </button>
              </div>
              <div className="form-grid-2">
                <div>
                  <label>奖项名称</label>
                  <input
                    value={row.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.awards];
                        next[idx] = { ...next[idx], name: v };
                        return { ...f, awards: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>奖项等级</label>
                  <input
                    value={row.level}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.awards];
                        next[idx] = { ...next[idx], level: v };
                        return { ...f, awards: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>获奖日期（年月）</label>
                  <input
                    type="month"
                    value={row.award_ym}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.awards];
                        next[idx] = { ...next[idx], award_ym: v };
                        return { ...f, awards: next };
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() => setForm((f) => ({ ...f, awards: [...f.awards, emptyAward()] }))}
          >
            添加获奖经历
          </button>
        </div>

        <div className="card">
          <h3>外语水平</h3>
          {form.languages.map((row, idx) => (
            <div key={idx} className="repeat-block">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>记录 {idx + 1}</strong>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      languages: f.languages.filter((_, i) => i !== idx),
                    }))
                  }
                  disabled={form.languages.length <= 1}
                >
                  删除
                </button>
              </div>
              <div className="form-grid-2">
                <div>
                  <label>语种</label>
                  <input
                    value={row.lang}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.languages];
                        next[idx] = { ...next[idx], lang: v };
                        return { ...f, languages: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>掌握程度</label>
                  <select
                    value={row.proficiency}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.languages];
                        next[idx] = { ...next[idx], proficiency: v };
                        return { ...f, languages: next };
                      });
                    }}
                  >
                    {LANG_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setForm((f) => ({ ...f, languages: [...f.languages, emptyLanguage()] }))
            }
          >
            添加外语记录
          </button>
        </div>

        <div className="card">
          <h3>技能水平</h3>
          {form.skills.map((row, idx) => (
            <div key={idx} className="repeat-block">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>记录 {idx + 1}</strong>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      skills: f.skills.filter((_, i) => i !== idx),
                    }))
                  }
                  disabled={form.skills.length <= 1}
                >
                  删除
                </button>
              </div>
              <div className="form-grid-2">
                <div>
                  <label>技能名称</label>
                  <input
                    value={row.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.skills];
                        next[idx] = { ...next[idx], name: v };
                        return { ...f, skills: next };
                      });
                    }}
                  />
                </div>
                <div>
                  <label>掌握程度</label>
                  <input
                    value={row.level}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => {
                        const next = [...f.skills];
                        next[idx] = { ...next[idx], level: v };
                        return { ...f, skills: next };
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() => setForm((f) => ({ ...f, skills: [...f.skills, emptySkill()] }))}
          >
            添加技能
          </button>
        </div>

        <div className="row">
          <button type="submit">保存</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setErr(null);
              setShowGen(true);
            }}
          >
            生成简历
          </button>
        </div>
      </form>

      {showGen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card card">
            <h3 style={{ marginTop: 0 }}>生成 PDF 简历</h3>
            <p className="muted">将结合已保存的档案与目标公司与岗位，由模型生成版式清晰的 PDF。</p>
            <form onSubmit={genPdf}>
              <label>要求职的公司</label>
              <input value={targetCompany} onChange={(e) => setTargetCompany(e.target.value)} />
              <div className="space-sm" />
              <label>投递的岗位</label>
              <input
                value={targetPosition}
                onChange={(e) => setTargetPosition(e.target.value)}
                required
              />
              <div className="row" style={{ marginTop: 16 }}>
                <button type="submit">生成</button>
                <button type="button" className="secondary" onClick={() => setShowGen(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {msg && <p className="muted">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
