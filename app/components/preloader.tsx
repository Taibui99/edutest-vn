"use client";

import { useEffect, useState } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";

/**
 * PRE-1 — Preloader "burst" mở đầu phiên.
 *
 * Dựa trên bản demo user gửi: cột chất lỏng dâng lên có sóng, thẻ kính hiển thị
 * logo và % tải, tới 100% thì một vòng shockwave nở ra và cả lớp phủ bị cắt
 * thành hình tròn thu về 0 (clip-path) để lộ nội dung trang bên dưới.
 *
 * Bốn điểm khác bản demo, vì bản demo chạy được nhưng chưa hợp với web thật:
 *
 * 1. **Thanh % không giả.** Demo tăng theo `Math.random()` cứ 30ms và ghi
 *    "Tải ngân hàng đề thi A6Edu" dù thực tế không tải gì. Ở đây % bị kẹp ở
 *    88 cho tới khi `window.load` + `document.fonts.ready` thật sự xong mới
 *    nhảy lên 100 — và câu chữ trạng thái nói đúng việc đang xảy ra.
 * 2. **Không kẹt người dùng.** Trần thời gian cứng 3.5s, cộng thêm một
 *    `@keyframes` failsafe trong CSS tự ẩn overlay sau 6s phòng khi JS lỗi.
 * 3. **Mọi lần tải trang, không phải một lần mỗi phiên.** Trước đây có cờ
 *    `sessionStorage` để lần sau vào thẳng web — người dùng phàn nàn là
 *    "loading đứng ở 1% rồi đùng vào web luôn" và muốn thấy loading mọi lúc.
 *    Bỏ cờ. Lưu ý phạm vi: component này nằm trong root layout nên Next giữ
 *    nó sống suốt phiên, chuyển màn hình trong app **không** làm nó chạy lại
 *    (đó là việc của lớp phủ trong `PageTransition`). Preloader chạy ở mỗi lần
 *    tải trang đầy đủ: mở site, F5, bấm link ngoài vào thẳng một URL.
 * 4. **Dùng chữ an toàn.** Demo tô % bằng gold `#FFB800` (1.73:1, dưới cả
 *    ngưỡng 3:1 cho chữ cỡ lớn) — ở đây dùng `--accent-dark` (7.09:1). Logo
 *    lấy từ component `Logo` chứ không vẽ `<text>` trong SVG: font chưa tải
 *    xong thì `<text>` sẽ đè lên badge (xem ghi chú ở components/brand/logo.tsx).
 *
 * Ai bật `prefers-reduced-motion` thì không thấy preloader này — cả JS lẫn CSS
 * đều bỏ qua.
 */

/** Dưới ngần này hiệu ứng bùm bị bỏ lửa, người dùng không kịp thấy. */
const MIN_MS = 1100;
/** Trần cứng: dù tài nguyên nạp chậm tới đâu cũng không giữ người dùng lâu hơn thế. */
const HARD_CAP_MS = 3500;
/** Thời gian bơm % lên EASED_MAX. */
const RAMP_MS = 900;
/** % không bao giờ vượt quá trước khi tài nguyên thật đã xong — để con số không nói dối. */
const EASED_MAX = 88;

const MESSAGES = [
  { at: 0, text: "Đang khởi tạo A6Class…" },
  { at: 38, text: "Đang tải giao diện và chữ…" },
  { at: 78, text: "Đang hoàn thiện…" },
  { at: 100, text: "Sẵn sàng!" },
];

function messageFor(pct: number) {
  let text = MESSAGES[0].text;
  for (const m of MESSAGES) if (pct >= m.at) text = m.text;
  return text;
}

export function Preloader() {
  const [pct, setPct] = useState(0);
  const [burst, setBurst] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (gone) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Người bật reduced-motion thì không thấy preloader này: cả JS lẫn CSS đều
    // bỏ qua. setState nằm trong callback rAF chứ không nằm trong thân effect,
    // tránh dựng thêm một vòng render ngay sau khi hydrate.
    if (reduced) {
      const t = requestAnimationFrame(() => setGone(true));
      return () => cancelAnimationFrame(t);
    }

    let raf = 0;
    let settled = false;
    let ready = document.readyState === "complete";

    const markReady = () => {
      ready = true;
    };
    const finish = () => {
      settled = true;
      setPct(100);
      setBurst(true);
    };

    window.addEventListener("load", markReady);
    // `document.fonts` không có ở mọi trình duyệt cũ — đừng để nó ném lỗi làm
    // hỏng cả effect.
    void document.fonts?.ready.then(markReady).catch(() => {});
    // Người dùng đã đợi đủ lâu thì coi như xong, đừng bắt họ nhìn con số đứng yên.
    const capTimer = window.setTimeout(markReady, HARD_CAP_MS);

    const t0 = performance.now();
    const step = () => {
      if (settled) return;
      const elapsed = performance.now() - t0;

      if (ready && elapsed >= MIN_MS) {
        finish();
        return;
      }

      // Cột % PHẢI chạy vô điều kiện tới EASED_MAX. Bản cũ đặt nó trong nhánh
      // `else` của `if (ready)`, nên khi `document.fonts.ready` xong sớm (font
      // đã cache, chỉ mất vài chục ms) `ready` thành true gần như tức thì: con số
      // đóng băng ở ~1% rồi nhảy thẳng lên 100 — đúng triệu chứng "đứng ở 1% rồi
      // đùng vào web". Tài nguyên xong hay chưa chỉ quyết định lúc NHẢY 100,
      // không quyết định việc con số có chạy hay không.
      const t = Math.min(1, elapsed / RAMP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(eased * EASED_MAX * 10) / 10);

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(capTimer);
      window.removeEventListener("load", markReady);
    };
  }, [gone]);

  // Cất preloader sau khi hiệu ứng bùm chạy xong, đồng thời bật lớp mờ nội dung trang.
  useEffect(() => {
    if (!burst) return;

    const root = document.documentElement;
    root.classList.add("a6-reveal");
    // `animationend` nổi bọt lên từ mọi phần tử con, nên phải lọc đúng tên animation.
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName === "a6-pl-page-in") root.classList.remove("a6-reveal");
    };
    root.addEventListener("animationend", onEnd);

    const t = window.setTimeout(() => {
      root.classList.remove("a6-reveal");
      setGone(true);
    }, 700);

    return () => {
      clearTimeout(t);
      root.removeEventListener("animationend", onEnd);
    };
  }, [burst]);

  if (gone) return null;

  const shown = Math.round(pct);

  return (
    <div id="a6-preloader" data-burst={burst ? "true" : "false"} aria-hidden="true">
      <div className="a6-pl-ambient" />

      <div className="a6-pl-liquid" style={{ height: `${pct}%` }}>
        <svg className="a6-pl-wave" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,0 C150,90 350,-40 500,40 C650,120 900,10 1200,40 L1200,120 L0,120 Z" />
        </svg>
      </div>

      <div className="a6-pl-ring" />

      <div className="a6-pl-card">
        <div className="a6-pl-brand">
          <div className="a6-pl-badge">
            <LogoMark size="lg" tone="inverse" />
          </div>
          <Logo size="lg" />
        </div>

        <div className="a6-pl-pct">
          {shown}
          <span className="a6-pl-unit">%</span>
        </div>

        <div className="a6-pl-status">{messageFor(shown)}</div>
      </div>
    </div>
  );
}