/**
 * Hệ thống thi cho máy iOS cũ — HTML thuần, không React, không Tailwind.
 *
 * Toàn bộ CSS nằm trong <style> dưới đây và CHỈ dùng tính năng Safari 15 có sẵn:
 * KHÔNG `@property`, KHÔNG `color-mix()`, KHÔNG `oklch()`, KHÔNG `@layer`,
 * KHÔNG `:has()`. Nhờ vậy trang hiển thị và bấm được trên iOS 15.
 *
 * Tệp này thuần render (không đụng DB) để dễ đọc và dễ test.
 */

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const LETTER = (i: number) => String.fromCharCode(65 + i);

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#eef2f7;color:#0f172a;font-size:17px;line-height:1.55;-webkit-text-size-adjust:100%}
.wrap{max-width:720px;margin:0 auto;padding:14px 14px 56px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin-bottom:14px}
.top{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 14px}
.top .bar{max-width:720px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px}
.top h1{font-size:16px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.timer{font-weight:800;font-size:16px;color:#1d4ed8;font-variant-numeric:tabular-nums;white-space:nowrap}
.timer.low{color:#b91c1c}
.timer.gone{color:#6b7280}
h1{font-size:22px;margin:0 0 6px}
h2{font-size:18px;margin:0 0 6px}
p{margin:6px 0}
.muted{color:#64748b;font-size:15px}
.sub{color:#334155;font-size:15px}
.q{padding:14px 0;border-bottom:1px solid #eef2f7}
.q:last-child{border-bottom:0}
.qhead{display:flex;gap:8px;align-items:baseline;margin-bottom:10px}
.qnum{flex:0 0 auto;font-weight:800;color:#1d4ed8}
.qtext{font-weight:600}
.qimg{display:block;max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:12px;margin:8px 0}
.opt{display:flex;align-items:flex-start;gap:10px;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;margin:8px 0;cursor:pointer}
.opt:active{background:#f8fafc}
.opt input{width:20px;height:20px;margin:2px 0 0;flex:0 0 auto}
.opt .letter{font-weight:800;color:#475569;flex:0 0 auto}
.tfrow{display:flex;align-items:center;gap:8px;padding:8px 0}
.tfrow .st{flex:1}
.tfrow label{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer}
.tfrow input{width:20px;height:20px}
input[type=text],textarea{width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;font-size:17px;font-family:inherit;background:#fff}
textarea{min-height:110px}
label.fld{display:block;margin:12px 0 4px;font-weight:600}
.btn{display:block;width:100%;background:#2563eb;color:#fff;border:0;border-radius:14px;padding:16px;font-size:18px;font-weight:800;margin-top:14px;cursor:pointer;-webkit-appearance:none}
.btn.sec{background:#fff;color:#334155;border:1.5px solid #cbd5e1}
.btn.big{padding:18px;font-size:19px}
.pill{display:inline-block;padding:3px 9px;border-radius:999px;font-size:13px;font-weight:700}
.ok{background:#dcfce7;color:#166534}
.bad{background:#fee2e2;color:#991b1b}
.warn{background:#fef3c7;color:#92400e}
.info{background:#dbeafe;color:#1e40af}
.score{font-size:44px;font-weight:900;margin:4px 0}
.rev{margin-top:10px;border-top:1px solid #eef2f7;padding-top:10px}
.rev .ans{display:block;margin:3px 0;font-size:15px}
.center{text-align:center}
.note{background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:10px 12px;font-size:15px;margin-bottom:12px}
.err{background:#fee2e2;border:1px solid #fecaca;border-radius:12px;padding:10px 12px;font-size:15px;color:#991b1b;margin-bottom:12px}
`;

const VIEWPORT = "width=device-width, initial-scale=1, viewport-fit=cover";

function shell(title: string, body: string, head = ""): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="${VIEWPORT}">
<meta name="format-detection" content="telephone=no, date=no, email=no, address=no">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>${CSS}</style>
${head}
</head>
<body>
${body}
</body>
</html>`;
}

export type LegacyQuestion = {
  id: string;
  type: string;
  text: string;
  options: string[];
  answer: string;
  grading: unknown;
  explanation?: string | null;
  points?: number;
  order: number;
};

/** Trang thông báo chung (lỗi / hết lượt / đang làm bài khác...).
 *  `refresh` (giây): thêm `<meta http-equiv="refresh">` để trang TỰ nạp lại.
 *  Dùng cho trạng thái "chưa mở" — trang cũ không có JS nên meta refresh là
 *  cách duy nhất tới giờ mở mà không cần học sinh F5. */
export function messageView(opts: { title: string; text: string; pill?: { label: string; cls: string }; action?: { href: string; label: string }; secondary?: { href: string; label: string }; refresh?: number }): string {
  const body = `<div class="wrap"><div class="card center">
    ${opts.pill ? `<span class="pill ${opts.pill.cls}">${esc(opts.pill.label)}</span>` : ""}
    <h1>${esc(opts.title)}</h1>
    <p class="muted">${esc(opts.text)}</p>
    ${opts.refresh ? `<p class="muted">Trang sẽ tự tải lại sau ${esc(opts.refresh)} giây.</p>` : ""}
    ${opts.action ? `<a class="btn" href="${esc(opts.action.href)}">${esc(opts.action.label)}</a>` : ""}
    ${opts.secondary ? `<a class="btn sec" href="${esc(opts.secondary.href)}">${esc(opts.secondary.label)}</a>` : ""}
  </div></div>`;
  return shell(opts.title, body, opts.refresh ? `<meta http-equiv="refresh" content="${Math.max(1, Math.floor(opts.refresh))}">` : "");
}

/** Form nhập tên/lớp cho khách (máy iOS cũ). POST action=join. */
export function joinView(opts: { code: string; title: string; error?: string; name?: string; className?: string }): string {
  const err = opts.error ? `<div class="err">${esc(opts.error)}</div>` : "";
  const body = `<div class="wrap">
    <div class="card">
      <span class="pill info">Bản nhẹ cho máy cũ</span>
      <h1>${esc(opts.title)}</h1>
      <p class="muted">Nhập họ tên và lớp để bắt đầu làm bài. Trang này dùng bản đơn giản để chạy được trên máy iOS cũ.</p>
      ${err}
      <form method="post" action="/thi-cu/${esc(opts.code)}">
        <input type="hidden" name="action" value="join">
        <label class="fld" for="name">Họ và tên</label>
        <input type="text" id="name" name="name" required maxlength="100" autocomplete="name" value="${esc(opts.name || "")}">
        <label class="fld" for="class">Lớp</label>
        <input type="text" id="class" name="class" required maxlength="50" autocomplete="off" value="${esc(opts.className || "")}">
        <button class="btn big" type="submit">Vào làm bài</button>
      </form>
      <p class="muted" style="margin-top:14px">Mã đề: <b>${esc(opts.code)}</b></p>
    </div>
  </div>`;
  return shell(opts.title, body);
}

type GradingShape = { statements?: Array<{ text?: string; answer?: boolean }>; acceptedAnswers?: string[]; image?: string };

function gradingOf(q: LegacyQuestion): GradingShape {
  const g = q.grading as GradingShape | null | undefined;
  return { statements: g?.statements || [], acceptedAnswers: g?.acceptedAnswers || [], image: g?.image };
}

/** Thứ tự câu hiển thị theo `attempt.questionOrder` (server sinh). */
export function orderQuestions(questions: LegacyQuestion[], questionOrder: number[]): LegacyQuestion[] {
  if (!questionOrder.length) return questions;
  const picked = questionOrder.map((idx) => questions[idx]).filter(Boolean) as LegacyQuestion[];
  return picked.length === questions.length ? picked : questions;
}

/** Thứ tự đáp án hiển thị của 1 câu MCQ theo `attempt.optionOrder`. */
function orderOptions(q: LegacyQuestion, optionOrder: Record<string, number[]>): number[] {
  const perm = optionOrder[q.id];
  if (perm && perm.length === q.options.length) return perm;
  return q.options.map((_, i) => i);
}

const TYPE_LABEL: Record<string, string> = {
  mcq: "Trắc nghiệm",
  true_false: "Đúng / Sai",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
};

/** Trang làm bài: mọi câu trong MỘT form POST, không cần JS để nộp. */
export function examView(opts: {
  code: string;
  title: string;
  subject: string;
  participant: string;
  questions: LegacyQuestion[];
  optionOrder: Record<string, number[]>;
  remainingSeconds: number;
  deadlineLabel: string;
}): string {
  const qs = opts.questions.map((q, index) => {
    const num = index + 1;
    let inner = "";
    if (q.type === "mcq") {
      const perm = orderOptions(q, opts.optionOrder);
      inner = perm
        .map((origIndex, displayIndex) => {
          const value = LETTER(origIndex);
          return `<label class="opt"><input type="radio" name="a_${esc(q.id)}" value="${value}"><span class="letter">${LETTER(displayIndex)}.</span><span>${esc(q.options[origIndex] ?? "")}</span></label>`;
        })
        .join("");
    } else if (q.type === "true_false") {
      const sts = gradingOf(q).statements || [];
      inner = sts
        .map((s, si) => `<div class="tfrow"><span class="st">${esc(s.text || `Ý ${si + 1}`)}</span>
          <label><input type="radio" name="t_${esc(q.id)}_${si}" value="true"> Đúng</label>
          <label><input type="radio" name="t_${esc(q.id)}_${si}" value="false"> Sai</label></div>`)
        .join("");
    } else if (q.type === "essay") {
      inner = `<textarea name="e_${esc(q.id)}" placeholder="Nhập bài làm của bạn"></textarea>`;
    } else {
      inner = `<input type="text" name="s_${esc(q.id)}" placeholder="Nhập câu trả lời" autocomplete="off">`;
    }
    const img = gradingOf(q).image ? `<img class="qimg" src="${esc(gradingOf(q).image)}" alt="Hình minh hoạ câu hỏi">` : "";
    return `<div class="q"><div class="qhead"><span class="qnum">Câu ${num}</span><span class="qtext">${esc(q.text)}</span></div>${img}<span class="pill info" style="margin-bottom:8px">${esc(TYPE_LABEL[q.type] || "Câu hỏi")}</span>${inner}</div>`;
  }).join("");

  /* Đồng hồ đếm ngược: PHẢI chèn SAU form (cuối <body>). Script nằm trong
   * <head> chạy TRƯỚC khi <body> được phân tích → `getElementById("tm")` trả
   * null → thoát sớm → đồng hồ đứng ở "--:--" mãi (đúng lỗi user báo "không
   * hiện thời gian"). Bọc DOMContentLoaded cho chắc trên máy cũ. */
  const timerScript = `<script>
(function(){
  function boot(){
    var el=document.getElementById("tm");
    var form=document.getElementById("f");
    if(!el||!form)return;
    var left=${Math.max(0, Math.floor(opts.remainingSeconds))};
    function tick(){
      if(left<=0){el.className="timer gone";el.textContent="Hết giờ";form.submit();return;}
      var m=Math.floor(left/60),s=left%60;
      el.textContent=(m<10?"0":"")+m+":"+(s<10?"0":"")+s;
      if(left<=60){el.className="timer low";}
      left--;
    }
    tick();
    setInterval(tick,1000);
  }
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})();
</script>`;
  const warn = Math.max(0, Math.floor(opts.remainingSeconds)) <= 60 ? `<div class="note">Sắp hết giờ — hãy bấm Nộp bài ngay khi làm xong.</div>` : "";
  const body = `<div class="top"><div class="bar">
      <h1>${esc(opts.title)}</h1>
      <span class="timer" id="tm">--:--</span>
    </div></div>
  <div class="wrap">
    <p class="muted">${esc(opts.participant)} · ${esc(opts.subject)} · Hạn nộp ${esc(opts.deadlineLabel)}</p>
    ${warn}
    <form id="f" method="post" action="/thi-cu/${esc(opts.code)}">
      <input type="hidden" name="action" value="submit">
      <div class="card">${qs}</div>
      <button class="btn big" type="submit">Nộp bài</button>
    </form>
  </div>`;
  return shell(opts.title, body + timerScript);
}

export type ReviewItem = {
  order: number;
  type: string;
  text: string;
  options: string[];
  answer: string;
  grading: GradingShape;
  explanation?: string | null;
  userAnswer: unknown;
  correct: boolean | null;
};

function answerText(item: ReviewItem): string[] {
  const out: string[] = [];
  if (item.type === "mcq") {
    const v = typeof item.userAnswer === "string" ? item.userAnswer : "";
    if (v) {
      const idx = v.toUpperCase().charCodeAt(0) - 65;
      out.push(`Bạn chọn: ${v}. ${item.options[idx] ?? ""}`);
    } else out.push("Bạn chưa trả lời");
  } else if (item.type === "true_false") {
    const ua = item.userAnswer as Record<string, boolean> | { statements?: boolean[] } | boolean[] | undefined;
    let picked: boolean[] | undefined;
    if (Array.isArray(ua)) picked = ua;
    else if (ua && typeof ua === "object") {
      const obj = ua as Record<string, unknown>;
      if (Array.isArray(obj.statements)) picked = obj.statements as boolean[];
      else {
        const keys = Object.keys(obj).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
        picked = keys.map((k) => Boolean(obj[k]));
      }
    }
    const sts = item.grading.statements || [];
    sts.forEach((s, i) => {
      const p = picked?.[i];
      out.push(`${s.text || `Ý ${i + 1}`}: bạn chọn ${p === true ? "Đúng" : p === false ? "Sai" : "—"} · đáp án ${s.answer ? "Đúng" : "Sai"}`);
    });
  } else if (item.type === "short_answer") {
    const v = typeof item.userAnswer === "string" ? item.userAnswer : (item.userAnswer as { text?: string } | undefined)?.text || "";
    const acc = item.grading.acceptedAnswers || [];
    out.push(`Bạn trả lời: ${v || "—"}${acc.length ? ` · đáp án: ${acc.join(" / ")}` : ""}`);
  } else {
    const v = (item.userAnswer as { text?: string } | undefined)?.text || (typeof item.userAnswer === "string" ? item.userAnswer : "");
    out.push(`Bài làm: ${v || "—"}`);
  }
  return out;
}

/** Trang kết quả: điểm (nếu được công bố) + xem lại bài làm + Làm lại. */
export function resultView(opts: {
  code: string;
  title: string;
  participant: string;
  showScore: boolean;
  score: number;
  correctCount: number;
  totalQuestions: number;
  showAnswers: boolean;
  canRetry: boolean;
  attemptsNote?: string;
  review?: ReviewItem[];
}): string {
  const scoreBlock = opts.showScore
    ? `<div class="score" style="color:${opts.score >= 5 ? "#15803d" : "#b91c1c"}">${opts.score}/10</div>
       <p class="muted">${opts.correctCount}/${opts.totalQuestions} câu được chấm</p>`
    : `<p class="pill warn">Giáo viên sẽ công bố điểm sau khi chấm</p>`;

  let reviewBlock = "";
  if (opts.showAnswers && opts.review && opts.review.length) {
    const items = opts.review.map((item) => {
      const badge = item.correct === true ? `<span class="pill ok">Đúng</span>` : item.correct === false ? `<span class="pill bad">Sai</span>` : `<span class="pill warn">Chờ chấm</span>`;
      const lines = answerText(item).map((t) => `<span class="ans">${esc(t)}</span>`).join("");
      const expl = item.explanation ? `<span class="ans muted">Giải thích: ${esc(item.explanation)}</span>` : "";
      const img = item.grading.image ? `<img class="qimg" src="${esc(item.grading.image)}" alt="Hình minh hoạ câu hỏi">` : "";
      return `<div class="q"><div class="qhead"><span class="qnum">Câu ${item.order}</span><span class="qtext">${esc(item.text)}</span></div>${img}${badge}${lines}${expl}</div>`;
    }).join("");
    reviewBlock = `<div class="card"><h2>Xem lại bài làm</h2>${items}</div>`;
  } else if (!opts.showAnswers) {
    reviewBlock = `<div class="card center"><h2>Chưa mở xem đáp án</h2><p class="muted">Giáo viên chưa bật xem đáp án cho đề này.</p></div>`;
  }

  const body = `<div class="wrap">
    <div class="card center">
      <span class="pill ${opts.showScore ? "ok" : "info"}">Đã nộp bài</span>
      <h1>${esc(opts.title)}</h1>
      <p class="muted">${esc(opts.participant)}</p>
      ${scoreBlock}
      ${opts.attemptsNote ? `<p class="muted">${esc(opts.attemptsNote)}</p>` : ""}
    </div>
    ${reviewBlock}
    ${opts.canRetry ? `<form method="post" action="/thi-cu/${esc(opts.code)}"><input type="hidden" name="action" value="leave"><button class="btn big" type="submit">Làm lại</button></form>` : ""}
    <a class="btn sec" href="/">Về trang chủ</a>
  </div>`;
  return shell(opts.title, body);
}
