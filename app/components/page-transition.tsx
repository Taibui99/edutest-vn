"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * PRE-2 — Hiệu ứng trượt ngang khi chuyển màn hình (kiểu Canva) + ripple.
 *
 * ## Cơ chế
 *
 * Bản cũ bung một lớp phủ tròn ra toàn màn hình — user yêu cầu **xóa**. Yêu cầu
 * hiện tại là hiệu ứng **trượt**, giống hiệu ứng slide của Canva: trang mới trượt
 * vào từ phải, trang cũ trượt ra bên trái, cùng lúc.
 *
 * ### Vì sao không viết đúng y hệt ví dụ `transform: translateX()` thuần được
 *
 * Trong ví dụ người dùng đưa, cả hai trang cùng tồn tại trong DOM
 * (`.page.active` / `.page.next`) nên chỉ cần đổi `class` là hai trang cùng trượt.
 * Next.js App Router thì khác: bấm link → React unmount trang cũ, mount trang
 * mới. Không còn trang cũ để mà `translateX(-100%)`.
 *
 * Công cụ đúng là **View Transitions API**: trình duyệt chụp lại cả hai bên rồi
 * cho ta tween giữa chúng. Không thấy trang cũ vì nó đang ở dạng **ảnh chụp** —
 * vẫn trượt được, vẫn là `translateX`.
 *
 * ### Vì sao phải ghi hướng và toạ độ bằng JS
 *
 * React/Next không truyền toạ độ chuột xuống pseudo-element được, và trang mới
 * chưa tồn tại lúc bấm. Ghi vào `<html>` trước, pseudo-element kế thừa từ đó.
 *
 * `data-slide="next" | "prev"`: bấm link là đi tới (trượt trái), bấm nút back
 * của trình duyệt là quay lại (trượt phải). Xác định bằng `click` và `popstate`
 * — `popstate` nổ trước khi React xử lý, nên cùng phase capture nên ghi kịp.
 *
 * **Giới hạn đã đo:** React (Next 16 / react-dom bundled) chỉ gọi
 * `document.startViewTransition()` khi bấm link nội bộ. Với `history.back()`
 * thì không — đo bằng cách vá thẳng API, số lần gọi đứng yên ở 1 dù `data-slide`
 * đã đổi thành `prev`. Nên hướng `prev` hiện chỉ bảo đảm CSS nối đúng
 * (`a6-slide-in-prev` được chọn), chưa có ảnh chụp để trượt thật. Nếu sau này
 * React hỗ trợ thì phần CSS này tự chạy, không cần sửa thêm.
 *
 * File này cũng sinh hiệu ứng sóng (ripple) khi bấm nút — user phản ánh "mọi nút
 * trên web chẳng có hiệu ứng gì cả", nên gắn ripple vào mọi phần tử bấm được thay
 * vì rải class `data-ripple` khắp app (dễ sót).
 */

/** Phần tử nào được tính là "nút" để sinh ripple. */
const CLICKABLE = "a[href], button, [role='button'], summary, label[for]";
/** Tránh dồn ripple khi người dùng bấm liên tục. */
const MAX_RIPPLES = 6;

function isModifiedClick(e: MouseEvent) {
  // Ctrl/Cmd/Shift/middle → mở tab mới, không có chuyển trang nên không cần hướng trượt.
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

/* Khác khung (shell) thì CẮT CẢNH thay vì trượt: đẩy 2 layout xa lạ
   (landing 1 cột ↔ auth 2 cột, dashboard ↔ public...) đè lên nhau 600ms
   nhìn rất khó chịu — đo live thấy rõ. Cùng khung (dashboard↔dashboard...)
   vẫn trượt Canva như cũ. */
/* Khung = bố cục thật sự khác nhau, không phải prefix chung chung: landing
   (1 cột) và auth (2 cột brand panel) tuy cùng public nhưng trượt đè nhau
   vẫn xấu — phải tách. dieu-khoan/bao-mat dùng chung Header/Footer với
   landing nên trượt cùng nhau được. */
const AUTH_ROUTES = ["/dang-nhap", "/dang-ky", "/quen-mat-khau", "/doi-mat-khau"];

function shellOf(path: string): string {
  if (path === "/") return "landing";
  if (path.startsWith("/bang-dieu-khien")) return "app";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/thi")) return "exam";
  if (AUTH_ROUTES.some((r) => path === r || path.startsWith(`${r}/`))) return "auth";
  if (path.startsWith("/vao-thi")) return "vaothi";
  return "public";
}

/** Chỉ liên kết điều hướng nội bộ mới đáng ghi hướng trượt. */
function navigatesInternally(a: HTMLAnchorElement): boolean {
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;

  const raw = a.getAttribute("href") ?? "";
  // `//example.com` là link ngoài dạng protocol-relative, không phải nội bộ.
  if (raw.startsWith("//")) return false;
  if (!raw.startsWith("/")) return false;

  try {
    return new URL(a.href, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function PageTransition(): null {
  const pathname = usePathname();
  const mounted = useRef(false);
  // popstate nổ sau khi location đã đổi nên không biết trang trước là gì —
  // giữ lại để so khung với trang mới (xem onPopstate).
  const lastPath = useRef(pathname);

  // Trong phòng thi có đếm ngược. Thêm cả trăm ms mỗi lần chuyển màn hình là
  // lãng phí và gây rối mắt, nên tắt chuyển cảnh ở /thi. Muốn bật lại thì xoá
  // đoạn này — phần còn lại của hiệu ứng không phụ thuộc.
  useEffect(() => {
    document.documentElement.classList.toggle("a6-no-vt", pathname.startsWith("/thi"));
    // Tới trang mới = điều hướng xong: gỡ thanh tải (phòng khi timeout dọn hụt).
    document.documentElement.classList.remove("a6-nav-loading");
    lastPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    mounted.current = true;

    const setSlide = (dir: "next" | "prev" | "instant") => root.setAttribute("data-slide", dir);

    const onClick = (e: MouseEvent) => {
      if (isModifiedClick(e)) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // ── Sóng nước: chỉ ở phần tử thật sự bấm được, bỏ qua nút đang disabled ──
      // Máy yếu (a6-perf-low) bỏ ripple: mỗi cú bấm tạo node + getBoundingClientRect
      // gây tốn layout/paint không đáng có.
      if (!reduced && !root.classList.contains("a6-perf-low")) {
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
      }

      // ── Hướng trượt: bấm link là đi tới; khác khung thì cắt cảnh ──
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (anchor && navigatesInternally(anchor)) {
        const to = new URL(anchor.href, window.location.href).pathname;
        setSlide(shellOf(window.location.pathname) === shellOf(to) ? "next" : "instant");
        // Thanh tải mảnh trên cùng: điều hướng cold mất ~4s mới chốt, không có
        // gì báo thì user tưởng treo. Hiện ngay khi bấm, gỡ khi đổi pathname.
        if (!reduced) {
          root.classList.add("a6-nav-loading");
          window.clearTimeout((root as unknown as { __a6nav?: number }).__a6nav);
          (root as unknown as { __a6nav?: number }).__a6nav = window.setTimeout(() => {
            root.classList.remove("a6-nav-loading");
          }, 10000);
        }
      }
    };

    // Bấm back/forward của trình duyệt là quay lại — trượt ngược hướng,
    // trừ khi đổi khung (lúc đó cắt cảnh như điều hướng thường).
    const onPopstate = () => {
      const from = lastPath.current;
      const to = window.location.pathname;
      setSlide(shellOf(from) === shellOf(to) ? "prev" : "instant");
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopstate, true);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopstate, true);
      // Dọn khi unmount để không để sót data-slide trên thẻ <html>.
      if (mounted.current) root.removeAttribute("data-slide");
      mounted.current = false;
    };
  }, []);

  return null;
}