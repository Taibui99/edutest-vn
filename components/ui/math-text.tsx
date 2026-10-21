import { mathToHtml, hasMath } from "@/lib/latex";

export { hasMath, mathToHtml };

interface MathTextProps {
  /** Nội dung có thể chứa `$…$` / `$$…$$`. */
  text: string | null | undefined;
  className?: string;
  /** Thẻ bao ngoài (mặc định span). */
  as?: "span" | "div" | "p";
}

/**
 * Render văn bản + công thức LaTeX. Dùng được ở cả server và client component.
 * Logic tách công thức nằm ở `lib/latex.ts` (có QA riêng).
 */
export function MathText({ text, className, as = "span" }: MathTextProps) {
  const value = text ?? "";
  const Tag = as;
  if (!hasMath(value)) {
    return <Tag className={className}>{value}</Tag>;
  }
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: mathToHtml(value) }}
    />
  );
}
