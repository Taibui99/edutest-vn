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