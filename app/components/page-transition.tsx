"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * PRE-2 — Nền tảng cho hiệu ứng chuyển trang " bung tròn từ điểm bấm".
 *
 * Bản demo user gửi là một file HTML giấu sẵn mọi trang rồi bật/tắt class
 * `.active`, nên trang mới bung ra được ngay trong cùng DOM. App ta là Next.js
 * với route thật: trang cũ bị tháo, trang mới được mount vào — không thể chỉ
 * với CSS. Cách đúng là View Transitions API: trình duyệt chụp lại cả hai bên
 * rồi cho ta tween giữa chúng.
 *
 * `::view-transition-new(root)` là ảnh chụp trang MỚI, `::view-transition-old(root)`
 * là ảnh chụp trang CŨ. Ta cho trang mới nở `clip-path: circle()` ra từ đúng toạ
 * độ con trỏ lúc bấm, đồng thời đẩy trang cũ lùi và mờ đi tạo chiều sâu. Toạ độ
 * đó truyền qua hai biến CSS đặt ở `:root` — `::view-transition` kế thừa từ đó
 * nên đọc được.
 *
 * Vì sao phải ghi toạ độ bằng JS trước khi điều hướng: React/Next không truyền
 * toạ độ chuột xuống pseudo-element được, và trang mới chưa tồn tại lúc bấm.
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
  // Ctrl/Cmd/Shift/middle → mở tab mới, không có chuyển trang nên không cần toạ độ.
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export function PageTransition(): null {
  const pathname = usePathname();

  // Trong phòng thi có đếm ngược thời gian. Thêm 620ms mỗi lần chuyển câu là
  // lãng phí và gây rối mắt, nên tắt chuyển cảnh ở /thi. Muốn bật lại thì xoá
  // đoạn này — phần còn lại của hiệu ứng không phụ thuộc.
  useEffect(() => {
    document.documentElement.classList.toggle(
      "a6-no-vt",
      pathname.startsWith("/thi"),
    );
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;

    const onClick = (e: MouseEvent) => {
      if (isModifiedClick(e)) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      root.style.setProperty("--click-x", `${e.clientX}px`);
      root.style.setProperty("--click-y", `${e.clientY}px`);

      // Sóng nước: chỉ ở phần tử thật sự bấm được, và bỏ qua nút đang disabled.
      const clickable = target.closest<HTMLElement>(CLICKABLE);
      if (!clickable || clickable.matches(":disabled, [aria-disabled='true']")) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}