import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "/Users/renhongzhen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/@oai+artifact-tool@file+local-deps+-oai-artifact-tool-oai-artifact_tool-2.8.11.tgz/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const ROOT = "/Users/renhongzhen/专业方向综合项目/项目";
const OUT = path.join(ROOT, "outputs", "答辩素材");
const ASSETS = path.join(OUT, "assets");
const PREVIEW = path.join(OUT, "preview");
const QA = path.join(OUT, "qa");
const FINAL = path.join(OUT, "JobSeekHelper_期末项目答辩.pptx");

const W = 1280;
const H = 720;
const C = {
  blue: "#2563EB",
  blue2: "#38BDF8",
  navy: "#0F172A",
  text: "#172033",
  muted: "#64748B",
  bg: "#F8FAFC",
  pale: "#EAF2FF",
  card: "#FFFFFF",
  line: "#CBD5E1",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
};

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

function addShape(slide, geometry, position, fill = C.card, lineFill = C.line, radius = "rounded-xl") {
  const pos = { ...position };
  if (pos.width === 0) pos.width = 1;
  if (pos.height === 0) pos.height = 1;
  const config = {
    geometry,
    position: pos,
    fill,
    line: { style: "solid", fill: lineFill, width: lineFill === "none" ? 0 : 1 },
  };
  if (["rect", "textbox", "roundRect"].includes(geometry) && radius) {
    config.borderRadius = radius;
  }
  return slide.shapes.add(config);
}

function addText(slide, text, x, y, w, h, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: opts.size ?? 22,
    bold: opts.bold ?? false,
    color: opts.color ?? C.text,
    alignment: opts.align ?? "left",
  };
  return shape;
}

function addTitle(slide, title, kicker = "") {
  if (kicker) addText(slide, kicker, 72, 42, 520, 24, { size: 13, bold: true, color: C.blue });
  addText(slide, title, 72, 70, 850, 54, { size: 36, bold: true, color: C.navy });
  const bar = addShape(slide, "rect", { left: 72, top: 132, width: 96, height: 5 }, C.blue, "none", 0);
  return bar;
}

function footer(slide, n) {
  addText(slide, "JobSeekHelper · 专业综合项目期末答辩", 72, 682, 500, 18, {
    size: 11,
    color: "#94A3B8",
  });
  addText(slide, String(n).padStart(2, "0"), 1160, 676, 48, 24, {
    size: 14,
    bold: true,
    color: "#94A3B8",
    align: "right",
  });
}

function bullets(slide, items, x, y, w, h, opts = {}) {
  const text = items.map((it) => `• ${it}`).join("\n");
  return addText(slide, text, x, y, w, h, {
    size: opts.size ?? 21,
    color: opts.color ?? C.text,
  });
}

function card(slide, x, y, w, h, title, body, opts = {}) {
  addShape(slide, "roundRect", { left: x, top: y, width: w, height: h }, opts.fill ?? C.card, opts.line ?? C.line, "rounded-xl");
  const compact = h < 82;
  addText(slide, title, x + 22, y + (compact ? 10 : 18), w - 44, 28, { size: opts.titleSize ?? 21, bold: true, color: opts.titleColor ?? C.navy });
  addText(slide, body, x + 22, y + (compact ? 36 : 56), w - 44, Math.max(22, h - (compact ? 42 : 70)), { size: opts.bodySize ?? 17, color: opts.bodyColor ?? C.muted });
}

function arrow(slide, x, y, w = 60, h = 20, color = C.blue) {
  addShape(slide, "rightArrow", { left: x, top: y, width: w, height: h }, color, "none", 0);
}

async function addImage(slide, file, x, y, w, h, alt, fit = "cover", radius = "rounded-xl") {
  const blob = await fs.readFile(file);
  const config = {
    blob,
    contentType: "image/png",
    alt,
    fit,
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
  };
  if (radius) config.borderRadius = radius;
  slide.images.add(config);
}

function setNotes(slide, notes) {
  slide.speakerNotes.textFrame.setText(notes);
}

function bg(slide, fill = C.bg) {
  slide.background.fill = fill;
}

async function main() {
  await fs.mkdir(PREVIEW, { recursive: true });
  await fs.mkdir(QA, { recursive: true });

  const p = Presentation.create({ slideSize: { width: W, height: H } });

  // 1 Cover
  {
    const s = p.slides.add();
    bg(s, C.navy);
    await addImage(s, path.join(ASSETS, "cover-ai-jobseek.png"), 0, 0, W, H, "AI 求职助手封面图", "cover", 0);
    addShape(s, "rect", { left: 0, top: 0, width: 620, height: H }, C.navy, "none", 0);
    addText(s, "JobSeekHelper", 72, 128, 520, 72, { size: 56, bold: true, color: "#FFFFFF" });
    addText(s, "大学生求职助手系统", 74, 210, 500, 42, { size: 30, bold: true, color: "#DBEAFE" });
    addText(s, "面向简历优化、岗位知识准备与模拟面试训练的一体化 AI 求职辅助平台", 76, 288, 460, 96, { size: 23, color: "#E2E8F0" });
    card(s, 76, 448, 420, 116, "专业综合项目课程期末答辩", "React + FastAPI + SQLite + Chroma + DeepSeek", { fill: "#FFFFFF", line: "none", titleColor: C.navy, bodyColor: C.muted, bodySize: 17 });
    addText(s, "让求职准备从零散工具变成闭环训练", 78, 586, 500, 28, { size: 18, bold: true, color: "#BAE6FD" });
    setNotes(s, "本项目围绕大学生求职中的三个高频场景展开：简历准备、专业知识复习和模拟面试训练。系统把这些环节串联起来，形成一个从档案建立到面试评价的完整闭环。");
  }

  // 2 Background
  {
    const s = p.slides.add();
    bg(s);
    addTitle(s, "为什么要做这个项目", "选题背景");
    const items = [
      ["简历不会写", "经历有内容，但难以组织成适合目标岗位的表达。"],
      ["复习资料分散", "课程笔记、专业资料、岗位考点难以形成系统化准备。"],
      ["面试训练不足", "缺少连续追问、真实压力和事后反馈。"],
      ["工具割裂", "简历工具、资料管理、模拟问答往往彼此独立。"],
    ];
    items.forEach((it, i) => {
      const x = 92 + (i % 2) * 560;
      const y = 190 + Math.floor(i / 2) * 180;
      card(s, x, y, 500, 132, it[0], it[1], { titleSize: 25, bodySize: 20 });
    });
    addText(s, "项目切入点：把简历、知识准备和模拟面试整合成连续流程。", 100, 580, 1080, 40, { size: 24, bold: true, color: C.blue, align: "center" });
    footer(s, 2);
    setNotes(s, "大学生求职准备不是单点问题，而是一个连续过程。简历决定能否获得机会，知识准备决定面试内容质量，模拟训练决定表达效果。本项目的核心思路就是把这三个环节打通。");
  }

  // 3 Objectives
  {
    const s = p.slides.add();
    bg(s, "#F3F8FF");
    addTitle(s, "项目目标：构建 AI 驱动的求职训练闭环", "目标定位");
    const goals = [
      ["建立个人简历档案", "支持手动填写与文件解析"],
      ["生成针对性简历", "结合目标公司和岗位生成 PDF"],
      ["构建个人知识库", "上传专业资料并向量化"],
      ["开展模拟面试", "基于简历、岗位和知识库生成问题"],
      ["输出反馈评价", "综合回答内容与表达熟练度给出建议"],
    ];
    goals.forEach((g, i) => {
      const y = 176 + i * 82;
      addShape(s, "ellipse", { left: 96, top: y + 6, width: 46, height: 46 }, i === 4 ? C.green : C.blue, "none", 0);
      addText(s, String(i + 1), 96, y + 13, 46, 24, { size: 18, bold: true, color: "#FFFFFF", align: "center" });
      addText(s, g[0], 166, y, 360, 32, { size: 24, bold: true, color: C.navy });
      addText(s, g[1], 166, y + 36, 760, 28, { size: 19, color: C.muted });
    });
    addShape(s, "roundRect", { left: 865, top: 188, width: 260, height: 260 }, "#DBEAFE", "none", "rounded-full");
    addText(s, "档案\n知识\n训练\n反馈", 900, 254, 190, 150, { size: 32, bold: true, color: C.blue, align: "center" });
    footer(s, 3);
    setNotes(s, "系统不是简单地把几个页面放在一起，而是让每个模块产生的数据被后续模块继续使用。简历档案和知识库会影响面试提问，面试回答又会形成评价和历史记录。");
  }

  // 4 Overview Loop
  {
    const s = p.slides.add();
    bg(s);
    addTitle(s, "功能闭环：从资料输入到反馈输出", "系统总览");
    await addImage(s, path.join(ASSETS, "ai-jobseek-loop.png"), 660, 155, 500, 360, "AI 求职训练闭环示意图", "cover");
    bullets(s, [
      "账号与档案：注册登录、JWT 鉴权、用户数据隔离",
      "在线简历生成：上传解析、在线维护、岗位定制 PDF",
      "知识库管理：资料上传、文本分块、向量检索、考点整理",
      "模拟面试：全屏问答、语音播报、语音听写、防切屏",
      "评价反馈：知识掌握、项目深度、回答熟练度、学习建议",
    ], 92, 172, 520, 360, { size: 22 });
    card(s, 92, 548, 1068, 70, "一句话概括", "输入个人材料和专业资料，系统帮助用户进行面试前准备，并在训练后给出反馈。", { titleSize: 18, bodySize: 19, fill: "#EFF6FF", line: "#BFDBFE" });
    footer(s, 4);
    setNotes(s, "这一页可以作为后续模块讲解的目录。重点强调系统的主线是输入个人材料和专业资料，系统帮助用户进行面试前准备，并在训练后给出反馈。");
  }

  // 5 Tech stack
  {
    const s = p.slides.add();
    bg(s, "#F8FAFC");
    addTitle(s, "技术栈与选型", "技术实现");
    const cols = [
      ["前端", "React 18\nTypeScript\nVite\nReact Router\nAxios"],
      ["后端", "FastAPI\nSQLAlchemy\nPydantic\nWebSocket\nJWT"],
      ["AI 与 RAG", "DeepSeek API\nChromaDB\nsentence-transformers\nPrompt JSON 输出"],
      ["文档与语音", "pypdf / docx / pptx\nReportLab\nedge-tts\nWeb Speech API"],
    ];
    cols.forEach((c, i) => card(s, 76 + i * 292, 178, 260, 330, c[0], c[1], {
      fill: i === 2 ? "#EFF6FF" : C.card,
      line: i === 2 ? "#93C5FD" : C.line,
      titleColor: i === 2 ? C.blue : C.navy,
      titleSize: 25,
      bodySize: 21,
    }));
    addText(s, "存储：SQLite + 本地文件目录，适合课程项目演示部署；生产化可迁移到正式数据库与对象存储。", 92, 564, 1080, 52, { size: 22, color: C.text, align: "center" });
    footer(s, 5);
    setNotes(s, "选型上兼顾了实现效率和演示可靠性。FastAPI 适合快速构建接口和 WebSocket；React + TypeScript 方便实现复杂表单和交互；SQLite 与本地文件让项目能在本机稳定运行。");
  }

  // 6 Architecture
  {
    const s = p.slides.add();
    bg(s);
    addTitle(s, "系统总体架构", "架构设计");
    const layers = [
      ["表现层", "React 页面：登录注册 / 简历 / 知识库 / 模拟面试", "#DBEAFE"],
      ["接口层", "REST API 处理常规业务，WebSocket 处理实时面试", "#CCFBF1"],
      ["业务层", "简历解析、RAG 检索、面试出题、评价生成、PDF 生成", "#FEF3C7"],
      ["数据层", "SQLite、Chroma 向量库、本地上传文件与生成文件", "#DCFCE7"],
      ["外部服务", "DeepSeek 大模型、edge-tts 语音服务", "#FCE7F3"],
    ];
    layers.forEach((l, i) => {
      const y = 158 + i * 84;
      card(s, 130, y, 1020, 62, l[0], l[1], { fill: l[2], line: "none", titleSize: 20, bodySize: 18 });
      if (i < layers.length - 1) addShape(s, "downArrow", { left: 622, top: y + 67, width: 28, height: 28 }, "#94A3B8", "none", 0);
    });
    footer(s, 6);
    setNotes(s, "可以从前端请求开始讲：用户操作进入后端路由，路由调用 service 完成 AI 或文档处理，最后把结果存入数据库或返回前端。面试模块使用 WebSocket，是因为它需要连续多轮对话。");
  }

  // 7 Data model
  {
    const s = p.slides.add();
    bg(s);
    addTitle(s, "用户体系与数据模型", "数据设计");
    const boxes = [
      ["users", "邮箱、密码哈希、注册时间", 98, 205],
      ["resume_profiles", "每个用户一份简历档案 JSON", 420, 128],
      ["knowledge_documents", "上传资料元数据与向量块 ID", 420, 282],
      ["knowledge_points", "由资料生成的常见考点卡片", 770, 282],
      ["interview_sessions", "面试记录、对话、评价与结束原因", 420, 436],
    ];
    boxes.forEach((b, i) => card(s, b[2], b[3], i === 0 ? 240 : 300, 94, b[0], b[1], { titleSize: 22, bodySize: 16, fill: i === 0 ? "#EFF6FF" : C.card }));
    arrow(s, 345, 226, 58, 18);
    arrow(s, 345, 308, 58, 18);
    arrow(s, 724, 318, 40, 18, C.green);
    arrow(s, 345, 462, 58, 18);
    addText(s, "核心隔离方式：JWT 获取当前用户，业务查询均基于 user_id 过滤。", 120, 588, 1020, 34, { size: 23, bold: true, color: C.blue, align: "center" });
    footer(s, 7);
    setNotes(s, "系统使用 JWT 进行接口鉴权。后端依赖 get_current_user 获取当前用户，并在查询时用 user_id 做隔离。这样不同用户的简历、知识库和面试记录不会混在一起。");
  }

  // 8 Resume module
  {
    const s = p.slides.add();
    bg(s, "#F3F8FF");
    addTitle(s, "在线简历生成：从原始材料到岗位定制 PDF", "核心模块一");
    const items = [
      "手动维护：个人信息、教育经历、项目经历、实习经历、奖项、语言和技能",
      "上传解析：支持 pdf、docx、pptx、txt",
      "LLM 解析：提取为结构化 resume_form",
      "档案合并：兼容新旧字段，过滤空记录",
      "PDF 生成：结合目标公司和岗位重组表达",
    ];
    bullets(s, items, 90, 170, 640, 380, { size: 22 });
    card(s, 790, 180, 310, 90, "输入", "简历文件 / 在线表单", { fill: "#FFFFFF" });
    arrow(s, 915, 286, 58, 22);
    card(s, 790, 326, 310, 90, "处理", "文本提取 + LLM 解析 + 档案合并", { fill: "#EFF6FF", line: "#93C5FD" });
    arrow(s, 915, 432, 58, 22);
    card(s, 790, 472, 310, 90, "输出", "岗位定制中文 PDF 简历", { fill: "#ECFDF5", line: "#86EFAC" });
    footer(s, 8);
    setNotes(s, "这个模块的重点不是填表，而是让系统获得一份后续可复用的用户档案。之后简历生成和模拟面试都可以读取这份档案。");
  }

  // 9 Resume flow
  {
    const s = p.slides.add();
    bg(s);
    addTitle(s, "简历生成流程", "流程设计");
    const flow = ["上传/填写", "文本提取", "LLM 结构化解析", "档案归一化合并", "保存 SQLite", "岗位定制", "ReportLab PDF"];
    flow.forEach((f, i) => {
      const x = 68 + (i % 4) * 292;
      const y = i < 4 ? 210 : 415;
      card(s, x, y, 226, 90, f, i === 0 ? "文件或表单输入" : i === 2 ? "输出 resume_form" : i === 5 ? "目标公司 + 岗位" : "核心处理节点", { titleSize: 20, bodySize: 15, fill: i === 6 ? "#ECFDF5" : C.card });
      if (i < 3) arrow(s, x + 238, y + 36, 42, 18);
      if (i === 3) arrow(s, x + 70, y + 120, 42, 18);
      if (i >= 4 && i < 6) arrow(s, x + 238, y + 36, 42, 18);
    });
    addText(s, "关键点：解析结果与已有档案合并；PDF 内容根据岗位目标重新组织，而不是简单模板填充。", 110, 585, 1060, 44, { size: 22, bold: true, color: C.blue, align: "center" });
    footer(s, 9);
    setNotes(s, "答辩时可以强调两个细节：第一，解析结果不是直接覆盖用户档案，而是与已有信息合并；第二，PDF 不是简单模板填充，而是根据岗位目标重新组织语言。");
  }

  // 10 Knowledge
  {
    const s = p.slides.add();
    bg(s, "#F8FAFC");
    addTitle(s, "知识库管理：把复习资料变成可检索考点", "核心模块二");
    bullets(s, [
      "批量上传专业资料：pdf、docx、pptx、txt",
      "后端提取文本，并按 chunk_size / chunk_overlap 分块",
      "sentence-transformers 生成文本向量",
      "写入每个用户独立的 Chroma collection",
      "上传后调用 LLM 整理 12-20 个常见考点",
      "前端用翻转卡片展示考点，支持换一换和删除资料",
    ], 84, 166, 610, 420, { size: 21 });
    const topics = ["Java 并发", "MySQL 索引", "Redis 缓存", "JVM 内存", "网络协议", "项目难点"];
    topics.forEach((t, i) => card(s, 760 + (i % 2) * 178, 170 + Math.floor(i / 2) * 128, 150, 88, t, "点击翻转查看参考答案", { titleSize: 18, bodySize: 13, fill: i % 2 ? "#EFF6FF" : "#FFFFFF" }));
    footer(s, 10);
    setNotes(s, "知识库模块的价值在于把资料存储变成面试可用的上下文。上传资料后，系统不仅保存原文，还生成考点卡片，并在模拟面试中通过 RAG 提供参考。");
  }

  // 11 RAG
  {
    const s = p.slides.add();
    bg(s);
    addTitle(s, "RAG：让面试问题贴合用户资料", "检索增强生成");
    const top = ["资料文本", "文本分块", "向量化", "Chroma 存储"];
    top.forEach((t, i) => {
      card(s, 90 + i * 280, 190, 205, 86, t, i === 0 ? "PDF / DOCX / PPTX / TXT" : i === 2 ? "sentence-transformers" : "知识库处理", { titleSize: 19, bodySize: 15 });
      if (i < top.length - 1) arrow(s, 305 + i * 280, 226, 48, 18);
    });
    const bottom = ["构造 query", "检索相关片段", "拼接提示词", "生成下一题"];
    bottom.forEach((t, i) => {
      card(s, 90 + i * 280, 415, 205, 86, t, i === 0 ? "岗位 + 用户回答" : i === 3 ? "更贴合资料" : "面试时实时使用", { titleSize: 19, bodySize: 15, fill: i === 3 ? "#ECFDF5" : C.card });
      if (i < bottom.length - 1) arrow(s, 305 + i * 280, 451, 48, 18, i === 2 ? C.green : C.blue);
    });
    addShape(s, "downArrow", { left: 995, top: 300, width: 52, height: 84 }, "#94A3B8", "none", 0);
    footer(s, 11);
    setNotes(s, "如果没有 RAG，面试官只能基于通用岗位常识提问。有了 RAG 后，系统可以结合用户上传的课程资料、专业笔记或岗位资料，让问题更有针对性。");
  }

  // 12 Interview
  {
    const s = p.slides.add();
    bg(s, C.navy);
    await addImage(s, path.join(ASSETS, "mock-interview-scene.png"), 585, 80, 590, 420, "模拟面试场景图", "cover");
    addText(s, "模拟面试：全屏、语音、多轮追问", 72, 74, 540, 92, { size: 40, bold: true, color: "#FFFFFF" });
    bullets(s, [
      "填写目标公司和目标岗位后进入全屏",
      "WebSocket 保持多轮实时对话",
      "结合历史对话、岗位、简历和 RAG 资料生成下一题",
      "支持语音播报、语音听写和手动编辑",
      "检测切换标签页、离开页面或退出全屏并结束面试",
    ], 78, 186, 470, 320, { size: 21, color: "#E2E8F0" });
    addText(s, "演示效果最强的模块：建议现场展示完整一轮问答。", 82, 570, 1020, 34, { size: 24, bold: true, color: "#BAE6FD" });
    footer(s, 12);
    setNotes(s, "这一模块是项目演示效果最强的部分。建议现场演示一轮完整问答，展示题目播报、回答提交和评价结果。");
  }

  // 13 WS sequence
  {
    const s = p.slides.add();
    bg(s);
    addTitle(s, "面试交互时序", "WebSocket 流程");
    const actors = [["前端", 125], ["WebSocket", 430], ["后端会话", 735], ["LLM / RAG", 1040]];
    actors.forEach((a) => {
      addText(s, a[0], a[1] - 70, 152, 140, 28, { size: 20, bold: true, color: C.blue, align: "center" });
      addShape(s, "line", { left: a[1], top: 190, width: 0, height: 390 }, "none", "#CBD5E1", 0);
    });
    const steps = [
      [125, 430, 215, "建立连接"],
      [125, 735, 265, "start：岗位信息"],
      [735, 1040, 315, "生成问题"],
      [735, 125, 365, "question"],
      [125, 735, 430, "answer + timing"],
      [735, 1040, 480, "评价 / 下一题"],
      [735, 125, 535, "ended + evaluation"],
    ];
    steps.forEach(([x1, x2, y, label]) => {
      const left = Math.min(x1, x2);
      const width = Math.abs(x2 - x1);
      addShape(s, "line", { left, top: y, width, height: 0 }, "none", C.blue, 0);
      addShape(s, x2 > x1 ? "rightArrow" : "leftArrow", { left: x2 > x1 ? x2 - 18 : x2, top: y - 7, width: 18, height: 14 }, C.blue, "none", 0);
      addText(s, label, left + width / 2 - 90, y - 26, 180, 20, { size: 14, color: C.text, align: "center" });
    });
    footer(s, 13);
    setNotes(s, "REST API 更适合一次请求一次响应，而模拟面试是连续对话场景，所以使用 WebSocket 更自然。");
  }

  // 14 Speech fluency
  {
    const s = p.slides.add();
    bg(s, "#F3F8FF");
    addTitle(s, "回答熟练度：不仅看答了什么，也看怎么答", "语音与表达分析");
    const metrics = [
      ["首个核心词延迟", "衡量进入回答状态的速度"],
      ["最长卡顿", "识别回答过程中的明显停顿"],
      ["卡壳次数", "统计超过阈值的停顿次数"],
      ["填充词比例", "估计语气词与无效表达占比"],
      ["核心语速", "按有效字数与时长计算表达速度"],
    ];
    metrics.forEach((m, i) => card(s, 90 + (i % 3) * 370, 180 + Math.floor(i / 3) * 165, 320, 104, m[0], m[1], { titleSize: 22, bodySize: 17, fill: i === 0 ? "#EFF6FF" : C.card }));
    card(s, 275, 524, 730, 70, "语音链路", "edge-tts 播报题目；Web Speech API 听写回答；前端记录字符时间序列，后端清洗并计算指标。", { titleSize: 18, bodySize: 18, fill: "#FFFFFF" });
    footer(s, 14);
    setNotes(s, "面试评价不只看知识点是否答对，也要关注表达熟练程度。比如长时间停顿、填充词过多、语速过慢，都可能说明用户还不够熟练。");
  }

  // 15 Evaluation
  {
    const s = p.slides.add();
    bg(s);
    addTitle(s, "结构化评价：把训练结果变成改进建议", "评价反馈");
    const left = [
      "总评：概括整体表现",
      "知识掌握：根据用户实际回答评分",
      "项目深度：评价经历表达是否具体",
      "熟练程度：结合回答时间指标评分",
      "亮点与不足：提炼可保留和需改进部分",
      "学习建议：输出可执行的后续复习方向",
    ];
    bullets(s, left, 86, 168, 570, 390, { size: 21 });
    card(s, 760, 172, 350, 90, "评价原则", "只根据用户实际回答判断，不凭简历或资料臆测掌握情况。", { fill: "#FEF3C7", line: "#FCD34D", titleSize: 21, bodySize: 17 });
    card(s, 760, 298, 350, 90, "评价结果", "overall、scores、strengths、gaps、suggestions 等 JSON 字段。", { fill: "#EFF6FF", line: "#93C5FD", titleSize: 21, bodySize: 17 });
    card(s, 760, 424, 350, 90, "用户价值", "把一次面试训练沉淀成后续学习和表达改进方向。", { fill: "#ECFDF5", line: "#86EFAC", titleSize: 21, bodySize: 17 });
    footer(s, 15);
    setNotes(s, "代码中特别限制评价只能依据用户实际回答，避免系统凭简历或资料臆测用户掌握情况。这一点可以体现评价逻辑的严谨性。");
  }

  // 16 Frontend
  {
    const s = p.slides.add();
    bg(s, "#F8FAFC");
    addTitle(s, "前端体验：围绕求职流程组织页面", "交互设计");
    const pages = [
      ["首页", "三个核心入口：简历、知识库、模拟面试"],
      ["简历页", "结构化表单、上传解析、加载遮罩、PDF 下载"],
      ["知识库页", "批量上传、资料列表、考点翻转卡片"],
      ["面试页", "全屏沉浸、防切屏、语音输入、历史记录"],
      ["全局体验", "登录保护、导航切换、日间/夜间主题"],
    ];
    pages.forEach((p2, i) => {
      const x = 92 + (i % 2) * 535;
      const y = 166 + Math.floor(i / 2) * 128;
      card(s, x, y, 470, 88, p2[0], p2[1], { titleSize: 22, bodySize: 17, fill: i === 3 ? "#EFF6FF" : C.card });
    });
    footer(s, 16);
    setNotes(s, "前端不是只做接口展示，而是根据不同场景设计交互。比如面试需要全屏和防切屏，知识库复习适合卡片翻转，简历生成需要表单校验和下载反馈。");
  }

  // 17 Demo route
  {
    const s = p.slides.add();
    bg(s);
    addTitle(s, "建议现场演示路线", "演示安排");
    const steps = ["登录系统", "展示简历表单 / 上传解析", "生成 PDF 简历", "上传知识库资料", "展示考点卡片", "开始全屏模拟面试", "回答题目并结束", "展示评价与历史记录"];
    steps.forEach((st, i) => {
      const x = 90 + (i % 4) * 285;
      const y = 180 + Math.floor(i / 4) * 175;
      addShape(s, "ellipse", { left: x, top: y, width: 48, height: 48 }, i < 3 ? C.blue : i < 6 ? C.amber : C.green, "none", 0);
      addText(s, String(i + 1), x, y + 10, 48, 24, { size: 18, bold: true, color: "#FFFFFF", align: "center" });
      addText(s, st, x + 62, y + 4, 190, 48, { size: 19, bold: true, color: C.navy });
      if (i % 4 !== 3) arrow(s, x + 224, y + 14, 42, 18, "#94A3B8");
    });
    addText(s, "建议提前准备账号、简历档案和知识库资料，现场重点展示主流程连贯性。", 120, 586, 1040, 34, { size: 22, bold: true, color: C.blue, align: "center" });
    footer(s, 17);
    setNotes(s, "演示时不建议临时上传过大的文件。可以提前准备好账号、简历档案和知识库资料，把现场重点放在主流程是否连贯。");
  }

  // 18 Highlights
  {
    const s = p.slides.add();
    bg(s, "#F3F8FF");
    addTitle(s, "项目亮点", "价值总结");
    const highlights = [
      ["完整闭环", "简历、知识库、面试、评价相互联动"],
      ["岗位定制", "简历生成和面试问题都围绕目标岗位展开"],
      ["RAG 增强", "个人资料进入向量库，支持更贴合的提问"],
      ["实时交互", "WebSocket 支撑多轮连续面试"],
      ["语音增强", "播报、听写和表达熟练度统计"],
      ["可演示性强", "SQLite 和本地文件存储降低部署复杂度"],
    ];
    highlights.forEach((h, i) => card(s, 88 + (i % 3) * 374, 172 + Math.floor(i / 3) * 166, 318, 112, h[0], h[1], { titleSize: 23, bodySize: 17, fill: i === 2 ? "#EFF6FF" : C.card }));
    footer(s, 18);
    setNotes(s, "这一页建议用来总结项目和普通 CRUD 系统的区别。重点是 AI 能力和业务流程真正结合，而不是只在某个按钮上调用一次大模型。");
  }

  // 19 Future
  {
    const s = p.slides.add();
    bg(s);
    addTitle(s, "不足与未来展望", "项目反思");
    const rows = [
      ["生产化安全", "强化密钥管理、HTTPS、CORS 限制和访问审计"],
      ["存储升级", "SQLite / 本地文件可迁移到 PostgreSQL 或 MySQL + 对象存储"],
      ["评价体系", "加入更明确的评分 Rubric 和岗位能力模型"],
      ["功能扩展", "岗位 JD 上传、简历 ATS 评分、错题本、学习计划生成"],
      ["多模态能力", "视频面试、表情/语速分析、多端适配"],
    ];
    rows.forEach((r, i) => {
      const y = 164 + i * 84;
      card(s, 132, y, 1010, 62, r[0], r[1], { titleSize: 20, bodySize: 17, fill: i % 2 ? "#FFFFFF" : "#F8FAFC" });
    });
    footer(s, 19);
    setNotes(s, "不足部分要讲得主动一些，体现对工程化落地的认识。可以说明当前选型是为了课程演示和本机运行，后续生产化还有清晰路径。");
  }

  // 20 Closing
  {
    const s = p.slides.add();
    bg(s, C.navy);
    await addImage(s, path.join(ASSETS, "ai-jobseek-loop.png"), 740, 130, 380, 280, "AI 求职闭环", "cover");
    addText(s, "谢谢观看", 92, 132, 520, 72, { size: 56, bold: true, color: "#FFFFFF" });
    addText(s, "欢迎老师同学批评指正", 96, 220, 520, 42, { size: 30, color: "#DBEAFE" });
    bullets(s, [
      "JobSeekHelper 将求职准备流程整合为“档案-知识-训练-反馈”的 AI 闭环",
      "项目完成了核心功能开发，并具备完整演示路径",
      "后续将继续提升评价标准、部署能力和岗位适配能力",
    ], 96, 326, 570, 180, { size: 22, color: "#E2E8F0" });
    addText(s, "JobSeekHelper", 96, 594, 360, 36, { size: 26, bold: true, color: "#BAE6FD" });
    setNotes(s, "最后用一句话收束：本项目的目标不是替代学生求职，而是帮助学生更系统、更高效地准备求职。");
  }

  for (const [index, slide] of p.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(PREVIEW, `${stem}.png`), await p.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(PREVIEW, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(path.join(PREVIEW, "deck-montage.webp"), await p.export({ format: "webp", montage: true, scale: 1 }));
  if (process.env.DEBUG_PROTO === "1") {
    const proto = p.toProto();
    const hits = [];
    function walk(value, trail) {
      if (value === undefined) {
        hits.push(trail);
        return;
      }
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${trail}[${i}]`));
        return;
      }
      for (const [k, v] of Object.entries(value)) walk(v, `${trail}.${k}`);
    }
    walk(proto, "proto");
    console.log(hits.slice(0, 200).join("\n") || "no undefined fields");
  }
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(FINAL);

  await fs.writeFile(path.join(QA, "visual-qa.txt"), [
    "视觉 QA 记录",
    "检查项：",
    "- 已生成 20 页 16:9 PPTX。",
    "- 封面、闭环图和模拟面试场景图均已嵌入。",
    "- 系统架构、流程、数据模型和时序图均为可编辑形状。",
    "- 所有页面均已导出 PNG 预览与 deck-montage.webp。",
    "- 字体层级使用标题 36-56px、正文 17-23px，适合答辩投影。",
    "- 内容来源记录见 source-notes.txt。",
    "",
    "人工复核建议：打开 preview/deck-montage.webp 快速检查整体排版，再打开 PPTX 做最终姓名/班级等个性化信息补充。",
  ].join("\n"), "utf8");

  console.log(FINAL);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
