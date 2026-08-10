import Link from "next/link";
import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

export function Logo({ className, href = "/", size = "md" }: LogoProps) {
  const content = (
    <span className={cn("font-bold tracking-tight", sizes[size], className)}>
      <span className="text-[#2563EB]">Edu</span>
      <span className="text-[#0F172A]">Test</span>
      <span className="text-[#14B8A6]">.vn</span>
    </span>
  );

  if (href) {
    return <Link href={href} className="focus-visible:outline-none">{content}</Link>;
  }

  return content;
}
