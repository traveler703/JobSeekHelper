import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Interview from "./pages/Interview";
import Knowledge from "./pages/Knowledge";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Resume from "./pages/Resume";

function authed() {
  return !!localStorage.getItem("token");
}

function Layout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="layout">
      <nav className="nav">
        <Link to="/" className="brand">
          JobSeekHelper
        </Link>
        <NavLink
          to="/resume"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          在线简历生成
        </NavLink>
        <NavLink
          to="/knowledge"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          知识库管理
        </NavLink>
        <NavLink
          to="/interview"
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          模拟面试
        </NavLink>
        <button
          type="button"
          className="secondary nav-logout"
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/login";
          }}
        >
          退出
        </button>
        <button
          type="button"
          className="secondary theme-toggle"
          onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
          title="切换日间/夜间模式"
        >
          {theme === "dark" ? "日间模式" : "夜间模式"}
        </button>
      </nav>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          authed() ? (
            <Layout>
              <Dashboard />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/resume"
        element={
          authed() ? (
            <Layout>
              <Resume />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/knowledge"
        element={
          authed() ? (
            <Layout>
              <Knowledge />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/interview"
        element={
          authed() ? (
            <Layout>
              <Interview />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
