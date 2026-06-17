# JobSeekHelper

大学生求职助手：简历上传与解析、针对岗位生成 PDF 简历、知识库 RAG、全屏模拟面试（语音播报 + 语音识别 + 防切屏）。

## 环境要求

- Python 3.11+
- Node.js 18+（前端）
- 项目根目录 `.env` 已配置 `DEEPSEEK_API_KEY` 等变量（见下方说明）

## 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

首次运行会下载 `sentence-transformers` 嵌入模型，耗时较长，需稳定网络。

启动 API（默认 `http://127.0.0.1:8000`）：

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 前端

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 `http://localhost:5173`。开发环境下 Vite 会将 `/api` 与 WebSocket 代理到后端。

## 配置说明（根目录 `.env`）

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek OpenAI 兼容接口密钥（必填） |
| `DEEPSEEK_BASE_URL` | 默认 `https://api.deepseek.com` |
| `STORAGE_DIR` / `CHROMA_DIR` | 数据与向量库目录（相对项目根目录） |
| `EMBEDDING_MODEL` | 本地句向量模型名 |
| `LLM_MODEL` | 如 `deepseek-chat` |

生产环境请将 `SECRET_KEY`（后端 `app/config.py` 中默认值）改为随机字符串并可通过环境变量覆盖（需在 `Settings` 中增加字段，当前使用代码内默认值）。

## 功能说明摘要

- **在线简历生成**：表单填写或上传 pdf/docx/pptx/txt → LLM 解析填入表单；保存后按公司与岗位生成 PDF。
- **知识库管理**：批量上传文档 → 分块写入 Chroma，供模拟面试 RAG 检索。
- **模拟面试**：WebSocket 多轮问答；浏览器全屏与 `visibilitychange` 切屏结束；`speechSynthesis` 播报题目；Web Speech API 听写并可编辑后提交；结束由用户按钮或模型/时长规则触发，最后生成 JSON 评价。

## 目录结构

```
项目/
  .env
  backend/           # FastAPI
    scripts/
      clear_local_history.py   # 清空本地简历档案、上传文件、知识库向量、面试记录（保留账号）
  frontend/          # React + Vite
  项目介绍.md
```
