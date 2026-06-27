type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white p-8 shadow-lg shadow-blue-100/50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
      </div>

      <div className="mt-8">{children}</div>

      <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>
    </div>
  );
}
