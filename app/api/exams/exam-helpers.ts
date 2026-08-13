import { Prisma } from "@prisma/client";

export type QuestionType = "mcq" | "true_false" | "short_answer" | "essay";

export type IncomingQuestion = {
  type?: QuestionType;
  question?: string;
  text?: string;
  options?: string[];
  answer?: string;
  grading?: unknown;
  points?: number;
};

export type NormalizedQuestion = {
  type: QuestionType;
  text: string;
  options: string[];
  answer: string;
  grading: Prisma.InputJsonValue | undefined;
  points: number;
  order: number;
};

export function normalizeGrading(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  try {
    JSON.stringify(value);
    return value as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

export function normalizeQuestions(questions: IncomingQuestion[]): NormalizedQuestion[] {
  return questions.map((item, index) => {
    const type: QuestionType = ["mcq", "true_false", "short_answer", "essay"].includes(item.type || "")
      ? (item.type as QuestionType)
      : "mcq";
    const text = (item.question || item.text || "").trim();
    const options = Array.isArray(item.options) ? item.options.map(String).map((x) => x.trim()).filter(Boolean) : [];
    const answer = String(item.answer || "").trim().toUpperCase();
    const points = Number.isFinite(Number(item.points)) && Number(item.points) > 0 ? Number(item.points) : 1;

    return {
      type,
      text,
      options,
      answer,
      grading: normalizeGrading(item.grading),
      points,
      order: index + 1,
    };
  });
}

export function validateQuestion(question: NormalizedQuestion) {
  if (!question.text) return "Câu hỏi không được để trống";

  switch (question.type) {
    case "mcq": {
      const uniqueOptions = new Set(question.options.map((option) => option.toLowerCase()));
      const answerIndex = question.answer.charCodeAt(0) - 65;
      if (question.options.length < 2 || question.options.length > 4 || uniqueOptions.size !== question.options.length) {
        return "Trắc nghiệm cần từ 2-4 đáp án không trùng nhau";
      }
      if (!["A", "B", "C", "D"].includes(question.answer) || answerIndex < 0 || answerIndex >= question.options.length) {
        return "Đáp án đúng của câu trắc nghiệm không hợp lệ";
      }
      return null;
    }
    case "true_false": {
      const grading = question.grading as { statements?: Array<{ text?: string; answer?: boolean }> } | undefined;
      if (!grading?.statements || grading.statements.length === 0) return "Câu Đúng/Sai cần ít nhất một mệnh đề";
      if (grading.statements.some((s) => !String(s.text || "").trim() || typeof s.answer !== "boolean")) {
        return "Mỗi mệnh đề Đúng/Sai cần nội dung và đáp án";
      }
      return null;
    }
    case "short_answer": {
      const grading = question.grading as { acceptedAnswers?: string[] } | undefined;
      const accepted = Array.isArray(grading?.acceptedAnswers) ? grading.acceptedAnswers.filter((x) => String(x).trim()) : [];
      return accepted.length ? null : "Câu trả lời ngắn cần ít nhất một đáp án chấp nhận";
    }
    case "essay":
      return null;
  }
}
