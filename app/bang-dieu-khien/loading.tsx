import { Spinner } from "@/app/components/spinner";

/**
 * MOB-4 — Skeleton tải cho khu điều khiển.
 *
 * KHÔNG vẽ `<header>`/`min-h-screen` riêng: `loading.tsx` được Next render
 * **bên trong** `app/bang-dieu-khien/layout.tsx` (đã có `MobileTopbar` +
 * `Sidebar` + `MobileBottomNav`). Vẽ thêm header ở đây làm mobile bị 2 thanh
 * chồng nhau và layout nhảy. Chỉ cần skeleton đúng container của trang
 * (`p-4 lg:p-8 max-w-5xl mx-auto`) để nội dung thật thay vào không xê dịch.
 */
export default function DashboardLoading() {
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 space-y-3">
        <div className="h-7 w-48 animate-pulse rounded bg-[var(--gray-200)]" />
        <div className="h-4 w-72 animate-pulse rounded bg-[var(--gray-100)]" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--gray-100)]" />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 py-10 text-[var(--text-muted)]">
        <Spinner className="h-5 w-5" />
        <span className="text-sm">Đang tải...</span>
      </div>
    </div>
  );
}