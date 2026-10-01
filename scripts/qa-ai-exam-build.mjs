/**
 * Test thuần cho pipeline AI dựng đề (không gọi Gemini, không cần DB).
 * Chạy: node scripts/qa-ai-exam-build.mjs
 */
import assert from "node:assert/strict";
import {
  detectAnswerKey,
  normalizeDifficulty,
  normalizeMcqAnswer,
  normalizeQuestion,
  computeStats,
  reconcileAnswers,
} from "../lib/ai-exam-build.ts";

let passed = 0;
const t = (name, fn) => {
  try {
    fn();
    passed++;
    console.log("  ok  " + name);
  } catch (e) {
    console.log("  FAIL " + name + " :: " + e.message);
    process.exitCode = 1;
  }
};

t("normalizeDifficulty nhận mọi biến thể", () => {
  assert.equal(normalizeDifficulty("Vận dụng"), "vận dụng");
  assert.equal(normalizeDifficulty("THÔNG HIỂU"), "thông hiểu");
  assert.equal(normalizeDifficulty("nhận biết"), "nhận biết");
  assert.equal(normalizeDifficulty("mức độ: cao"), "vận dụng");
  assert.equal(normalizeDifficulty("apply level"), "vận dụng");
  assert.equal(normalizeDifficulty(""), null);
  assert.equal(normalizeDifficulty("abcxyz"), null);
});

t("normalizeMcqAnswer chấp nhận A-D, chữ thường, số", () => {
  assert.equal(normalizeMcqAnswer("b", 4), "B");
  assert.equal(normalizeMcqAnswer("C.", 4), "C");
  assert.equal(normalizeMcqAnswer("3", 4), "C");
  assert.equal(normalizeMcqAnswer("", 4), null);
  assert.equal(normalizeMcqAnswer("H", 4), null);
});

t("normalizeMcqAnswer chặn đáp án ngoài khoảng lựa chọn", () => {
  assert.equal(normalizeMcqAnswer("E", 4), null);
  assert.equal(normalizeMcqAnswer("D", 4), "D");
  assert.equal(normalizeMcqAnswer("6", 6), "F");
});

t("detectAnswerKey dò được bảng đáp án cuối đề", () => {
  const text = `Câu 1: 2+2 = ?\nA. 3 B. 4 C. 5 D. 6\n\nĐÁP ÁN: 1.B 2.A 3.D 4.C`;
  assert.deepEqual(detectAnswerKey(text), { 1: "B", 2: "A", 3: "D", 4: "C" });
});

t("detectAnswerKey dò được bảng 'Câu 1: A'", () => {
  const key = detectAnswerKey("Câu 1: A\nCâu 2: C\nCâu 3: D");
  assert.equal(key?.[1], "A");
  assert.equal(key?.[3], "D");
});

t("detectAnswerKey trả null khi đề không có đáp án", () => {
  assert.equal(detectAnswerKey("Câu 1: Thủy điện là gì?\nA. ... B. ..."), null);
  assert.equal(detectAnswerKey(""), null);
});

t("detectAnswerKey không nhầm phần đặt câu hỏi", () => {
  assert.equal(detectAnswerKey("Cau 1: 2+2 = ?\nA. 3  B. 4  C. 5  D. 6"), null);
  assert.equal(detectAnswerKey("Cau 1: Chon dap an dung?\nA. 1  B. 2"), null);
});

t("normalizeQuestion làm sạch lựa chọn và ép type", () => {
  const q = normalizeQuestion({ type: "khong-bi", question: " 2+2? ", options: ["A. 3", "B. 4", "c. 5", "D. 6"], answer: "b" }, 0);
  assert.equal(q.type, "mcq");
  assert.deepEqual(q.options, ["3", "4", "5", "6"]);
  assert.equal(q.answer, "B");
  assert.equal(q.points, 1);
});

t("normalizeQuestion bỏ đáp án MCQ vô lý thay vì đoán", () => {
  const q = normalizeQuestion({ type: "mcq", question: "c", options: ["a", "b", "c", "d"], answer: "E" }, 0);
  assert.equal(q.answer, "");
});

t("reconcileAnswers: đồng thuận thì tin, lệch thì lấy phá thế hoản", () => {
  const qs = [
    normalizeQuestion({ question: "c1", options: ["a", "b", "c", "d"], answer: "" }, 0),
    normalizeQuestion({ question: "c2", options: ["a", "b", "c", "d"], answer: "" }, 1),
  ];
  const votes = new Map([
    [0, { a: "B", b: "B" }],
    [1, { a: "B", b: "C", tie: "C" }],
  ]);
  const { questions, agreed } = reconcileAnswers(qs, votes);
  assert.equal(questions[0].answer, "B");
  assert.equal(questions[0].needsReview, false);
  assert.equal(questions[0].solveNote, "2 lượt đồng thuận");
  assert.equal(agreed, 1);
  assert.equal(questions[1].answer, "C");
  assert.equal(questions[1].solveNote, "Lượt 1 và 2 lệch nhau, đã phá thế hoản");
});

t("reconcileAnswers: không có phiếu nào thì đánh dấu cần xem", () => {
  const qs = [normalizeQuestion({ question: "c1", options: ["a", "b", "c", "d"], answer: "" }, 0)];
  const { questions } = reconcileAnswers(qs, new Map([[0, {}]]));
  assert.equal(questions[0].answer, "");
  assert.equal(questions[0].needsReview, true);
});

t("reconcileAnswers: lệch mà không phá thế hoản thì bắt xem lại", () => {
  const qs = [normalizeQuestion({ question: "c1", options: ["a", "b", "c", "d"], answer: "" }, 0)];
  const { questions } = reconcileAnswers(qs, new Map([[0, { a: "B", b: "C" }]]));
  assert.equal(questions[0].needsReview, true);
  assert.equal(questions[0].answer, "B");
});

t("computeStats đếm đúng nguồn đáp án", () => {
  const payload = {
    kind: "mcq",
    answerKeyFound: true,
    questions: [
      normalizeQuestion({ question: "q1", options: ["a", "b", "c", "d"], answer: "A", answerSource: "document" }, 0),
      normalizeQuestion({ question: "q2", options: ["a", "b", "c", "d"], answer: "B", answerSource: "ai", solveNote: "2 lượt đồng thuận" }, 1),
      normalizeQuestion({ question: "q3", options: ["a", "b", "c", "d"], answer: "", answerSource: "ai", needsReview: true }, 2),
    ],
  };
  const s = computeStats(payload, 1);
  assert.equal(s.total, 3);
  assert.equal(s.fromDocument, 1);
  assert.equal(s.aiSolved, 2);
  assert.equal(s.needsReview, 1);
  assert.equal(s.missingAnswer, 1);
  assert.equal(s.answerKeyFound, true);
});

console.log(`\n${passed} nhóm test đã pass`);
