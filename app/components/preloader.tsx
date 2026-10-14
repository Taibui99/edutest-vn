import { Logo, LogoMark } from "@/components/brand/logo";

/**
 * PRE-1 — Preloader "burst" mở đầu phiên (KHUNG TĨNH).
 *
 * Đây chỉ còn là markup. Toàn bộ logic đếm %/bùm nằm trong một `<script>` inline
 * đặt ở `<head>` layout.tsx. Lý do (bug iPhone đo được):
 *
 *  - Bản cũ chạy vòng lặp `requestAnimationFrame` trong `useEffect`. Trên iPhone,
 *    (1) iOS Safari HOÃN `requestAnimationFrame` trong lúc trang còn đang nạp, và
 *    (2) khi mạng/máy chậm, React hydrate xong rất muộn. Hậu quả: overlay đứng ở
 *    "0%" suốt thời gian nạp, rồi tới khi `@keyframes` failsafe 6s của CSS nổ thì
 *    cả lớp phủ biến mất — nhìn như "màn hình loading không hoạt động".
 *  - `DOMContentLoaded` nổ ngay sau khi HTML được phân tích, KHÔNG đợi bundle
 *    hydrate; và `setInterval` không bị iOS hoãn như rAF. Nên đổi sang cả hai.
 *
 * Markup phải khớp với script trong layout.tsx: node số có `[data-a6-pct]`, cột
 * nước có `.a6-pl-liquid`, dòng trạng thái có `.a6-pl-status`.
 */
export function Preloader() {
  return (
    <div id="a6-preloader" data-burst="false" aria-hidden="true">
      <div className="a6-pl-ambient" />

      <div className="a6-pl-liquid">
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
          <span data-a6-pct>0</span>
          <span className="a6-pl-unit">%</span>
        </div>

        <div className="a6-pl-status">Đang khởi tạo A6Class…</div>
      </div>
    </div>
  );
}
