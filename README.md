# JobSeekHelper

大学生求职助手系统，面向简历优化、岗位知识准备和模拟面试训练场景。项目支持简历上传解析、在线简历维护、按目标岗位生成 PDF 简历、知识库 RAG 检索、常见考点整理、全屏模拟面试、语音播报与语音识别、回答熟练度评价、防切屏检测等功能。

## 环境要求

- Python 3.11+
- Node.js 18+
- 项目根目录 `.env` 已配置 `DEEPSEEK_API_KEY` 等变量
- 首次使用知识库功能时会下载 `sentence-transformers` 嵌入模型，需要稳定网络

## 后端启动

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

默认 API 地址为 `http://127.0.0.1:8000`。

## 前端启动

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 `http://localhost:5173`。开发环境下 Vite 会将 `/api` 与 WebSocket 请求代理到后端。

## 配置说明

根目录 `.env` 可配置：

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek OpenAI 兼容接口密钥，简历解析、简历生成、面试问答和评价依赖该变量 |
| `DEEPSEEK_BASE_URL` | DeepSeek 接口地址，默认 `https://api.deepseek.com` |
| `LLM_MODEL` | LLM 模型名，如 `deepseek-chat` |
| `STORAGE_DIR` | 本地数据目录，默认 `storage` |
| `CHROMA_DIR` | Chroma 向量库目录，默认 `storage/chroma` |
| `EMBEDDING_MODEL` | 本地句向量模型名 |
| `SECRET_KEY` | JWT 签名密钥，生产环境应改为随机强密钥 |

## 功能说明

### 账号与档案

- 支持注册、登录、JWT 鉴权。
- 每个用户拥有独立的简历档案、知识库文档、常见考点和面试记录。

### 在线简历生成

- 支持直接填写个人信息、教育经历、项目经历、实习经历、获奖经历、外语水平和技能水平。
- 支持上传 `pdf/docx/pptx/txt` 简历文件，后端提取文本并调用 LLM 解析为结构化表单。
- 解析结果会自动兼容 `resume_form` 与旧版顶层字段结构，并过滤默认空记录。
- 支持保存档案，下次进入页面自动加载。
- 支持填写目标公司和目标岗位后生成针对性 PDF 简历。

### 知识库管理

- 支持批量上传 `pdf/docx/pptx/txt` 专业资料。
- 上传后后端会提取文本、分块、写入 Chroma 向量库，供模拟面试 RAG 检索。
- 上传完成后会立即基于文档内容生成常见考点，并保存到本地考点库。
- “常见考点”区域会从已保存的考点库中随机展示卡片；点击“换一换”可切换另一批随机考点。
- 考点卡片支持翻转查看参考答案。
- 支持删除已上传资料，删除时同步删除对应向量块。

### 模拟面试

- 支持填写目标公司和目标岗位后进入全屏模拟面试。
- 后端通过 WebSocket 驱动多轮问答，结合简历档案、岗位信息和知识库 RAG 资料生成问题。
- 前端使用全屏模式进行面试，检测到切换标签页、离开页面或退出全屏时自动结束面试。
- 面试题目支持语音播报：优先使用 `edge-tts` 神经语音生成 MP3，失败时回退到浏览器 `speechSynthesis`。
- 用户回答支持 Web Speech API 语音听写，也可手动编辑后提交。
- 回答过程中会记录“字-时间”序列，后端清洗语气词和填充词，统计首个核心词延迟、最长卡顿、卡壳次数、填充词比例、核心语速等数据。
- 最终评价会综合回答内容和熟练度指标，输出知识掌握、项目深度、回答熟练度、亮点、不足和学习建议。
- 支持查看历史面试记录、查看详情和删除记录。

### 主题切换

- 顶部导航栏支持日间/夜间模式切换。
- 主题选择会保存到浏览器 `localStorage`。

## 数据存储

本项目默认使用本地文件与 SQLite，便于课程项目演示和本机运行：

- `backend/storage/jobseek.db`：SQLite 数据库，保存用户、简历档案、知识库文档元数据、常见考点、面试记录等。
- `backend/storage/uploads/`：用户上传的简历文件。
- `backend/storage/knowledge/`：用户上传的知识库原始文档。
- `backend/storage/chroma/`：Chroma 向量库持久化文件。

主要数据表包括：

- `users`：用户账号。
- `resume_profiles`：用户简历档案 JSON。
- `knowledge_documents`：知识库文档元数据与向量块 ID。
- `knowledge_points`：上传资料预生成的常见考点卡片。
- `interview_sessions`：模拟面试记录、对话内容与评价结果。

## 目录结构

```text
项目/
├── README.md
├── backend/
│   ├── requirements.txt
│   ├── scripts/
│   │   └── clear_local_history.py     # 清空本地业务数据，保留账号
│   ├── storage/
│   │   ├── jobseek.db                 # SQLite 数据库
│   │   ├── uploads/                   # 简历上传文件
│   │   ├── knowledge/                 # 知识库上传文件
│   │   └── chroma/                    # Chroma 向量库
│   └── app/
│       ├── main.py                    # FastAPI 应用入口与路由注册
│       ├── config.py                  # 环境变量与路径配置
│       ├── database.py                # SQLite 初始化与轻量迁移
│       ├── models.py                  # SQLAlchemy 数据模型
│       ├── schemas.py                 # Pydantic 响应模型
│       ├── security.py                # 密码哈希与 JWT
│       ├── deps.py                    # 登录用户依赖
│       ├── constants.py               # 岗位常量
│       ├── routers/
│       │   ├── auth.py                  # 注册、登录
│       │   ├── profile.py               # 简历档案读取与保存
│       │   ├── resume.py                # 简历上传解析
│       │   ├── resume_gen.py            # PDF 简历生成
│       │   ├── knowledge.py             # 知识库上传、删除、随机考点
│       │   ├── interview.py             # 面试 WebSocket、记录、评价、TTS
│       │   └── meta.py                  # 元信息接口
│       └── services/
│           ├── llm.py                   # LLM API 调用与 JSON 解析
│           ├── parser.py                # pdf/docx/pptx/txt 文本提取
│           ├── profile_merge.py         # 简历结构归一化与合并
│           ├── pdf_gen.py               # PDF 简历排版生成
│           ├── rag.py                   # Chroma 向量库写入、删除、检索
│           ├── interview_service.py     # 面试提问与评价逻辑
│           └── speech.py                # edge-tts 播报与回答熟练度统计
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx                    # 路由、导航、主题切换
        ├── api.ts                     # Axios 与 WebSocket URL 工具
        ├── index.css                  # 全局样式、深浅主题、卡片翻转
        ├── pages/
        │   ├── Login.tsx
        │   ├── Register.tsx
        │   ├── Dashboard.tsx
        │   ├── Resume.tsx               # 在线简历生成页面
        │   ├── Knowledge.tsx            # 知识库管理与常见考点卡片
        │   └── Interview.tsx            # 全屏模拟面试与面试记录
        ├── components/
        │   ├── EvaluationPanel.tsx      # 面试评价展示
        │   └── LoadingOverlay.tsx       # 全局加载遮罩
        └── utils/
            └── datetime.ts              # 时间格式化
```

## 常用维护命令

清空本地业务数据，保留账号：

```bash
cd backend
source .venv/bin/activate
python scripts/clear_local_history.py
```

构建前端：

```bash
cd frontend
npm run build
```

检查后端 Python 语法：

```bash
python3 -m compileall backend/app backend/scripts
```

## 注意事项

- `edge-tts` 依赖外部语音服务，网络不可用时前端会自动回退到浏览器内置语音播报。
- 浏览器语音识别依赖 Web Speech API，建议使用 Chrome 或 Edge。
- PDF 解析时如果后端出现 `Ignoring wrong pointing object ...`，通常是 `pypdf` 对不规范 PDF 内部对象引用的容错警告；只要接口返回 `200 OK` 且提取到文本，一般不影响业务流程。
- 当前项目面向本地演示与课程项目场景，生产部署前建议替换强密钥、配置 HTTPS、限制 CORS 来源，并考虑使用正式数据库和对象存储。
