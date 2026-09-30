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
  "Toán":       { text: "#1A5FB0", bg: "#EAF3FC", border: "#C4DCF4" },
  "Ngữ Văn":   { text: "#BE123C", bg: "#FFE4E6", border: "#FECDD3" },
  "Tiếng Anh": { text: "#6C4CF1", bg: "#F1EDFD", border: "#DCD4FA" },
  "Vật Lý":    { text: "#8A5A00", bg: "#FCF3E2", border: "#F3DFB8" },
  "Hóa Học":   { text: "#0E7350", bg: "#E8F7F1", border: "#BCE5D6" },
  "Sinh Học":  { text: "#1A5FB0", bg: "#EAF3FC", border: "#C4DCF4" },
  "Lịch Sử":  { text: "#8A5A00", bg: "#FCF3E2", border: "#F3DFB8" },
  "Địa Lý":   { text: "#0E7350", bg: "#E8F7F1", border: "#BCE5D6" },
  "GDCD":      { text: "#B23C00", bg: "#FDEDE1", border: "#F8D5B8" },
  "Tin Học":   { text: "#0E6E86", bg: "#E4F6FB", border: "#BCE3EE" },
};

const defaultColor: SubjectColor = { text: "#6C4CF1", bg: "#F1EDFD", border: "#DCD4FA" };

export function getSubjectColor(subject: string): SubjectColor {
  return subjectMap[subject] ?? defaultColor;
}
