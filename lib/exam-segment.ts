/**
 * AI-10 — cắt tài liệu thành khối câu hỏi XÁC ĐỊNH trước khi gọi model.
 *
 * Vấn đề: đề không đánh số ("Câu 1", "Câu 2"), câu hỏi lẫn lộn không theo phần
 * → model tự mò ranh giới nên rớt lung tung (đếm được 1/2/11/16/20/21 câu trên
 * cùng 1 file). Máy cắt khối (regex, deterministic), AI chỉ điền nội dung từng
 * khối + ĐIỂM DANH đủ (trường `block`), server đối chiếu độ phủ, thiếu thì
 * chạy bù đúng các khối thiếu (tối đa 1 lần).
 *
 * Thuần hàm, không IO — test bằng `node scripts/qa-ai-exam-build.mjs`.
 */

export interface TextBlock {
  /** Số khối từ 1, dùng để model điểm danh lại. */
  index: number;
  /** Chữ trước đáp án (câu hỏi + chữ thừa xung quanh — model tự lọc). */
  stem: string;
  /** Các lựa chọn đã tách (kể cả chung dòng, cách nhau bằng tab). */
  options: string[];
  /** Chữ sau đáp án mà phía sau không còn đáp án nào (thường là hướng dẫn
   *  giải — model dùng làm explanation, không phải câu mới). */
  note: string;
}

const OPT_START = /^[A-D][\.\)\:]/;

/**
 * Cắt 1 dòng thành nhiều đáp án nếu chúng nằm chung dòng ("A. x B. y",
 * "A. 1.B. 2" — đề gõ dính hay gặp). Ranh giới: trước chữ cái là đầu dòng /
 * khoảng trắng / dấu câu, sau dấu chấm là khoảng trắng / chữ / hết dòng
 * (chặn "B.52" dính trong số liệu).
 */
export function splitOptionLine(line: string): string[] {
  const marks: number[] = [];
  // `$` trong lookbehind: đề chèn công thức LaTeX dính liền lựa chọn
  // ("$T(K)=…$B. $t(…)=…$") — không có khoảng trắng trước "B.".
  const re = /(?<=[\s.,;:()"'$]|^)([A-D])[\.\)\:](?=[\sA-Za-zÀ-ỹ]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) marks.push(m.index);
  if (!marks.length || marks[0] !== 0) return [line];
  return marks.map((start, i) => line.slice(start, marks[i + 1] ?? line.length).trim()).filter(Boolean);
}

export function isOptionLine(line: string): boolean {
  return OPT_START.test(line.trim());
}

/**
 * Gom dòng thành khối + lời mở đầu. Chữ gom làm stem, đáp án gom làm options.
 * Chữ sau đáp án mà phía sau hết đáp án thì thành note (hướng dẫn giải...).
 * Chữ trước đáp án ĐẦU TIÊN của cả tài liệu (tiêu đề, giới thiệu) tách riêng
 * làm preamble — không đánh số, không bắt điểm danh.
 */
export function segmentQuestions(text: string): { blocks: TextBlock[]; preamble: string } {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: TextBlock[] = [];
  const leading: string[] = [];
  let stem: string[] = [];
  let options: string[] = [];
  let seenOptions = false;

  const flush = (note: string[] = []) => {
    if (options.length) {
      blocks.push({ index: blocks.length + 1, stem: stem.join("\n"), options, note: note.join("\n") });
    }
    stem = [];
    options = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isOptionLine(line)) {
      seenOptions = true;
      options.push(...splitOptionLine(line));
      continue;
    }
    // Dòng chữ: nếu khối hiện tại đã có đáp án VÀ phía sau còn đáp án nữa thì
    // đây là stem khối mới (kèm chữ giải thích lẫn lộn model tự lọc) → chốt khối cũ.
    if (options.length > 0) {
      let moreOptionsAhead = false;
      for (let j = i; j < lines.length; j++) {
        if (isOptionLine(lines[j])) {
          moreOptionsAhead = true;
          break;
        }
      }
      if (moreOptionsAhead) {
        flush();
        stem.push(line);
        continue;
      }
      // Hết đáp án phía sau: chữ còn lại là note của khối hiện tại.
      flush([line, ...lines.slice(i + 1)]);
      break;
    }
    // Chưa thấy đáp án nào: chữ mở đầu tài liệu.
    if (!seenOptions) leading.push(line);
    else stem.push(line);
  }
  flush();

  // Khối đầu không stem (câu hỏi nằm lẫn trong mở đầu): kéo tối đa 3 dòng
  // cuối của mở đầu xuống làm stem — thiếu stem model không biết hỏi gì.
  if (blocks.length && !blocks[0].stem.trim() && leading.length) {
    const take = leading.splice(Math.max(0, leading.length - 3));
    blocks[0].stem = take.join("\n");
  }

  return { blocks, preamble: leading.join("\n") };
}

/** Render khối để gửi model (đánh số để điểm danh). */
export function formatBlocks(blocks: TextBlock[], preamble = ""): string {
  const head = preamble.trim()
    ? `BỐI CẢNH CHUNG (tiêu đề/giới thiệu tài liệu, không phải câu hỏi):\n${preamble.trim()}\n\n`
    : "";
  return (
    head +
    blocks
      .map((b) => {
        let s = `--- KHỐI ${b.index} ---\nCÂU HỎI:\n${b.stem || "(không có chữ, chỉ có đáp án)"}`;
        if (b.options.length) s += `\nCÁC LỰA CHỌN:\n${b.options.join("\n")}`;
        if (b.note) s += `\nGHI CHÚ THÊM (có thể là lời giải, dùng khi cần):\n${b.note}`;
        return s;
      })
      .join("\n\n")
  );
}
