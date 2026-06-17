/** 将后端返回的 UTC 时间（无时区后缀）解析为 Date，再格式化为本机时区。 */
export function parseServerUtc(iso: string): Date {
  if (!iso) return new Date();
  const t = iso.trim();
  if (t.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(t)) {
    return new Date(t);
  }
  const normalized = t.includes("T") ? t : t.replace(" ", "T");
  return new Date(`${normalized}Z`);
}

export function formatLocalDateTime(iso: string): string {
  try {
    return parseServerUtc(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
