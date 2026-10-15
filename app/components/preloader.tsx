/**
 * PRE-1 — Preloader "burst" mở đầu phiên.
 *
 * ⚠ Toàn bộ markup ở đây là HTML THÔ, cố tình đưa qua `dangerouslySetInnerHTML`
 * để React **không quản lý** cây con bên trong. Lý do (bug đo được, cả iPhone
 * lẫn desktop):
 *
 *  - Logic đếm %/bùm nằm trong `<script>` inline ở `layout.tsx` và PHẢI chạy
 *    trước/độc lập với hydration (iOS Safari hoãn `requestAnimationFrame` lúc
 *    nạp + máy/mạng chậm làm hydrate muộn → nếu chờ React thì overlay đứng ở
 *    "0%" rồi bị failsafe CSS 6s dọn đi, nhìn như "loading đứng").
 *  - Nhưng chính vì script ghi vào DOM *trước* khi React hydrate, nếu để React
 *    quản lý cây này thì nó thấy lệch với HTML server (số % đã nhảy, chiều cao
 *    cột nước đã đổi) → **React thay luôn cả cây DOM**, khiến mọi tham chiếu
 *    node của script trỏ vào node đã chết: số % kẹt ở 0, `data-burst` không bao
 *    giờ được gắn (bị failsafe dọn), kèm lỗi hydration #418.
 *  - `dangerouslySetInnerHTML` khiến React coi phần này là opaque: không diff,
 *    không thay — script inline sở hữu trọn. (Markup này khớp với bộ chọn trong
 *    script: `#a6-preloader`, `[data-a6-pct]`, `.a6-pl-liquid`, `.a6-pl-status`.)
 *
 * Duy nhất khác bản React cũ: gradient của logo dùng id CỐ ĐỊNH `a6-pl-tile`
 * thay vì `useId()` — chỉ có một preloader mỗi trang nên an toàn, và không cần
 * React để sinh id.
 */
const PRELOADER_HTML = `
<div id="a6-preloader" data-burst="false" aria-hidden="true">
  <div class="a6-pl-ambient"></div>

  <div class="a6-pl-liquid">
    <svg class="a6-pl-wave" viewBox="0 0 1200 120" preserveAspectRatio="none">
      <path d="M0,0 C150,90 350,-40 500,40 C650,120 900,10 1200,40 L1200,120 L0,120 Z"></path>
    </svg>
  </div>

  <div class="a6-pl-ring"></div>

  <div class="a6-pl-card">
    <div class="a6-pl-brand">
      <div class="a6-pl-badge">
        <span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center bg-white/15 ring-1 ring-inset ring-white/40 h-12 w-12 rounded-[0.9rem]">
          <svg viewBox="0 0 32 32" class="h-full w-full" fill="none">
            <defs>
              <linearGradient id="a6-pl-tile" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#00D2FF"></stop>
                <stop offset="30%" stop-color="#0F4C81"></stop>
                <stop offset="78%" stop-color="#0F4C81"></stop>
                <stop offset="100%" stop-color="#FFB800"></stop>
              </linearGradient>
            </defs>
            <g transform="scale(0.6956522) translate(-2 -2)">
              <rect x="2" y="2" width="46" height="46" rx="14" fill="url(#a6-pl-tile)"></rect>
              <path d="M25 11 37 21 25 17 13 21 25 11Z" fill="#FFFFFF" opacity=".95"></path>
              <path d="M19 23h9.5c3 0 5 2 5 5s-3 6.5-7 6.5c-4.5 0-7.5-3-7.5-8V20" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
              <circle cx="26.5" cy="28.5" r="2.5" fill="#FFB800"></circle>
            </g>
          </svg>
        </span>
      </div>
      <span role="img" aria-label="A6Class Edu" class="inline-flex items-center gap-2.5">
        <span aria-hidden="true" class="inline-flex shrink-0 items-center justify-center shadow-sm shadow-primary/20 h-12 w-12 rounded-[0.9rem]">
          <svg viewBox="0 0 32 32" class="h-full w-full" fill="none">
            <defs>
              <linearGradient id="a6-pl-tile-2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#00D2FF"></stop>
                <stop offset="30%" stop-color="#0F4C81"></stop>
                <stop offset="78%" stop-color="#0F4C81"></stop>
                <stop offset="100%" stop-color="#FFB800"></stop>
              </linearGradient>
            </defs>
            <g transform="scale(0.6956522) translate(-2 -2)">
              <rect x="2" y="2" width="46" height="46" rx="14" fill="url(#a6-pl-tile-2)"></rect>
              <path d="M25 11 37 21 25 17 13 21 25 11Z" fill="#FFFFFF" opacity=".95"></path>
              <path d="M19 23h9.5c3 0 5 2 5 5s-3 6.5-7 6.5c-4.5 0-7.5-3-7.5-8V20" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
              <circle cx="26.5" cy="28.5" r="2.5" fill="#FFB800"></circle>
            </g>
          </svg>
        </span>
        <span class="inline-flex items-baseline gap-1.5">
          <span class="font-extrabold leading-none tracking-tight text-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">A6Class</span>
          <span class="font-extrabold leading-none uppercase tracking-wide text-[12px] px-2 py-0.5 rounded-[7px] bg-[var(--accent)] text-[var(--primary-dark)]">EDU</span>
        </span>
      </span>
    </div>

    <div class="a6-pl-pct">
      <span data-a6-pct>0</span>
      <span class="a6-pl-unit">%</span>
    </div>

    <div class="a6-pl-status">Đang khởi tạo A6Class…</div>
  </div>
</div>
`;

export function Preloader() {
  return (
    <div
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: PRELOADER_HTML }}
    />
  );
}
