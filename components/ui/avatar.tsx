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
  "bg-gradient-to-br from-[#6C4CF1] to-[#B9A5FA]",
  "bg-gradient-to-br from-[#0E7350] to-[#1A5FB0]",
  "bg-gradient-to-br from-[#BE3B3B] to-[#FFB199]",
  "bg-gradient-to-br from-[#FCF3E2] to-[#8A5A00]",
  "bg-gradient-to-br from-[#B9A5FA] to-[#6C4CF1]",
  "bg-gradient-to-br from-[#059669] to-[#0E7350]",
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
