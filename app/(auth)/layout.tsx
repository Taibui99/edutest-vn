import { Logo } from "../components/logo";
import { ThemeToggle } from "@/components/theme/theme-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[var(--primary-light)] via-[var(--surface-bg)] to-[var(--primary-light)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-[var(--primary)]/10 blur-3xl" />
        <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-[var(--coral)]/10 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
        {children}
      </main>
    </div>
  );
}