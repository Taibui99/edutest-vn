import { cn } from "@/lib/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  accent?: string; // color strip on left
}

const paddingStyles = {
  none: "",
  sm:   "p-4",
  md:   "p-5",
  lg:   "p-6",
};

export function Card({ children, className, hover, padding = "md", accent }: CardProps) {
  return (
    <div
      className={cn(
        "bg-[var(--surface-card)] rounded-2xl border border-[var(--surface-border)] relative overflow-hidden",
        paddingStyles[padding],
        hover && "transition-all hover:border-[#6C63FF]/40 hover:shadow-md cursor-pointer",
        className,
      )}
    >
      {accent && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: accent }}
        />
      )}
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-sm font-bold text-[var(--text-primary)]", className)}>{children}</h3>;
}
