import Link from "next/link";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm" style={{ background: "var(--primary)" }}>
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
      </div>
      <span className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
        <span className="text-[var(--primary)]">Edu</span>
        <span className="text-[var(--coral)]">Test</span>
        <span className="text-[var(--text-muted)] text-sm font-semibold">.vn</span>
      </span>
    </Link>
  );
}
