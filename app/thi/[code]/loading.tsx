import { Spinner } from "@/app/components/spinner";

export default function ThiLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-green-100 bg-white sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
          <Spinner className="h-6 w-6 text-green-500" />
          <span className="text-sm">Đang kiểm tra mã tham gia...</span>
        </div>
      </main>
    </div>
  );
}
