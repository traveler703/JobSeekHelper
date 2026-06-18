import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "/Users/renhongzhen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const ROOT = "/Users/renhongzhen/专业方向综合项目/项目";
const TMP = "/private/tmp/codex-presentations/jobseek-defense/tmp";
const OUT = path.join(ROOT, "outputs", "JobSeekHelper_期末项目答辩.pptx");
const COVER = path.join(TMP, "template-inspect", "source-slides", "source-slide-01.png");

const W = 1280;
const H = 720;
const C = {
  rose: "#BC6A72",
  roseDark: "#9B4D57",
  rosePale: "#F8E7EA",
  ink: "#263142",
  muted: "#6F7685",
  paper: "#FFF9F7",
  line: "#E7CCD0",
  blue: "#1E3A5F",
  green: "#4E7D68",
  gold: "#C4944A",
  white: "#FFFFFF",
};

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

function addShape(slide, geometry, position, fill, line = { style: "solid", fill: "none", width: 0 }, extra = {}) {
  return slide.shapes.add({ geometry, position, fill, line, ...extra });
}

function addText(slide, text, position, style = {}) {
  const s = addShape(slide, "textbox", position, "none");
  s.text = text;
  s.text.style = {
    typeface: "黑体",
    fontSize: 24,
    color: C.ink,
    ...style,
  };
  return s;
}

function addTitle(slide, title, subtitle = "") {
  addText(slide, title, { left: 86, top: 62, width: 760, height: 56 }, {
    fontSize: 34,
    bold: true,
    color: C.roseDark,
  });
  addShape(slide, "rect", { left: 86, top: 126, width: 96, height: 4 }, C.roseDark);
  if (subtitle) {
    addText(slide, subtitle, { left: 202, top: 114, width: 820, height: 34 }, {
      fontSize: 15,
      color: C.muted,
    });
  }
  addPetals(slide);
  addFooter(slide);
}

function addFooter(slide) {
  addText(slide, "JobSeekHelper · 大学生求职助手系统", { left: 86, top: 666, width: 520, height: 24 }, {
    fontSize: 12,
    color: "#A98389",
  });
}

function addPetals(slide) {
  for (const p of [
    [1140, 44, 16, 8, -24],
    [1188, 92, 22, 10, 18],
    [1108, 128, 13, 7, 35],
    [1216, 172, 18, 8, -12],
  ]) {
    const [left, top, width, height, rotation] = p;
    addShape(slide, "ellipse", { left, top, width, height }, "#F2B8C3", { style: "solid", fill: "#F2B8C3", width: 0 }, { rotation });
  }
}

function contentSlide(presentation, title, subtitle = "") {
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  addShape(slide, "rect", { left: 0, top: 0, width: W, height: 18 }, C.rose);
  addShape(slide, "rect", { left: 0, top: 18, width: W, height: 1.5 }, C.line);
  addTitle(slide, title, subtitle);
  return slide;
}

function sectionSlide(presentation, no, title, subtitle) {
  const slide = presentation.slides.add();
  slide.background.fill = C.rose;
  return fs.readFile(COVER).then((img) => {
    slide.images.add({
      blob: img,
      contentType: "image/png",
      alt: "樱花模板背景",
      fit: "cover",
      position: { left: 0, top: 0, width: W, height: H },
    });
    addShape(slide, "rect", { left: 640, top: 0, width: W - 640, height: H }, { color: "#000000", transparency: 35000 });
    addShape(slide, "rect", { left: 0, top: 0, width: 640, height: H }, C.rose);
    addText(slide, `0${no}`, { left: 86, top: 145, width: 160, height: 72 }, {
      fontSize: 58,
      bold: true,
      color: C.white,
    });
    addShape(slide, "rect", { left: 88, top: 234, width: 90, height: 5 }, C.white);
    addText(slide, title, { left: 86, top: 270, width: 470, height: 72 }, {
      fontSize: 42,
      bold: true,
      color: C.white,
    });
    addText(slide, subtitle, { left: 90, top: 358, width: 500, height: 72 }, {
      fontSize: 22,
      color: C.white,
    });
    return slide;
  });
}

function bullets(slide, items, x, y, width, opts = {}) {
  const { fontSize = 20, gap = 50, color = C.ink, dot = C.rose } = opts;
  items.forEach((item, i) => {
    const top = y + i * gap;
    addShape(slide, "ellipse", { left: x, top: top + 8, width: 10, height: 10 }, dot);
    addText(slide, item, { left: x + 24, top, width, height: gap - 6 }, {
      fontSize,
      color,
    });
  });
}

function card(slide, x, y, w, h, title, body, accent = C.rose) {
  addShape(slide, "roundRect", { left: x, top: y, width: w, height: h }, C.white, {
    style: "solid", fill: C.line, width: 1,
  }, { borderRadius: "rounded-lg" });
  addShape(slide, "rect", { left: x, top: y, width: 8, height: h }, accent);
  addText(slide, title, { left: x + 24, top: y + 20, width: w - 44, height: 30 }, {
    fontSize: 21,
    bold: true,
    color: accent,
  });
  addText(slide, body, { left: x + 24, top: y + 62, width: w - 44, height: h - 76 }, {
    fontSize: 16,
    color: C.ink,
  });
}

function node(slide, label, x, y, w, h, fill, textColor = C.white) {
  addShape(slide, "roundRect", { left: x, top: y, width: w, height: h }, fill, {
    style: "solid", fill: fill, width: 1,
  }, { borderRadius: "rounded-lg" });
  addText(slide, label, { left: x + 8, top: y + h / 2 - 14, width: w - 16, height: 32 }, {
    fontSize: 17,
    bold: true,
    color: textColor,
    alignment: "center",
  });
}

function arrow(slide, x1, y1, x2, y2, color = C.roseDark) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  addShape(slide, "rect", { left: x1, top: y1 - 1.5, width: Math.max(1, len - 12), height: 3 }, color, { style: "solid", fill: color, width: 0 }, { rotation: angle });
  addShape(slide, "triangle", { left: x2 - 13, top: y2 - 7, width: 16, height: 14 }, color, { style: "solid", fill: color, width: 0 }, { rotation: angle + 90 });
}

async function main() {
  await fs.mkdir(path.join(ROOT, "outputs"), { recursive: true });
  await fs.mkdir(path.join(TMP, "preview"), { recursive: true });
  await fs.mkdir(path.join(TMP, "layout"), { recursive: true });
  await fs.mkdir(path.join(TMP, "qa"), { recursive: true });

  await fs.writeFile(path.join(TMP, "source-notes.txt"), [
    "Sources used:",
    "1. Project README.md and local source code under backend/app and frontend/src.",
    "2. User-provided PPT template: 翩然樱花PPT模版.pptx. Artifact-tool rendering succeeded for the first source slide and failed on subsequent template inspection with a canvas downcast error; the rendered first-slide visual was reused as a template-derived background on cover/section/closing slides.",
    "3. Generated architecture and flow diagrams are editable PowerPoint shapes created from inspected project implementation.",
  ].join("\n"));

  await fs.writeFile(path.join(TMP, "slide-plan.txt"), [
    "Deck: JobSeekHelper final defense presentation.",
    "Visual direction: sakura-campus style derived from the provided template; rose dominant palette with paper background, deep ink text, and soft line work.",
    "Slide list: cover, agenda, background/goals, overall architecture, tech stack, data/storage, resume module, knowledge/RAG, interview WebSocket, speech/fluency, evaluation, demo route, highlights, limitations/roadmap, closing.",
  ].join("\n"));

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const coverImg = await fs.readFile(COVER);

  // 1 cover
  {
    const slide = presentation.slides.add();
    slide.images.add({ blob: coverImg, contentType: "image/png", alt: "樱花模板背景", fit: "cover", position: { left: 0, top: 0, width: W, height: H } });
    addShape(slide, "rect", { left: 0, top: 0, width: 640, height: H }, C.rose);
    addText(slide, "JobSeekHelper", { left: 96, top: 168, width: 520, height: 62 }, { fontSize: 46, bold: true, color: C.white });
    addText(slide, "大学生求职助手系统", { left: 96, top: 242, width: 520, height: 64 }, { fontSize: 36, bold: true, color: C.white });
    addText(slide, "期末项目答辩", { left: 100, top: 326, width: 380, height: 34 }, { fontSize: 22, color: C.white });
    addShape(slide, "roundRect", { left: 96, top: 504, width: 340, height: 86 }, { color: "#FFFFFF", transparency: 70000 }, { style: "solid", fill: "none", width: 0 }, { borderRadius: "rounded-2xl" });
    addText(slide, "汇报人：XXX\n2026年6月", { left: 124, top: 520, width: 290, height: 56 }, { fontSize: 22, color: C.white });
  }

  // 2 agenda
  {
    const slide = contentSlide(presentation, "答辩内容目录", "围绕系统设计、核心实现与演示路线展开");
    const items = ["项目背景与目标", "系统架构与技术栈", "核心功能模块实现", "关键流程与数据设计", "系统特色、演示与展望"];
    items.forEach((it, i) => {
      const y = 180 + i * 82;
      addText(slide, `0${i + 1}`, { left: 120, top: y, width: 70, height: 48 }, { fontSize: 30, bold: true, color: C.roseDark });
      addShape(slide, "rect", { left: 205, top: y + 20, width: 620, height: 1.5 }, C.line);
      addText(slide, it, { left: 850, top: y + 3, width: 310, height: 44 }, { fontSize: 24, bold: true, color: C.ink });
    });
  }

  // 3 background
  {
    const slide = contentSlide(presentation, "项目背景与建设目标", "面向大学生求职准备的真实痛点");
    card(slide, 86, 176, 330, 320, "求职准备痛点", "简历不会突出岗位匹配度；专业资料复习分散；缺少接近真实流程的面试训练。", C.roseDark);
    card(slide, 476, 176, 330, 320, "系统定位", "把简历优化、岗位知识准备、模拟面试和反馈评价整合到同一个平台中。", C.blue);
    card(slide, 866, 176, 330, 320, "目标用户", "面向准备实习、校招和课程实践答辩的大学生，强调本地可运行和可演示。", C.green);
    bullets(slide, ["建立个人求职档案", "基于岗位生成简历", "用个人知识库驱动面试", "输出可操作改进建议"], 126, 545, 1000, { fontSize: 19, gap: 34 });
  }

  // 4 architecture
  {
    const slide = contentSlide(presentation, "系统整体架构", "前后端分离 + AI 服务 + 本地数据存储");
    node(slide, "React / TypeScript / Vite", 92, 195, 250, 72, C.roseDark);
    node(slide, "Axios REST API", 92, 320, 250, 60, "#D9919A");
    node(slide, "WebSocket 实时面试", 92, 420, 250, 60, "#D9919A");
    node(slide, "FastAPI 应用层", 478, 190, 260, 72, C.blue);
    node(slide, "Auth / Profile / Resume", 478, 308, 260, 58, "#52749E");
    node(slide, "Knowledge / Interview", 478, 400, 260, 58, "#52749E");
    node(slide, "DeepSeek LLM", 900, 150, 230, 58, C.roseDark);
    node(slide, "Chroma 向量库", 900, 246, 230, 58, C.green);
    node(slide, "SQLite 数据库", 900, 342, 230, 58, C.gold);
    node(slide, "本地文件存储", 900, 438, 230, 58, "#7D6F8E");
    arrow(slide, 350, 230, 470, 230);
    arrow(slide, 350, 350, 470, 335);
    arrow(slide, 350, 450, 470, 430);
    arrow(slide, 746, 225, 892, 180);
    arrow(slide, 746, 332, 892, 275, C.green);
    arrow(slide, 746, 430, 892, 372, C.gold);
    arrow(slide, 746, 455, 892, 466, "#7D6F8E");
    addText(slide, "核心闭环：简历档案 + 岗位目标 + 个人知识库 → 多轮面试 → 结构化评价", { left: 154, top: 566, width: 970, height: 36 }, { fontSize: 22, bold: true, color: C.roseDark, alignment: "center" });
  }

  await sectionSlide(presentation, 2, "核心功能模块", "从简历准备到面试评价的完整求职训练流程");

  // 6 tech stack
  {
    const slide = contentSlide(presentation, "技术栈与模块划分", "围绕快速开发、AI 集成和本地演示选择技术");
    const cols = [
      ["前端", "React 18\nTypeScript\nReact Router\nAxios\nVite"],
      ["后端", "FastAPI\nSQLAlchemy\nPydantic\nJWT 鉴权\nWebSocket"],
      ["AI 与数据", "DeepSeek API\nChromaDB\nsentence-transformers\nSQLite\nReportLab"],
      ["文档与语音", "pypdf\npython-docx\npython-pptx\nedge-tts\nWeb Speech API"],
    ];
    cols.forEach(([t, b], i) => card(slide, 86 + i * 296, 178, 250, 330, t, b, [C.roseDark, C.blue, C.green, C.gold][i]));
    addText(slide, "特点：技术组合轻量，便于课程项目部署；同时保留 AI、RAG、语音与 PDF 生成等完整能力。", { left: 112, top: 560, width: 1050, height: 54 }, { fontSize: 21, bold: true, color: C.ink, alignment: "center" });
  }

  // 7 data model
  {
    const slide = contentSlide(presentation, "数据模型与存储设计", "按用户维度隔离简历、资料、考点与面试记录");
    node(slide, "users\n账号信息", 100, 290, 160, 72, C.roseDark);
    node(slide, "resume_profiles\n简历档案 JSON", 360, 160, 220, 78, C.blue);
    node(slide, "knowledge_documents\n资料元数据", 360, 290, 220, 78, C.green);
    node(slide, "knowledge_points\n常见考点", 670, 290, 210, 78, C.green);
    node(slide, "interview_sessions\n面试记录与评价", 360, 420, 240, 78, C.gold);
    node(slide, "storage/uploads\nstorage/knowledge\nstorage/chroma", 940, 310, 220, 100, "#7D6F8E");
    arrow(slide, 270, 326, 352, 200, C.blue);
    arrow(slide, 270, 326, 352, 326, C.green);
    arrow(slide, 588, 326, 662, 326, C.green);
    arrow(slide, 270, 326, 352, 458, C.gold);
    arrow(slide, 885, 328, 932, 358, "#7D6F8E");
    bullets(slide, ["SQLite 保存结构化业务数据", "本地文件系统保存原始文档与生成 PDF", "Chroma 持久化个人知识库向量块"], 128, 555, 1000, { fontSize: 19, gap: 34 });
  }

  // 8 resume module
  {
    const slide = contentSlide(presentation, "在线简历生成模块", "上传解析、在线维护与岗位化 PDF 生成");
    const steps = [
      ["上传/填写", "pdf、docx、pptx、txt 或表单录入"],
      ["文本提取", "pypdf / docx / pptx 解析正文"],
      ["LLM 解析", "输出结构化 resume_form"],
      ["档案合并", "归一化并过滤默认空记录"],
      ["PDF 生成", "结合目标公司和岗位重组内容"],
    ];
    steps.forEach(([t, b], i) => {
      const x = 84 + i * 230;
      node(slide, t, x, 238, 180, 64, [C.roseDark, C.blue, C.green, C.gold, "#7D6F8E"][i]);
      addText(slide, b, { left: x, top: 320, width: 180, height: 70 }, { fontSize: 15, color: C.muted, alignment: "center" });
      if (i < steps.length - 1) arrow(slide, x + 186, 270, x + 222, 270);
    });
    card(slide, 190, 470, 900, 86, "答辩强调", "简历生成不是简单模板填充，而是先形成个人档案，再根据目标公司和目标岗位重新组织表达，突出岗位匹配度。", C.roseDark);
  }

  // 9 knowledge/RAG
  {
    const slide = contentSlide(presentation, "知识库管理与 RAG 检索", "把用户上传资料转化为可被面试调用的个人知识库");
    node(slide, "资料上传", 96, 230, 150, 58, C.roseDark);
    node(slide, "文本提取", 300, 230, 150, 58, C.blue);
    node(slide, "分块", 504, 230, 150, 58, C.gold);
    node(slide, "向量化", 708, 230, 150, 58, C.green);
    node(slide, "Chroma", 912, 230, 150, 58, "#7D6F8E");
    node(slide, "面试检索", 708, 420, 150, 58, C.green);
    node(slide, "生成问题", 912, 420, 150, 58, C.roseDark);
    [246, 450, 654, 858].forEach((x) => arrow(slide, x, 259, x + 46, 259));
    arrow(slide, 988, 292, 792, 414, "#7D6F8E");
    arrow(slide, 862, 449, 904, 449);
    card(slide, 116, 396, 430, 126, "常见考点", "上传完成后，系统会调用 LLM 基于资料生成 12-20 项常见考点，前端以随机翻转卡片展示。", C.green);
  }

  // 10 interview
  {
    const slide = contentSlide(presentation, "模拟面试 WebSocket 流程", "全屏、连续、多轮、可追踪的面试体验");
    const steps = [
      ["start", "创建面试会话\n读取简历档案"],
      ["question", "结合岗位、简历\n和 RAG 生成题目"],
      ["answer", "记录文本和\n字符时间序列"],
      ["next/end", "继续追问或\n生成最终评价"],
    ];
    steps.forEach(([t, b], i) => {
      const x = 120 + i * 280;
      node(slide, t, x, 205, 190, 70, [C.roseDark, C.blue, C.green, C.gold][i]);
      addText(slide, b, { left: x, top: 296, width: 190, height: 74 }, { fontSize: 17, color: C.ink, alignment: "center" });
      if (i < steps.length - 1) arrow(slide, x + 198, 240, x + 270, 240);
    });
    bullets(slide, ["进入全屏后启动面试，切换标签页、离开页面或退出全屏会触发结束", "支持主动结束、系统判定结束和时长/覆盖度结束", "历史记录保存完整对话、评价结果与结束原因"], 150, 464, 980, { fontSize: 20, gap: 42, dot: C.roseDark });
  }

  // 11 speech
  {
    const slide = contentSlide(presentation, "语音交互与回答熟练度", "除了内容正确性，也关注真实表达过程");
    card(slide, 96, 180, 330, 270, "题目播报", "优先使用 edge-tts 生成中文神经语音 MP3；异常时回退到浏览器 speechSynthesis。", C.roseDark);
    card(slide, 476, 180, 330, 270, "语音听写", "前端调用 Web Speech API，识别结果可继续手动编辑后提交。", C.blue);
    card(slide, 856, 180, 330, 270, "熟练度指标", "记录字符时间序列，统计首词延迟、最长卡顿、卡壳次数、填充词比例和核心语速。", C.green);
    addText(slide, "评价时把 answer_metrics 与用户回答一起输入 LLM，但要求其只用于表达熟练度，不替代知识正确性判断。", { left: 130, top: 530, width: 1020, height: 60 }, { fontSize: 22, bold: true, color: C.roseDark, alignment: "center" });
  }

  // 12 evaluation
  {
    const slide = contentSlide(presentation, "面试评价与反馈结果", "结构化输出，便于学生复盘");
    const metrics = [
      ["知识掌握", "1-10 分"],
      ["项目深度", "1-10 分"],
      ["熟练程度", "1-10 分"],
    ];
    metrics.forEach(([m, s], i) => {
      addShape(slide, "ellipse", { left: 160 + i * 310, top: 180, width: 180, height: 180 }, [C.roseDark, C.blue, C.green][i]);
      addText(slide, m, { left: 170 + i * 310, top: 226, width: 160, height: 40 }, { fontSize: 24, bold: true, color: C.white, alignment: "center" });
      addText(slide, s, { left: 170 + i * 310, top: 276, width: 160, height: 34 }, { fontSize: 20, color: C.white, alignment: "center" });
    });
    bullets(slide, ["总评：概括整体表现与依据", "亮点：仅引用用户实际回答中可核实的信息", "不足：指出未作答、表达空泛或知识缺口", "建议：给出后续学习与练习方向"], 210, 440, 820, { fontSize: 20, gap: 36 });
  }

  await sectionSlide(presentation, 3, "演示与总结", "现场演示路线、项目亮点和后续改进方向");

  // 14 demo route + highlights
  {
    const slide = contentSlide(presentation, "系统演示路线与项目亮点", "答辩现场可按闭环流程展示");
    const route = ["登录", "简历档案", "生成 PDF", "上传资料", "考点卡片", "模拟面试", "查看评价"];
    route.forEach((r, i) => {
      const x = 72 + i * 168;
      node(slide, r, x, 180, 132, 56, i % 2 ? C.blue : C.roseDark);
      if (i < route.length - 1) arrow(slide, x + 138, 208, x + 160, 208);
    });
    card(slide, 100, 330, 320, 170, "完整闭环", "简历准备、知识准备、面试训练、反馈评价相互联动。", C.roseDark);
    card(slide, 480, 330, 320, 170, "个人知识库", "RAG 检索用户上传资料，使问题更贴合个人复习内容。", C.green);
    card(slide, 860, 330, 320, 170, "真实面试感", "全屏、防切屏、语音播报、语音听写与流畅度统计。", C.blue);
  }

  // 15 closing
  {
    const slide = presentation.slides.add();
    slide.images.add({ blob: coverImg, contentType: "image/png", alt: "樱花模板背景", fit: "cover", position: { left: 0, top: 0, width: W, height: H } });
    addShape(slide, "rect", { left: 640, top: 0, width: W - 640, height: H }, { color: "#000000", transparency: 36000 });
    addShape(slide, "rect", { left: 0, top: 0, width: 640, height: H }, C.rose);
    addText(slide, "总结与展望", { left: 100, top: 120, width: 520, height: 70 }, { fontSize: 48, bold: true, color: C.white });
    addText(slide, "已完成：\n简历解析生成、知识库 RAG\n全屏模拟面试、语音交互\n结构化评价\n\n后续改进：\n生产级部署、安全加固\n数据库迁移、JD 上传、ATS 评分\n更细粒度评价标准", { left: 104, top: 236, width: 500, height: 250 }, { fontSize: 23, color: C.white });
    addShape(slide, "roundRect", { left: 100, top: 504, width: 300, height: 72 }, { color: "#FFFFFF", transparency: 73000 }, { style: "solid", fill: "none", width: 0 }, { borderRadius: "rounded-2xl" });
    addText(slide, "谢谢聆听", { left: 130, top: 520, width: 240, height: 38 }, { fontSize: 28, bold: true, color: C.white, alignment: "center" });
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(TMP, "preview", `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(TMP, "layout", `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(path.join(TMP, "preview", "deck-montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUT);
  await fs.writeFile(path.join(TMP, "qa", "visual-qa.txt"), "Rendered 15 slides to preview PNGs and montage. Created final editable PPTX with native text and shape diagrams; cover/section backgrounds reuse the template-derived render from the provided sakura PPT template.\n");
  console.log(OUT);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
