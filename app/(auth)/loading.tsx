import { Spinner } from "@/app/components/spinner";

/**
 * Skeleton tức thì cho các trang auth (đăng nhập/đăng ký/quên MK...).
 *
 * Lý do: cold start khiến server mất ~3-4s mới render xong trang auth. Không
 * có file này, bấm link xong màn hình đứng yên (tưởng treo), rồi View
 * Transition trượt với ảnh chụp còn render dở → chồng hình nhòe. Có skeleton,
 * Next hiện ngay + ảnh trượt là skeleton sạch. Render BÊN TRONG (auth)/layout
 * (đã có header logo) nên chỉ vẽ khối card, đúng container `max-w-md`.
 */
export default function AuthLoading() {
  return (
    <div className="w-full max-w-md rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-6 sm:p-8">
      <div className="flex flex-col items-center gap-2">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-[var(--gray-200)]" />
        <div className="h-4 w-56 animate-pulse rounded bg-[var(--gray-100)]" />
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <div className="h-11 animate-pulse rounded-xl bg-[var(--gray-100)]" />
        <div className="h-11 animate-pulse rounded-xl bg-[var(--gray-100)]" />
        <div className="h-11 animate-pulse rounded-xl bg-[var(--primary-light)]" />
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-[var(--text-muted)]">
        <Spinner className="h-4 w-4" />
        <span className="text-xs">Đang mở trang...</span>
      </div>
    </div>
  );
}
