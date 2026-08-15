import { cn } from "@/lib/cn";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const COLORS = [
  "bg-gradient-to-br from-[#6C63FF] to-[#a78bfa]",
  "bg-gradient-to-br from-[#06D6A0] to-[#4EA8DE]",
  "bg-gradient-to-br from-[#FF6B6B] to-[#FFB199]",
  "bg-gradient-to-br from-[#FFD166] to-[#FF9F45]",
  "bg-gradient-to-br from-[#a78bfa] to-[#6C63FF]",
  "bg-gradient-to-br from-[#059669] to-[#06D6A0]",
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
