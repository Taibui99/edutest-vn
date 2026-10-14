export type GradingPayload = {
  statements?: Array<{ text?: string; answer?: boolean }>;
  acceptedAnswers?: string[];
};

export type AnswerValue = string | boolean[] | { statements?: boolean[]; text?: string } | Record<string, boolean>;

export function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toBooleanArray(selected: Exclude<AnswerValue, string> | undefined): boolean[] {
  if (!selected || typeof selected !== "object") return [];
  const asObj = selected as Record<string, unknown>;
  if (Array.isArray((selected as { statements?: boolean[] }).statements)) {
    return (selected as { statements: boolean[] }).statements;
  }
  const keys = Object.keys(asObj);
  if (keys.length > 0) {
    return keys
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => Boolean(asObj[k]));
  }
  return [];
}

export function isQuestionCorrect(
  question: { type: string; answer?: string | null; grading?: unknown },
  selected: AnswerValue | undefined,
) {
  if (selected === undefined || selected === null) return false;

  if (question.type === "mcq") {
    return typeof selected === "string" && selected.trim().toUpperCase() === (question.answer || "").toUpperCase();
  }

  if (question.type === "true_false") {
    const expected =
      ((question.grading as GradingPayload | null | undefined)?.statements || []).map((s) => Boolean(s.answer));
    const actual = toBooleanArray(typeof selected === "string" ? undefined : selected);
    return expected.length > 0 && expected.length === actual.length && expected.every((value, index) => value === actual[index]);
  }

  if (question.type === "short_answer") {
    const accepted =
      ((question.grading as GradingPayload | null | undefined)?.acceptedAnswers || []).map(normalizeText);
    let value = "";
    if (typeof selected === "string") value = selected;
    else if (typeof selected === "object" && typeof (selected as { text?: string }).text === "string") value = (selected as { text: string }).text;
    return accepted.includes(normalizeText(value));
  }

  return false;
}

export function isAutoGraded(question: { type: string }) {
  return question.type !== "essay";
}

export function pointsOf(question: { points?: unknown }) {
  return typeof question.points === "number" && question.points > 0 ? question.points : 1;
}

/* GRADE-1 — chấm 1 bài, có TRỌNG SỐ điểm từng câu + điểm chấm tay tự luận.
 * Dùng chung cho nộp bài (POST) và chấm bổ sung (PATCH) để hai đường không
 * bao giờ lệch nhau.
 *
 * Tự luận LUÔN nằm trong mẫu số; chưa chấm tay thì tạm tính 0 điểm. Nhờ vậy
 * mẫu số cố định — điểm chỉ TĂNG khi giáo viên chấm, không nhảy lộn xộn (đúng
 * lỗi user báo "chấm điểm chưa ổn định"). */
export function scoreSubmission<T extends { id: string; type: string; points?: unknown; answer?: string | null; grading?: unknown }>(
  questions: T[],
  answers: Record<string, AnswerValue>,
  manual: Record<string, number> = {},
): { score: number; correctCount: number } {
  let earned = 0;
  let total = 0;
  let correctCount = 0;
  for (const q of questions) {
    const pts = pointsOf(q);
    total += pts;
    if (isAutoGraded(q)) {
      if (isQuestionCorrect(q, answers[q.id])) {
        earned += pts;
        correctCount += 1;
      }
    } else {
      const m = manual[q.id];
      if (typeof m === "number" && Number.isFinite(m)) {
        earned += Math.min(pts, Math.max(0, m));
      }
    }
  }
  return { score: total > 0 ? Number(((earned / total) * 10).toFixed(2)) : 0, correctCount };
}