import { Spinner } from "@/app/components/spinner";

export default function ThiLoading() {
  return (
    <div className="min-h-screen bg-[var(--surface-bg)]">
      <header className="border-b border-[var(--mint-light)] bg-white sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="h-6 w-32 animate-pulse rounded bg-[var(--gray-200)]" />
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--gray-100)]" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-[var(--text-muted)]">
          <Spinner className="h-6 w-6 text-[var(--mint)]" />
          <span className="text-sm">Đang kiểm tra mã tham gia...</span>
        </div>
      </main>
    </div>
  );
}
