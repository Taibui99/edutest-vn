type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-8 shadow-lg shadow-md">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{subtitle}</p>
      </div>

      <div className="mt-8">{children}</div>

      <div className="mt-6 text-center text-sm text-[var(--text-secondary)]">{footer}</div>
    </div>
  );
}
