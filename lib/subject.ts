export const SUBJECTS = [
  "Toán",
  "Ngữ Văn",
  "Tiếng Anh",
  "Vật Lý",
  "Hóa Học",
  "Sinh Học",
  "Lịch Sử",
  "Địa Lý",
  "GDCD",
  "Tin Học",
  "Khác",
];

export interface SubjectColor {
  text: string;
  bg: string;
}

/** Tên môn → slug token trong `app/globals.css`. Màu nằm ở CSS, không nhân bản ở đây. */
const SLUG: Record<string, string> = {
  "Toán": "toan",
  "Ngữ Văn": "van",
  "Tiếng Anh": "anh",
  "Vật Lý": "ly",
  "Hóa Học": "hoa",
  "Sinh Học": "sinh",
  "Lịch Sử": "su",
  "Địa Lý": "dia",
  "GDCD": "gdcd",
  "Tin Học": "tin",
};

/**
 * Object trả về phải giữ nguyên tham chiếu giữa các lần render để các component
 * con dùng `React.memo` / `useMemo` theo object này không bị re-render thừa.
 */
const cache = new Map<string, SubjectColor>();

export function getSubjectColor(subject: string): SubjectColor {
  const hit = cache.get(subject);
  if (hit) return hit;
  const slug = SLUG[subject] ?? "khac";
  const color: SubjectColor = {
    text: `var(--subject-${slug})`,
    bg: `var(--subject-${slug}-bg)`,
  };
  cache.set(subject, color);
  return color;
}