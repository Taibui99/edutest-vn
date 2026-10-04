import { cn } from "@/lib/cn";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Chữ cái luôn màu trắng nên CẢ HAI đầu gradient đều phải đủ tối (≥4.5:1).
 *  Bảng cũ kết thúc ở các sắc rất sáng (#B9A5FA, #FFB199) khiến chữ gần như
 *  chìm — mọi endpoint ở đây đều là token dả 600–800. */
const COLORS = [
  "bg-gradient-to-br from-[var(--primary)] to-[var(--blue)]",
  "bg-gradient-to-br from-[var(--success)] to-[var(--primary)]",
  "bg-gradient-to-br from-[var(--danger)] to-[var(--accent)]",
  "bg-gradient-to-br from-[var(--warning)] to-[var(--secondary)]",
  "bg-gradient-to-br from-[var(--secondary)] to-[var(--primary-hover)]",
  "bg-gradient-to-br from-[var(--info)] to-[var(--success)]",
];

function getColor(name: string) {
  const idx = name.charCodeAt(0) % COLORS.length;
  return COLORS[idx];
}

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "w-7 h-7 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
};

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white shrink-0",
        sizes[size],
        getColor(name),
        className,
      )}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
}
