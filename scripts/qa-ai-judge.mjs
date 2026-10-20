/**
 * Test thuần cho AI giám khảo PARSE-2 (prompt + đọc JSON + gắn cờ) — không gọi AI.
 * Chạy: node scripts/qa-ai-judge.mjs
 */
import assert from "node:assert/strict";
import { buildJudgePrompt, parseJudgeFindings, applyJudgeFindings, JUDGE_MAX_QUESTIONS } from "../lib/ai-judge.ts";

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

const payload = {
  title: "ĐỀ THI HÓA 10",
  questions: [
    { index: 0, type: "mcq", question: "Năng lượng liên kết H–H?", options: ["775 kJ", "850 kJ", "920 kJ", "436 kJ"], answer: "D", points: 2 },
    { index: 1, type: "mcq", question: "Số oxi hóa của Mn?", options: ["+2", "+4", "+6", "+7"], answer: "D", points: 1 },
  ],
};

t("prompt chứa nguyên văn, payload và luật không sửa đáp án", () => {
  const prompt = buildJudgePrompt("Câu 1: Năng lượng liên kết H–H?\nĐáp án: D", payload);
  assert.match(prompt, /NGUYÊN VĂN/);
  assert.match(prompt, /Năng lượng liên kết H–H\?/);
  assert.match(prompt, /KẾT QUẢ ĐỌC TỰ ĐỘNG/);
  assert.match(prompt, /"answer":"D"/);
  assert.match(prompt, /KHÔNG: chấm điểm/);
  assert.match(prompt, /Trả về DUY NHẤT JSON/);
  assert.match(prompt, /ĐỀ THI HÓA 10/);
});

t("prompt cắt payload quá JUDGE_MAX_QUESTIONS câu", () => {
  const big = {
    questions: Array.from({ length: JUDGE_MAX_QUESTIONS + 20 }, (_, i) => ({
      index: i, type: "mcq", question: `Câu hỏi số ${i + 1}`, options: ["a", "b", "c", "d"], answer: "A",
    })),
  };
  const prompt = buildJudgePrompt("nguồn", big);
  assert.ok(prompt.includes(`"n":${JUDGE_MAX_QUESTIONS}`));
  assert.ok(!prompt.includes(`"n":${JUDGE_MAX_QUESTIONS + 1}`));
});

t("parseJudgeFindings: JSON thường + fence + rác quanh", () => {
  assert.deepEqual(parseJudgeFindings('{"findings":[{"question":2,"issue":"đáp án ghi B, đề ghi D"}]}'), [
    { question: 2, message: "đáp án ghi B, đề ghi D" },
  ]);
  assert.equal(
    parseJudgeFindings('```json\n{"findings":[{"question":1,"issue":"mất lựa chọn C"}]}\n```')[0].message,
    "mất lựa chọn C",
  );
  const noisy = parseJudgeFindings('Kết quả: {"findings":[{"question":3,"issue":"số liệu bảng lệch"}]} cảm ơn!');
  assert.equal(noisy.length, 1);
  assert.equal(noisy[0].question, 3);
});

t("parseJudgeFindings: JSON hỏng → []; question không hợp lệ → null", () => {
  assert.deepEqual(parseJudgeFindings("xin lỗi tôi không thể"), []);
  assert.deepEqual(parseJudgeFindings(null), []);
  const weird = parseJudgeFindings('{"findings":[{"issue":"thiếu ý"},{"question":0,"issue":"lỗi toàn bài"},{"question":"abc","issue":"không phải số"},{"issue":""}]}');
  assert.equal(weird.length, 3);
  assert.equal(weird[0].question, null);
  assert.equal(weird[1].question, null);
  assert.equal(weird[2].question, null);
});

t("applyJudgeFindings: gắn cờ câu + issue, KHÔNG sửa đáp án", () => {
  const p = JSON.parse(JSON.stringify(payload));
  const issues = [];
  const { flagged } = applyJudgeFindings(p, issues, [
    { question: 1, message: "đáp án trong JSON D nhưng nguyên văn ghi A" },
    { question: 1, message: "đáp án trong JSON D nhưng nguyên văn ghi A" }, // trùng → bỏ
    { question: null, message: "bỏ sót câu ở cuối đề" },
    { question: 99, message: "số câu vượt quá" }, // out of range → toàn bài
  ]);
  assert.equal(flagged, 1);
  assert.equal(p.questions[0].needsReview, true);
  assert.equal(p.questions[0].answer, "D"); // nguyên vẹn
  assert.notEqual(p.questions[1].needsReview, true);
  assert.equal(issues.length, 3); // 1 câu (dedupe) + 2 toàn bài
  assert.ok(issues.some((i) => i.question === 1 && /Đối chiếu phát hiện/.test(i.message)));
  assert.ok(issues.filter((i) => i.question === null).length === 2);
});

t("applyJudgeFindings: findings rỗng → không thay đổi gì", () => {
  const p = JSON.parse(JSON.stringify(payload));
  const issues = [];
  const { flagged } = applyJudgeFindings(p, issues, []);
  assert.equal(flagged, 0);
  assert.equal(issues.length, 0);
  assert.notEqual(p.questions[0].needsReview, true);
});

console.log(`\n${passed} test pass`);
