type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

/* Z1 — card đăng nhập/đăng ký: bỏ xung đột `shadow-lg shadow-md`, bóng đổ
   pha navy + viền hairline, tiêu đề tracking chặt. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-6 shadow-[0_24px_60px_-24px_rgba(15,76,129,0.28)] sm:p-8">
      <div className="text-center">
        <h1 className="text-balance text-2xl font-black tracking-tight text-[var(--text-primary)]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{subtitle}</p>
      </div>

      <div className="mt-8">{children}</div>

      <div className="mt-6 text-center text-sm leading-relaxed text-[var(--text-secondary)]">{footer}</div>
    </div>
  );
}
