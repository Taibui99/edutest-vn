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
  border: string;
}

const subjectMap: Record<string, SubjectColor> = {
  "Toán":       { text: "#6C63FF", bg: "#EEEFFE", border: "#C7C4FC" },
  "Ngữ Văn":   { text: "#FF6B6B", bg: "#FFECEC", border: "#FFC5C5" },
  "Tiếng Anh": { text: "#06D6A0", bg: "#E1F5EE", border: "#A8E6D6" },
  "Vật Lý":    { text: "#D4A017", bg: "#FFF8E1", border: "#FFE8A0" },
  "Hóa Học":   { text: "#4EA8DE", bg: "#E8F4FD", border: "#B8D8F0" },
  "Sinh Học":  { text: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  "Lịch Sử":  { text: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  "Địa Lý":   { text: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  "GDCD":      { text: "#DB2777", bg: "#FDF2F8", border: "#FBCFE8" },
  "Tin Học":   { text: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC" },
};

const defaultColor: SubjectColor = { text: "#6C63FF", bg: "#EEEFFE", border: "#C7C4FC" };

export function getSubjectColor(subject: string): SubjectColor {
  return subjectMap[subject] ?? defaultColor;
}
