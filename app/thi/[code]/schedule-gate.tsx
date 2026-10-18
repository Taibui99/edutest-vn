"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, RefreshCw } from "lucide-react";
import { vnDateTime } from "@/lib/time";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Đếm ngược dạng `HH:MM:SS` (thêm "N ngày" khi còn hơn 1 ngày). */
function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} ngày ${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Cổng chờ mở đề — thay khối tĩnh "Chưa đến giờ mở đề".
 *
 * Trang server chỉ render cổng này khi đề CHƯA mở (`now < openAt`) hoặc ĐÃ
 * đóng (`now > closeAt`). Cổng tự đếm ngược bằng đồng hồ máy và TỰ tải lại
 * đúng lúc tới giờ mở, nên học sinh không phải F5 thủ công.
 *
 * Chống lặp: nếu đồng hồ máy đi trước đồng hồ server (lệch múi giờ), reload có
 * thể chạy mà server vẫn coi là "chưa mở" → dùng mốc `sessionStorage` để chỉ
 * reload tối đa 1 lần / 5 giây, tránh vòng lặp dày đặc.
 */
export function ScheduleGate({ openAt, closeAt, joinCode }: { openAt: string | null; closeAt: string | null; joinCode: string }) {
  const openTs = openAt ? new Date(openAt).getTime() : null;
  const closeTs = closeAt ? new Date(closeAt).getTime() : null;
  /* `now` phải là `null` lúc SSR/hydration: nếu dùng `Date.now()` ngay trong
   * useState thì server đếm ngược theo giờ server, máy khách đếm theo giờ máy
   * khách (khác nhau vài trăm mili-giây) → chuỗi "còn lại" lệch → React #418.
   * Mới mount mới bắt đầu đếm → màn hình hiện "--:--:--" đúng 1 nhịp. */
  const [now, setNow] = useState<number | null>(null);
  const reloadedRef = useRef(false);

  useEffect(() => {
    const update = () => setNow(Date.now());
    /* Không gọi `setNow` đồng bộ trong effect (lint) — rAF chạy trước lần
       paint đầu nên máy khách hiện "--:--:--" đúng 0 khung hình. */
    const raf = window.requestAnimationFrame(update);
    const id = window.setInterval(update, 1000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (openTs === null) return;
    if (now === null || now < openTs) return;
    if (reloadedRef.current) return;
    const key = `a6-sched-${joinCode}`;
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(key) || 0);
    } catch {
      /* sessionStorage unavailable */
    }
    if (Date.now() - last < 5000) return;
    reloadedRef.current = true;
    try {
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, [now, openTs, joinCode]);

  const fmt = (ts: number) => vnDateTime(ts, { dateStyle: "short", timeStyle: "short" });

  const notStarted = openTs !== null && (now === null || now < openTs);
  const expired = closeTs !== null && now !== null && now > closeTs;

  const reloadNow = () => window.location.reload();

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--surface-bg)] p-4">
      <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--warning-light)] text-[var(--warning)]">
          <Clock size={24} />
        </div>

        {notStarted ? (
          <>
            <h1 className="text-xl font-bold">Chưa đến giờ mở đề</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Đề thi sẽ mở lúc <span className="font-bold text-[var(--warning)]">{openTs !== null ? fmt(openTs) : ""}</span>
            </p>
            <div className="mt-5 rounded-xl bg-[var(--warning-light)] px-4 py-3">
              <p className="text-xs font-semibold text-[var(--warning)]">Còn lại</p>
              <p className="mt-0.5 text-2xl font-black tabular-nums text-[var(--warning)]">{openTs !== null && now !== null ? fmtCountdown(openTs - now) : "--:--:--"}</p>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">Trang sẽ tự mở khi tới giờ. Em không cần tải lại.</p>
          </>
        ) : expired ? (
          <>
            <h1 className="text-xl font-bold">Đề thi đã đóng</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Đề thi đã đóng lúc <span className="font-bold text-[var(--warning)]">{closeTs !== null ? fmt(closeTs) : ""}</span>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Đang chuẩn bị mở đề…</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Hệ thống đang kiểm tra lại. Trang sẽ tự cập nhật.</p>
          </>
        )}

        <button
          type="button"
          onClick={reloadNow}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--surface-border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--gray-100)]"
        >
          <RefreshCw size={14} /> Tải lại trang
        </button>
        <Link
          href="/vao-thi"
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          <ArrowLeft size={14} /> Nhập mã khác
        </Link>
      </div>
    </div>
  );
}
