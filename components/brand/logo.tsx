import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * BRAND-3 — Logo A6Class Edu.
 *
 * Ô thương hiệu là mũ tốt nghiệp đặt trên số "6", chấm vàng ở ruột số — đọc
 * được cả "mũ" lẫn "6" trong một hình vuông. Dải navy → cyan → gold đúng
 * bảng màu: chữ trắng chỉ nằm ở đoạn navy/cyan nên luôn đạt ≥5:1.
 *
 * Chữ "A6Class" và badge "EDU" render bằng HTML chứ không phải <text> trong
 * SVG: không phụ thuộc font ngoài, không tràn khi fallback, và đổi màu theo
 * token được. SVG gốc đặt chữ ở x=58 và badge ở x=156 trong viewBox cứng
 * 220×50 — nếu font chưa tải, chữ sẽ đè lên badge.
 *
 * ID gradient phải sinh theo instance: logo xuất hiện nhiều lần mỗi trang
 * (`/dang-nhap` có hai), ID trùng sẽ khiến các lần sau dùng nhầm gradient.
 *
 * Gradient 4 chặng, không phải 3: glyph (mũ + số 6) chiếm khoảng 22–75% dải
 * chuyển sắc. Nếu chia 3 chặng đều như bản gốc thì đỉnh mũ rơi vào cyan sáng
 * (chữ trắng chỉ 4.15:1, dưới AA) và chấm vàng rơi vào vùng nửa gold nên
 * chìm xuống 2.63:1. Giữ navy thành đoạn phẳng 30–78% khiến toàn bộ glyph
 * nằm trong dải cyan→navy: chữ trắng ≥5.3:1, chấm vàng 5.1:1 trên navy.
 */

const NAME = "A6Class";
const BADGE = "EDU";

/** Ô gốc 46×46 trong SVG gốc, quy đổi về viewBox 32×32. */
const FIT = "scale(0.6956522) translate(-2 -2)";

const sizes = {
  sm: { tile: "h-7 w-7 rounded-[0.55rem]", name: "text-[15px]", badge: "text-[8px] px-1 py-px rounded-[5px]", gap: "gap-1.5" },
  md: { tile: "h-9 w-9 rounded-[0.7rem]", name: "text-[19px]", badge: "text-[10px] px-1.5 py-0.5 rounded-[6px]", gap: "gap-2" },
  lg: { tile: "h-12 w-12 rounded-[0.9rem]", name: "text-2xl", badge: "text-[12px] px-2 py-0.5 rounded-[7px]", gap: "gap-2.5" },
} as const;

export type LogoSize = keyof typeof sizes;

export function LogoMark({
  size = "md",
  tone = "default",
  className,
}: {
  size?: LogoSize;
  /** `inverse` dùng khi đặt trên nền gradient navy — ô cùng hệ sẽ chìm. */
  tone?: "default" | "inverse";
  className?: string;
}) {
  const s = sizes[size];
  const inverse = tone === "inverse";
  const tile = useId();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        inverse ? "bg-white/15 ring-1 ring-inset ring-white/40" : "shadow-sm shadow-primary/20",
        s.tile,
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="h-full w-full" fill="none">
        <defs>
          <linearGradient id={tile} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D2FF" />
            <stop offset="30%" stopColor="#0F4C81" />
            <stop offset="78%" stopColor="#0F4C81" />
            <stop offset="100%" stopColor="#FFB800" />
          </linearGradient>
        </defs>
        <g transform={FIT}>
          <rect x="2" y="2" width="46" height="46" rx="14" fill={`url(#${tile})`} />
          {/* Mũ tốt nghiệp */}
          <path d="M25 11 37 21 25 17 13 21 25 11Z" fill="#FFFFFF" opacity=".95" />
          {/* Số 6 */}
          <path
            d="M19 23h9.5c3 0 5 2 5 5s-3 6.5-7 6.5c-4.5 0-7.5-3-7.5-8V20"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Chấm vàng trong ruột số 6 */}
          <circle cx="26.5" cy="28.5" r="2.5" fill="#FFB800" />
        </g>
      </svg>
    </span>
  );
}

export function Logo({
  size = "md",
  tone = "default",
  badge = true,
  href,
  className,
}: {
  size?: LogoSize;
  tone?: "default" | "inverse";
  /** Tắt ở nơi chật (ví dụ thanh ngang trên mobile). */
  badge?: boolean;
  /** Bỏ `href` để dùng logo không bọc link. */
  href?: string;
  className?: string;
}) {
  const s = sizes[size];
  const inverse = tone === "inverse";

  const content = (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <LogoMark size={size} tone={tone} />
      <span className="inline-flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-extrabold leading-none tracking-tight",
            s.name,
            inverse
              ? "text-white"
              : "bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent",
          )}
        >
          {NAME}
        </span>
        {badge && (
          <span
            className={cn(
              "font-extrabold leading-none uppercase tracking-wide",
              s.badge,
              inverse
                ? "bg-white/20 text-white"
                : "bg-[var(--accent)] text-[var(--primary-dark)]",
            )}
          >
            {BADGE}
          </span>
        )}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label="A6Class Edu"
        className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {content}
      </Link>
    );
  }

  return (
    <span role="img" aria-label="A6Class Edu">
      {content}
    </span>
  );
}