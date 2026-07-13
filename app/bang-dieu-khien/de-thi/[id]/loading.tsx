import { Spinner } from "@/app/components/spinner";

export default function ExamDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-blue-100 bg-white sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
          <Spinner className="h-5 w-5" />
          <span className="text-sm">Đang tải đề thi...</span>
        </div>
      </main>
    </div>
  );
}
