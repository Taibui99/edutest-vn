import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * BRAND-3 — Logo A6Class Education.
 *
 * Trước đây thương hiệu nằm rải rác ở 9 chỗ với 3 kiểu JSX khác nhau
 * ("Edu" + "Test" + ".vn", đổi cả bảng màu theo từng chỗ), nên đổi tên phải
 * sửa 9 lần và dễ sót. nay gom về đây làm nguồn duy nhất.
 *
 * Ngôn ngữ thị giác lấy từ logo A6Class (D:\A6Class\src\components\layout\logo.tsx):
 * tile gradient primary → primary-hover, chữ trắng extrabold, subline chữ
 * thường. Ở đây giữ dạng lockup ngang vì mọi vị trí đặt logo đều là hàng
 * cao 56–64px (topbar, sidebar) — tile dọc 2 dòng của A6Class sẽ vỡ layout.
 */

const NAME = "A6Class";
const SUB = "EDU";

const sizes = {
  sm: { tile: "h-7 w-7 rounded-[0.6rem]", mark: "text-[11px]", name: "text-[15px]", sub: "text-[8px] tracking-[0.2em]" },
  md: { tile: "h-8 w-8 rounded-[0.7rem]", mark: "text-[13px]", name: "text-[17px]", sub: "text-[9px] tracking-[0.22em]" },
  lg: { tile: "h-11 w-11 rounded-xl", mark: "text-base", name: "text-xl", sub: "text-[10px] tracking-[0.24em]" },
} as const;

export type LogoSize = keyof typeof sizes;
export type LogoTone = "default" | "inverse";

/** Ô tile gradient — chỉ có "A6" trắng nên tương phản luôn đạt AA ở mọi size. */
export function LogoMark({
  size = "md",
  tone = "default",
  className,
}: {
  size?: LogoSize;
  tone?: LogoTone;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        tone === "inverse"
          ? "bg-white/20 shadow-none ring-1 ring-inset ring-white/30"
          : "bg-gradient-to-b from-primary to-primary-hover shadow-sm shadow-primary/25",
        s.tile,
        s.mark,
        className,
      )}
    >
      <span className="font-extrabold leading-none tracking-tight text-white">A6</span>
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
  /** `inverse` dùng khi đặt trên nền gradient primary — tile gradient cùng hệ sẽ chìm. */
  tone?: LogoTone;
  /** Bỏ `href` để dùng logo không bọc link (ví dụ trong `<Link>` sẵn có). */
  href?: string;
  className?: string;
}) {
  const s = sizes[size];
  const inverse = tone === "inverse";

  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} tone={tone} />
      <span className="inline-flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-extrabold leading-none tracking-tight",
            s.name,
            inverse ? "text-white" : "text-[var(--text-primary)]",
          )}
        >
          {NAME}
        </span>
        <span
          className={cn(
            "font-bold uppercase leading-none",
            s.sub,
            inverse ? "text-amber-300" : "text-[var(--accent)]",
          )}
        >
          {SUB}
        </span>
      </span>
    </span>
  );

  const label = `${NAME} ${SUB}`;

  if (href) {
    return (
      <Link href={href} aria-label={label} className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
        {content}
      </Link>
    );
  }

  return (
    <span role="img" aria-label={label}>
      {content}
    </span>
  );
}