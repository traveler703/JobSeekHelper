import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div>
      <h1>欢迎使用 JobSeekHelper</h1>
      <p className="muted">请选择下方入口，或使用顶部导航。</p>
      <div className="home-tiles">
        <Link to="/resume" className="home-tile">
          <h2>在线简历生成</h2>
          <p>填写或上传解析简历信息，保存后生成针对目标公司与岗位的 PDF。</p>
        </Link>
        <Link to="/knowledge" className="home-tile">
          <h2>知识库管理</h2>
          <p>批量上传岗位相关资料，向量化后供模拟面试 RAG 引用。</p>
        </Link>
        <Link to="/interview" className="home-tile">
          <h2>模拟面试</h2>
          <p>全屏语音模拟面试，查看历史记录与系统评价。</p>
        </Link>
      </div>
    </div>
  );
}
