import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

export function wsUrl(path: string, query: Record<string, string>): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const q = new URLSearchParams(query).toString();
  return `${proto}//${location.host}${path}${q ? `?${q}` : ""}`;
}
