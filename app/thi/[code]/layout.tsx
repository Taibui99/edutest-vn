import type { ReactNode } from "react";
import { HydrationSignal } from "./hydration-signal";

/* Lưới đỡ "tự chuyển trang" cho link chia sẻ DUY NHẤT (/thi/<mã>):
 *
 *   1) Máy thiếu tính năng nền tảng → chuyển NGAY sang /thi-cu. Tailwind 4 dùng
 *      `color-mix()`/`@property` (cần Safari 16.4+); thiếu color-mix nghĩa là
 *      máy dưới sàn → app React không chạy được.
 *   2) Máy đủ tính năng nhưng React KHÔNG hydrate trong 8s (bundle bị chặn/lỗi,
 *      engine quá cũ) → chuyển sang /thi-cu.
 *
 * Nhờ vậy giáo viên chỉ chia sẻ MỘT link/QR, mọi thiết bị tự vào đúng bản. Đây
 * là lưới an toàn BỔ SUNG cho việc phát hiện UA ở middleware (proxy.ts) — phòng
 * khi UA bị đoán nhầm. Khi giáo viên xem thử (?preview=1) thì bỏ qua.
 *
 * Script phải là JavaScript THUẦN nhúng thẳng vào HTML (không qua React/Next
 * Script) để vẫn chạy khi bundle React chết — đó chính là tình huống cần cứu. */
export default async function ThiLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const target = `/thi-cu/${code.toUpperCase()}`;
  const script = `(function(){try{
if(/[?&]preview=/.test(location.search))return;
var done=false;
function go(){if(done)return;done=true;location.replace(${JSON.stringify(target)});}
try{if(!(window.CSS&&CSS.supports&&CSS.supports("color","color-mix(in srgb, red, blue)"))){go();return;}}catch(e){go();return;}
var t0=Date.now();
(function poll(){if(done)return;if(window.__a6Hydrated){done=true;return;}if(Date.now()-t0>8000){go();return;}setTimeout(poll,400);})();
}catch(e){}})();`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <HydrationSignal />
      {children}
    </>
  );
}
