/**
 * Test thuần cho bộ đọc đề rule PARSE-1 (không AI, không DB).
 * Chạy: node scripts/qa-exam-parse.mjs
 */
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { parseExamText } from "../lib/exam-parse.ts";
import { extractDocxText } from "../lib/exam-docx.ts";

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

const STD = `ĐỀ THI KIỂM TRA HỌC KỲ I
Môn: Hóa học 10

Câu 1 (2đ): Năng lượng của 1 mol liên kết H–H là?
A. 775 kJ
B. 850 kJ
C. 920 kJ
D. 436 kJ
Đáp án: D
Giải thích: Giá trị bảng liên kết chuẩn.

Câu 2: Số oxi hóa của Mn trong KMnO₄ là?
A. +2
B. +4
C. +6
D. +7
Đáp án: D

Câu 3: Phản ứng nào là trung hòa?
A. NaOH + HCl
B. NaCl + KOH
C. Na + H₂O
D. CaO + CO₂
Đáp án: A

Câu 4: Thể tích 2 mol khí ở STP là?
A. 11,2 L
B. 22,4 L
C. 24 L
D. 44,8 L
Đáp án: B`;

t("đề chuẩn: đủ 4 câu, đáp án inline, điểm, tiêu đề", () => {
  const { payload, issues } = parseExamText(STD);
  assert.equal(payload.questions.length, 4);
  assert.equal(payload.title, "ĐỀ THI KIỂM TRA HỌC KỲ I");
  assert.equal(payload.kind, "mcq");
  const [q1, q2, q3, q4] = payload.questions;
  assert.equal(q1.answer, "D");
  assert.equal(q1.points, 2);
  assert.match(q1.question, /liên kết H–H/);
  assert.equal(q1.options.length, 4);
  assert.equal(q1.options[3], "436 kJ");
  assert.equal(q2.answer, "D");
  assert.equal(q3.answer, "A");
  assert.equal(q4.answer, "B");
  assert.equal(q4.points, 1);
  for (const q of payload.questions) {
    assert.equal(q.answerSource, "document");
    assert.equal(q.needsReview, false);
  }
  assert.equal(issues.filter((i) => /thiếu đáp án/.test(i.message)).length, 0);
  assert.equal(payload.answerKeyFound, true);
});

t("bảng đáp án cuối bài điền cho câu còn trống", () => {
  const text = `Câu 1: 1 + 1 = ?
A. 1
B. 2
C. 3
D. 4

Câu 2: 2 + 2 = ?
A. 2
B. 3
C. 4
D. 5

Câu 3: 3 + 3 = ?
A. 5
B. 6
C. 7
D. 8

ĐÁP ÁN: 1.B 2.C 3.B`;
  const { payload } = parseExamText(text);
  assert.deepEqual(payload.questions.map((q) => q.answer), ["B", "C", "B"]);
  assert.ok(payload.questions.every((q) => q.answerSource === "document"));
});

t("đánh số trần + options chung dòng vẫn tách đủ", () => {
  const text = `1) Khí nào sau đây là khí nhà kính?
A. O₂  B. N₂  C. CO₂  D. Ar
Đáp án: C

2) Kim nào hoạt động mạnh nhất?
A. Cu  B. Ag  C. Fe  D. K
Đáp án: D`;
  const { payload } = parseExamText(text);
  assert.equal(payload.questions.length, 2);
  assert.equal(payload.questions[0].options.length, 4);
  assert.equal(payload.questions[0].options[2], "CO₂");
  assert.equal(payload.questions[0].answer, "C");
  assert.equal(payload.questions[1].answer, "D");
});

t("marker tô màu (Word) thắng đáp án ghi text, marker được gỡ khỏi options", () => {
  const text = `Câu 1: Khí nào gây hiệu ứng nhà kính?
A. O₂
B. N₂
C. CO₂ [ĐÁP ÁN ĐÚNG THEO TÀI LIỆU]
D. Ar
Đáp án: A`;
  const { payload } = parseExamText(text);
  const q = payload.questions[0];
  assert.equal(q.answer, "C");
  assert.equal(q.answerSource, "document");
  assert.equal(q.options[2], "CO₂");
  assert.ok(!JSON.stringify(payload).includes("ĐÁP ÁN ĐÚNG"));
});

t("Đúng/Sai: mệnh đề đánh số + danh sách đáp án thành statements", () => {
  const text = `Câu 5: Phát biểu nào đúng?
1. Na là kim kiềm.
2. Cu là kim quý.
3. Fe phản ứng với axit HCl.
Đáp án: Đúng, Đúng, Sai`;
  const { payload } = parseExamText(text);
  const q = payload.questions[0];
  assert.equal(q.type, "true_false");
  assert.equal(q.grading.statements.length, 3);
  assert.deepEqual(q.grading.statements.map((s) => s.answer), [true, true, false]);
  assert.match(q.grading.statements[0].text, /Na là kim kiềm/);
});

t("đề KHÔNG đánh số → fallback cắt theo khối lựa chọn", () => {
  const text = `Nhiệt độ của nước sôi là bao nhiêu?
A. 50 độ C
B. 90 độ C
C. 100 độ C
D. 120 độ C
Đáp án: C

Áp suất bình thường là?
A. 1 atm
B. 2 atm
C. 5 atm
D. 10 atm
Đáp án: A`;
  const { payload } = parseExamText(text);
  assert.equal(payload.questions.length, 2);
  assert.equal(payload.questions[0].answer, "C");
  assert.equal(payload.questions[1].answer, "A");
});

t("thiếu đáp án → needsReview + issue hướng dẫn AI giải giúp", () => {
  const text = `Câu 1: Axit clohidric là?
A. HCl
B. HNO₃
C. H₂SO₄
D. H₃PO₄

Câu 2: Baze là chất gì?
A. Chua
B. Bazơ
C. Muối
D. Khí
Đáp án: B`;
  const { payload, issues } = parseExamText(text);
  assert.equal(payload.questions[0].answer, "");
  assert.equal(payload.questions[0].needsReview, true);
  assert.equal(payload.questions[0].answerSource, "unknown");
  assert.equal(payload.questions[1].answer, "B");
  assert.ok(issues.some((i) => i.question === 1 && /AI giải giúp/.test(i.message)));
});

t("trả lời ngắn: đáp án chữ được giữ nguyên", () => {
  const text = `Câu 1: Thể tích khối 6 dm³ bằng bao nhiêu m³?
Đáp án: 0,006 m³`;
  const { payload } = parseExamText(text);
  assert.equal(payload.questions[0].type, "short_answer");
  assert.equal(payload.questions[0].answer, "0,006 m³");
  assert.equal(payload.kind, "theory");
});

t("key tô màu (docKey) override đáp án text", () => {
  const text = `Câu 1: Năng lượng liên kết H–H?
A. 775 kJ/mol
B. 850 kJ/mol
C. 920 kJ/mol
D. 436 kJ/mol
Đáp án: A`;
  const { payload } = parseExamText(text, {
    docKey: [{ letter: "D", text: "D. 436 kJ/mol" }],
  });
  assert.equal(payload.questions[0].answer, "D");
  assert.equal(payload.questions[0].needsReview, false);
});

t("file rác không có câu hỏi → ném lỗi rõ ràng", () => {
  assert.throws(
    () => parseExamText("Đây là tài liệu lý thuyết chung chung, không có câu hỏi trắc nghiệm nào cả."),
    /Không nhận diện được câu hỏi/,
  );
});

t("DOCX có bảng → serialize dạng | cột |, bảng dính vào stem câu hỏi", () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>Câu 1: Dựa vào bảng số liệu sau, sản lượng năm 2020 là bao nhiêu?</w:t></w:r></w:p>
<w:tbl>
<w:tr><w:tc><w:p><w:r><w:t>Năm</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Sản lượng</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>2019</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>120</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>2020</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>150</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl>
<w:p><w:r><w:t>A. 120</w:t></w:r></w:p>
<w:p><w:r><w:t>B. 150</w:t></w:r></w:p>
<w:p><w:r><w:t>C. 180</w:t></w:r></w:p>
<w:p><w:r><w:t>D. 200</w:t></w:r></w:p>
<w:p><w:r><w:t>Đáp án: B</w:t></w:r></w:p>
</w:body></w:document>`;
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(documentXml, "utf8"));
  const rich = extractDocxText(zip.toBuffer());
  assert.match(rich.text, /\| Năm \| Sản lượng \|/);
  assert.match(rich.text, /\| 2020 \| 150 \|/);
  const { payload, issues } = parseExamText(rich.text, { images: rich.images });
  assert.equal(payload.questions.length, 1);
  assert.match(payload.questions[0].question, /\| 2020 \| 150 \|/);
  assert.equal(payload.questions[0].answer, "B");
  assert.ok(issues.some((i) => /dòng bảng số liệu/.test(i.message)));
  assert.equal(rich.images, 0);
});

t("câu tham chiếu hình → needsReview + ghi chú; 'hình tam giác' không flag", () => {
  const text = `Câu 1: Dựa vào hình 1, số mol khí thoát ra là?
A. 0,1
B. 0,2
C. 0,3
D. 0,4
Đáp án: C

Câu 2: Cho hình tam giác ABC cân tại A. Góc B bằng bao nhiêu?
A. 30 độ
B. 45 độ
C. 60 độ
D. 90 độ
Đáp án: C`;
  const { payload, issues } = parseExamText(text);
  assert.equal(payload.questions[0].needsReview, true);
  assert.ok(issues.some((i) => i.question === 1 && /hình\/biểu đồ/.test(i.message)));
  assert.equal(payload.questions[1].needsReview, false);
});

t("opts.images > 0 → ghi chú tài liệu có ảnh", () => {
  const text = `Câu 1: Nước sôi ở 100 độ C ở áp suất nào?
A. 1 atm
B. 2 atm
C. 0,5 atm
D. 1,5 atm
Đáp án: A`;
  const { issues } = parseExamText(text, { images: 3 });
  assert.ok(issues.some((i) => /chứa 3 ảnh/.test(i.message)));
});

console.log(`\n${passed} test pass`);
