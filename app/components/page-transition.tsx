"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * PRE-2 — Lớp phủ chuyển màn hình, bung từ điểm bấm.
 *
 * ## Vì sao bỏ View Transitions API
 *
 * Bản đầu dùng `::view-transition-old/new(root)`: trình duyệt chụp ảnh trang
 * cũ và trang mới rồi tween giữa hai ảnh. Người dùng xem và bảo hiệu ứng "chưa
 * thật sự ổn", và đúng như vậy — vì:
 *
 * 1. `::view-transition-old(root)` là **ảnh chụp**, không phải trang thật: nó bị
 *    `scale(0.94)` + mờ đi trong khi trang mới đang bung ra. Hai lớp ảnh chồng lên
 *    nhau, nhìn nhờ nhờ.
 * 2. Cộng dồn 460ms (trang cũ đi) + 620ms (trang mới đến) ≈ 1080ms cho mỗi lần
 *    chuyển màn hình — chậm hơn nhiều so với con số người dùng chịu được, và
 *    cộng thêm độ trễ của việc trang mới thực sự được render.
 *
 * Thay bằng lớp phủ của chính ta: một `<div>` phủ kín viewport, nở ra từ đúng
 * toạ độ con trỏ. Điều hướng **xảy ra bên dưới lớp phủ**, nên người dùng không
 * bao giờ nhìn thấy trang cũ méo đi — chỉ thấy một mảng màu phủ lên rồi mở ra
 * trên trang mới. Sạch hơn nhiều và không phụ thuộc ảnh chụp.
 *
 * Vì sao ghi toạ độ bằng JS: React/Next không truyền toạ độ chuột xuống
 * pseudo-element được, và trang mới chưa tồn tại lúc bấm.
 *
 * File này cũng sinh hiệu ứng sóng (ripple) khi bấm nút — user phản ánh "mọi nút
 * trên web chẳng có hiệu ứng gì cả", nên gắn ripple vào mọi phần tử bấm được thay
 * vì rải class `data-ripple` khắp app (dễ sót).
 */

/** Phần tử nào được tính là "nút" để sinh ripple. */
const CLICKABLE = "a[href], button, [role='button'], summary, label[for]";
/** Tránh dồn ripple khi người dùng bấm liên tục. */
const MAX_RIPPLES = 6;

/** Lớp phủ nở ra che kín. */
const COVER_MS = 340;
/** Chờ trang mới kịp vẽ một nhịp rồi mới mở lớp phủ. */
const PAINT_MS = 90;
/** Lớp phủ mở ra, lộ trang mới. */
const REVEAL_MS = 380;
/**
 * Trần chờ. Điều hướng có thể không bao giờ tới — link bị chặn, sự kiện bị huỷ,
 * mạng chết. Một lớp phủ đặc kín không mở là lỗi nghiêm trọng hơn nhiều so với
 * việc không có hiệu ứng, nên luôn có đường thoát.
 */
const SAFETY_MS = 2200;

type Phase = "idle" | "cover" | "reveal";

function isModifiedClick(e: MouseEvent) {
  // Ctrl/Cmd/Shift/middle → mở tab mới, không có chuyển trang nên không cần lớp phủ.
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

/**
 * Chỉ những liên kết điều hướng nội bộ mới đáng phủ. Bỏ qua `target="_blank"`,
 * `download`, link neo `#`, và mọi thứ không phải HTTP(s) nội bộ (`mailto:`,
 * `tel:`) — những loại đó không có "trang mới" để lộ ra sau lớp phủ.
 */
function navigatesInternally(a: HTMLAnchorElement): boolean {
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;

  const raw = a.getAttribute("href") ?? "";
  // `//example.com` là link ngoài dạng protocol-relative, không phải nội bộ.
  if (raw.startsWith("//")) return false;
  if (!raw.startsWith("/")) return false;

  try {
    const dest = new URL(a.href, window.location.href);
    return dest.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function PageTransition() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  // Người nghe sự kiện gắn một lần nên không được đóng lại state cũ. Giữ phase và
  // đường dẫn xuất phát trong ref để đọc được giá trị mới nhất.
  const phaseRef = useRef<Phase>("idle");
  const fromPathRef = useRef<string | null>(null);
  const safetyRef = useRef(0);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  // Trong phòng thi có đếm ngược. Thêm cả trăm ms mỗi lần chuyển màn hình là
  // lãng phí và gây rối mắt, nên tắt lớp phủ ở /thi. Muốn bật lại thì xoá đoạn
  // này — phần còn lại của hiệu ứng không phụ thuộc.
  useEffect(() => {
    document.documentElement.classList.toggle("a6-no-vt", pathname.startsWith("/thi"));
  }, [pathname]);

  // Đường dẫn đổi sau khi lớp phủ đã che ⇒ trang mới đã render xong bên dưới ⇒
  // mở lớp phủ ra. So với đường dẫn lúc bấm, không so với `phase`, vì effect
  // này chạy ngay khi `phase` chuyển sang "cover" — lúc đó chưa điều hướng xong.
  useEffect(() => {
    if (phase !== "cover") return;
    if (fromPathRef.current === null || pathname === fromPathRef.current) return;

    const t = window.setTimeout(() => go("reveal"), PAINT_MS);
    return () => window.clearTimeout(t);
  }, [pathname, phase, go]);

  // Mở xong thì gỡ hẳn khỏi DOM, trả về trạng thái rảnh để lần bấm sau dùng lại.
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = window.setTimeout(() => go("idle"), REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [phase, go]);

  useEffect(() => {
    const root = document.documentElement;

    const onClick = (e: MouseEvent) => {
      if (isModifiedClick(e)) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // ── Sóng nước: chỉ ở phần tử thật sự bấm được, bỏ qua nút đang disabled ──
      const clickable = target.closest<HTMLElement>(CLICKABLE);
      if (clickable && !clickable.matches(":disabled, [aria-disabled='true']")) {
        const rect = clickable.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2.2;
        const ripple = document.createElement("span");

        ripple.className = "a6-ripple";
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - size / 2}px`;
        ripple.style.top = `${e.clientY - size / 2}px`;

        // append vào body chứ không vào nút: nút nhiều khi có overflow:hidden hoặc
        // bo góc, sóng sẽ bị cắt mất.
        document.body.appendChild(ripple);

        const live = document.querySelectorAll(".a6-ripple");
        if (live.length > MAX_RIPPLES) live[0].remove();

        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      }

      // ── Lớp phủ: chỉ khi thực sự sẽ đổi màn hình ──
      if (phaseRef.current !== "idle") return;
      if (root.classList.contains("a6-no-vt")) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !navigatesInternally(anchor)) return;

      // Bấm lại chính trang đang xem thì không có gì để lộ ra sau lớp phủ.
      const dest = new URL(anchor.href, window.location.href);
      if (dest.pathname === window.location.pathname && dest.search === window.location.search) return;

      setOrigin({ x: e.clientX, y: e.clientY });
      fromPathRef.current = window.location.pathname;

      window.clearTimeout(safetyRef.current);
      safetyRef.current = window.setTimeout(() => go("reveal"), SAFETY_MS);

      go("cover");
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [go]);

  // Gỡ timer khi component bị tháo.
  useEffect(() => () => window.clearTimeout(safetyRef.current), []);

  // Chưa bấm gì thì không render gì — lớp phủ chỉ tồn tại trong lúc chuyển.
  if (phase === "idle") return null;

  return (
    <div
      className="a6-cover"
      data-phase={phase}
      style={
        {
          "--a6-cover-x": `${origin.x}px`,
          "--a6-cover-y": `${origin.y}px`,
          // Thời lượng đặt ở đây chứ không để trong CSS: TS cũng cần REVEAL_MS để
          // biết lúc nào gỡ lớp phủ. Để hai nơi sẽ lệch nhau.
          "--a6-cover-in": `${COVER_MS}ms`,
          "--a6-cover-out": `${REVEAL_MS}ms`,
        } as React.CSSProperties
      }
    />
  );
}