import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const { data } = await api.post("/auth/register", { email, password });
      localStorage.setItem("token", data.access_token);
      nav("/");
    } catch (ex: unknown) {
      const msg =
        (ex as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "注册失败";
      setErr(typeof msg === "string" ? msg : "注册失败");
    }
  }

  return (
    <div className="layout auth-layout">
      <h1>注册</h1>
      <form className="card" onSubmit={onSubmit}>
        <label>邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="space-sm" />
        <label>密码（至少 6 位）</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        {err && <p className="error">{err}</p>}
        <div className="space-sm" />
        <button type="submit">注册并登录</button>
        <p className="muted">
          已有账号？<Link to="/login">登录</Link>
        </p>
      </form>
    </div>
  );
}
