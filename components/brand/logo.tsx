import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * BRAND-3 — Logo A6Class.
 *
 * Ý tưởng: một tờ đề thi với góc gấp, cắn ngang bởi dấu check màu hổ phách
 * của hệ thống chấm điểm tự động. Đề + check = đúng việc sản phẩm làm.
 *
 * Màu: tile gradient sky-700 → indigo-700 (#0369A1 → #1D4ED8). Trang trắng
 * đạt 5.93–6.70:1 trên toàn bộ dải gradient. Check hổ phách #FCD34D nằm trên
 * cả trang trắng lẫn nền tile: đối với nền xanh thì tương phản cao, nhưng trên
 * trang trắng chỉ khoảng 1.4:1 — chấp nhận được vì đây là logotype (WCAG 1.4.11
 * miễn trừ logo), và độ nổi đã được đo bằng `scripts/qa-logo-geometry.mjs`
 * thay vì ước lượng bằng mắt.
 *
 * Trước đây thương hiệu nằm rải rác 9 chỗ với 3 kiểu JSX khác nhau và mỗi
 * chỗ một bảng màu, nên nay gom về đây làm nguồn duy nhất.
 */

const NAME_A6 = "A6";
const NAME_CLASS = "Class";

const sizes = {
  sm: { tile: "h-7 w-7 rounded-[0.55rem]", name: "text-[15px]", gap: "gap-1.5" },
  md: { tile: "h-9 w-9 rounded-[0.7rem]", name: "text-[19px]", gap: "gap-2" },
  lg: { tile: "h-12 w-12 rounded-[0.9rem]", name: "text-2xl", gap: "gap-2.5" },
} as const;

export type LogoSize = keyof typeof sizes;

export function LogoMark({
  size = "md",
  tone = "default",
  className,
}: {
  size?: LogoSize;
  /** `inverse` dùng khi đặt trên nền gradient primary — tile cùng hệ sẽ chìm. */
  tone?: "default" | "inverse";
  className?: string;
}) {
  const s = sizes[size];
  const inverse = tone === "inverse";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        inverse
          ? "bg-white/15 ring-1 ring-inset ring-white/35"
          : "bg-gradient-to-br from-primary to-blue shadow-sm shadow-primary/25",
        s.tile,
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="h-full w-full" fill="none">
        {/* Tờ đề thi, góc trên phải gấp lại. Tọa độ đã canh để cụm trang+check
            nằm đúng giữa ô 32×32 (lề 7.35 ngang, 7.5 dọc). */}
        <path
          d="M7.35 10.1A2.6 2.6 0 0 1 9.95 7.5h6.9l3.5 3.5v11a2.6 2.6 0 0 1-2.6 2.6h-7.8A2.6 2.6 0 0 1 7.35 22V10.1Z"
          fill="#fff"
        />
        {/* Nếp gấp */}
        <path d="M16.85 7.5v2.6a1.4 1.4 0 0 0 1.4 1.4h2.1l-3.5-4Z" fill="#fff" opacity=".55" />
        {/* Hai dòng chữ trên đề */}
        <rect x="10.35" y="12.6" width="6.2" height="1.35" rx=".675" fill="#0369A1" opacity=".22" />
        <rect x="10.35" y="15.7" width="4.3" height="1.35" rx=".675" fill="#0369A1" opacity=".22" />
        {/* Dấu check của hệ thống chấm điểm, cắn qua mép đề */}
        <path
          d="M14.75 20 17.35 22.6l5.9-6.4"
          stroke="#FCD34D"
          strokeWidth="2.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Logo({
  size = "md",
  tone = "default",
  href,
  className,
}: {
  size?: LogoSize;
  tone?: "default" | "inverse";
  /** Bỏ `href` để dùng logo không bọc link. */
  href?: string;
  className?: string;
}) {
  const s = sizes[size];
  const inverse = tone === "inverse";

  const content = (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <LogoMark size={size} tone={tone} />
      <span className={cn("font-extrabold leading-none tracking-tight", s.name)}>
        <span
          className={inverse ? "text-white" : "bg-gradient-to-r from-primary to-blue bg-clip-text text-transparent"}
        >
          {NAME_A6}
        </span>
        <span className={inverse ? "text-white/85" : "text-[var(--text-primary)]"}>{NAME_CLASS}</span>
      </span>
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label="A6Class"
        className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {content}
      </Link>
    );
  }

  return (
    <span role="img" aria-label="A6Class">
      {content}
    </span>
  );
}