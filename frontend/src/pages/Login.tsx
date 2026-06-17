import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.access_token);
      nav("/", { replace: true });
      // 某些浏览器场景下路由守卫不会立即重算，强制刷新确保进入首页。
      window.location.replace("/");
    } catch {
      setErr("登录失败，请检查邮箱与密码");
    }
  }

  return (
    <div className="layout auth-layout">
      <h1>登录 JobSeekHelper</h1>
      <form className="card" onSubmit={onSubmit}>
        <label>邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="space-sm" />
        <label>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {err && <p className="error">{err}</p>}
        <div className="space-sm" />
        <button type="submit">登录</button>
        <p className="muted">
          没有账号？<Link to="/register">注册</Link>
        </p>
      </form>
    </div>
  );
}
