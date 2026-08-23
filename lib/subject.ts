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
  "Toán":       { text: "#2563EB", bg: "#DBEAFE", border: "#BFDBFE" },
  "Ngữ Văn":   { text: "#E11D48", bg: "#FFE4E6", border: "#FECDD3" },
  "Tiếng Anh": { text: "#6C4CF1", bg: "#F1EDFD", border: "#DCD4FA" },
  "Vật Lý":    { text: "#D4A017", bg: "#FFF8E1", border: "#FFE8A0" },
  "Hóa Học":   { text: "#059669", bg: "#D1FAE5", border: "#A7F3D0" },
  "Sinh Học":  { text: "#0EA5E9", bg: "#E0F2FE", border: "#BAE6FD" },
  "Lịch Sử":  { text: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  "Địa Lý":   { text: "#16A34A", bg: "#DCFCE7", border: "#BBF7D0" },
  "GDCD":      { text: "#EA580C", bg: "#FFEDD5", border: "#FED7AA" },
  "Tin Học":   { text: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC" },
};

const defaultColor: SubjectColor = { text: "#6C4CF1", bg: "#F1EDFD", border: "#DCD4FA" };

export function getSubjectColor(subject: string): SubjectColor {
  return subjectMap[subject] ?? defaultColor;
}
