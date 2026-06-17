type Props = {
  open: boolean;
  title?: string;
};

export default function LoadingOverlay({ open, title = "请稍候" }: Props) {
  if (!open) return null;
  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-overlay-card">
        <div className="loading-spinner" aria-hidden />
        <p className="loading-overlay-title">{title}</p>
        <p className="loading-overlay-sub muted">正在处理，请勿关闭页面</p>
      </div>
    </div>
  );
}
