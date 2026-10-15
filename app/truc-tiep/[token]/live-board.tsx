"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, GraduationCap, QrCode, Trophy, Users, Wifi } from "lucide-react";
import type { LiveBoard } from "@/lib/live-board";

/* LIVE-1 — máy chiếu bảng điểm. Tự poll vài giây (không cần đăng nhập vì
 * đi qua token bí mật ở URL), chữ to đọc rõ trên tivi. */

const POLL_MS = 3000;
const VISIBLE_ROWS = 15;

const PHASE = {
  live: { label: "TRỰC TIẾP", color: "#22c55e", glow: "rgba(34,197,94,.35)" },
  waiting: { label: "CHƯA MỞ ĐỀ", color: "#f5b942", glow: "rgba(245,185,66,.3)" },
  closed: { label: "KẾT THÚC", color: "#94a3b8", glow: "rgba(148,163,184,.25)" },
} as const;

const MEDAL = ["#f5c542", "#c8d0dc", "#d9915c"];

function fmtScore(score: number): string {
  return Number.isInteger(score) ? String(score) : String(Number(score.toFixed(2)));
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

interface Props {
  initial: LiveBoard;
  token: string;
  qrUrl: string | null;
  joinUrl: string | null;
}

export function LiveBoardClient({ initial, token, qrUrl, joinUrl }: Props) {
  const [board, setBoard] = useState<LiveBoard>(initial);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [revoked, setRevoked] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>(initial.serverTime);
  const knownIds = useRef<Set<string>>(new Set(initial.rows.map((r) => r.id)));

  const tick = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/live/${encodeURIComponent(token)}`, { cache: "no-store" });
      if (res.status === 404) {
        setRevoked(true);
        return;
      }
      if (!res.ok) return;

      const next: LiveBoard = await res.json();
      if (!next.found) {
        setRevoked(true);
        return;
      }

      const fresh = next.rows.filter((r) => !knownIds.current.has(r.id)).map((r) => r.id);
      knownIds.current = new Set(next.rows.map((r) => r.id));
      if (fresh.length) setFlash(new Set(fresh));

      setBoard(next);
      setUpdatedAt(next.serverTime);
    } catch {
      /* mạng chập chờn ở lớp học — bỏ qua lần này, lần sau poll lại */
    }
  }, [token]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) void tick();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [tick]);

  useEffect(() => {
    if (flash.size === 0) return;
    const t = window.setTimeout(() => setFlash(new Set()), 4500);
    return () => window.clearTimeout(t);
  }, [flash]);

  if (revoked) {
    return (
      <div className="grid min-h-screen place-items-center px-6" style={{ background: "#071527" }}>
        <div className="max-w-md text-center text-white">
          <QrCode size={56} className="mx-auto mb-4 text-white/40" />
          <h1 className="text-3xl font-black">Bảng điểm đã bị tắt</h1>
          <p className="mt-3 text-white/60">Giáo viên đã thu hồi link này. Hãy xin link mới.</p>
        </div>
      </div>
    );
  }

  const rows = board.rows;
  const podium = rows.slice(0, 3);
  const order = [podium[1], podium[0], podium[2]].filter(Boolean);
  const meta = PHASE[board.phase];
  const visible = rows.slice(0, VISIBLE_ROWS);

  return (
    <div
      className="min-h-screen w-full text-white"
      style={{ background: "linear-gradient(165deg,#06121f 0%,#0b2447 55%,#06121f 100%)" }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {/* ── Đầu bảng ─────────────────────────────────────────────── */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-wider"
                style={{ background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.75)" }}
              >
                {board.exam?.subject}
              </span>
              <span
                className="flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-black uppercase tracking-widest"
                style={{ background: "rgba(255,255,255,.08)", color: meta.color, boxShadow: `0 0 18px ${meta.glow}` }}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${board.phase === "live" ? "animate-ping" : ""}`}
                  style={{ background: meta.color }}
                />
                {meta.label}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black leading-tight text-balance sm:text-4xl">{board.exam?.title}</h1>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <Wifi size={15} style={{ color: meta.color }} />
              Cập nhật {fmtClock(updatedAt)}
            </div>
            <div className="text-xs text-white/40">Tự làm mới mỗi {POLL_MS / 1000} giây</div>
          </div>
        </header>

        {/* ── Dải số liệu ──────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { icon: Users, label: "Đã nộp", value: board.submittedCount },
            { icon: GraduationCap, label: "Đang làm", value: board.activeCount },
            { icon: Trophy, label: "Điểm TB", value: board.stats.avg !== null ? fmtScore(board.stats.avg) : "—" },
            { icon: Trophy, label: "Cao nhất", value: board.stats.highest !== null ? fmtScore(board.stats.highest) : "—" },
            { icon: CheckCircle2, label: "Đạt ≥ 5đ", value: board.stats.total ? `${Math.round((board.stats.passCount / board.stats.total) * 100)}%` : "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-2xl px-4 py-3"
              style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/55">
                <Icon size={13} /> {label}
              </div>
              <div className="mt-1 text-3xl font-black tabular-nums leading-none">{value}</div>
            </div>
          ))}
        </div>

        {/* ── Bục vinh danh ────────────────────────────────────────── */}
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white/55">
            <Trophy size={15} /> Top 3
          </h2>
          {podium.length === 0 ? (
            <div
              className="rounded-2xl px-6 py-10 text-center text-white/50"
              style={{ background: "rgba(255,255,255,.05)", border: "1px dashed rgba(255,255,255,.2)" }}
            >
              Chưa có bài nộp nào
            </div>
          ) : (
            <div className="flex items-end justify-center gap-3 sm:gap-5">
              {order.map((r) => {
                // [2nd, 1st, 3rd] → height theo thứ hạng để tạo bục.
                const place = r!.rank === 1 ? 1 : r!.rank === 2 ? 2 : 3;
                const heights = { 1: "h-36 sm:h-44", 2: "h-28 sm:h-36", 3: "h-24 sm:h-32" } as const;
                const widths = { 1: "flex-[1.3]", 2: "flex-1", 3: "flex-1" } as const;
                const isNew = flash.has(r!.id);
                return (
                  <div key={r!.id} className={`flex ${widths[place]} min-w-0 flex-col items-center gap-2`}>
                    <div
                      className={`w-full rounded-2xl px-2 py-3 text-center ${isNew ? "animate-pop-in" : ""}`}
                      style={{
                        background: place === 1 ? "linear-gradient(180deg,rgba(245,197,66,.22),rgba(245,197,66,.07))" : "rgba(255,255,255,.08)",
                        border: `1px solid ${place === 1 ? "rgba(245,197,66,.5)" : "rgba(255,255,255,.16)"}`,
                      }}
                    >
                      <div className="text-4xl font-black leading-none sm:text-5xl" style={{ color: MEDAL[place - 1] }}>
                        {fmtScore(r!.score)}
                      </div>
                      <div className="mt-1 truncate text-sm font-black sm:text-base">{r!.name}</div>
                      <div className="truncate text-xs text-white/55">{r!.className || "—"}</div>
                    </div>
                    <div
                      className={`flex w-full items-start justify-center rounded-t-xl pt-2 text-sm font-black ${heights[place]}`}
                      style={{
                        background: place === 1 ? "linear-gradient(180deg,rgba(245,197,66,.35),rgba(245,197,66,.06))" : "rgba(255,255,255,.1)",
                        border: "1px solid rgba(255,255,255,.14)",
                        borderBottom: "none",
                        color: MEDAL[place - 1],
                      }}
                    >
                      {place === 1 ? "🥇 1" : place === 2 ? "🥈 2" : "🥉 3"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Bảng xếp hạng ────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)" }}>
          <div
            className="grid grid-cols-[3rem_1fr_5rem_5.5rem] items-center gap-2 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white/50 sm:grid-cols-[3.5rem_1fr_7rem_6rem_5rem_6rem]"
            style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}
          >
            <span>#</span>
            <span>Họ và tên</span>
            <span className="hidden sm:block">Lớp</span>
            <span className="hidden sm:block text-right">Đúng</span>
            <span className="text-right">Thời gian</span>
            <span className="text-right">Điểm</span>
          </div>

          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-white/45">Chưa có bài nộp nào — bảng sẽ tự cập nhật khi học sinh nộp bài.</p>
          ) : (
            <ul>
              {visible.map((r) => (
                <li
                  key={r.id}
                  className={`grid grid-cols-[3rem_1fr_5rem_5.5rem] items-center gap-2 px-4 py-2.5 sm:grid-cols-[3.5rem_1fr_7rem_6rem_5rem_6rem] ${
                    flash.has(r.id) ? "animate-pop-in" : ""
                  }`}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,.07)",
                    background: flash.has(r.id) ? "rgba(34,197,94,.14)" : undefined,
                  }}
                >
                  <span className="text-base font-black tabular-nums" style={{ color: r.rank <= 3 ? MEDAL[r.rank - 1] : "rgba(255,255,255,.55)" }}>
                    {r.rank}
                  </span>
                  <span className="truncate text-base font-bold sm:text-lg">{r.name}</span>
                  <span className="hidden truncate text-sm text-white/55 sm:block">{r.className || "—"}</span>
                  <span className="hidden text-right text-sm tabular-nums text-white/60 sm:block">
                    {r.correctCount}/{r.totalQuestions}
                  </span>
                  <span className="flex items-center justify-end gap-1 text-sm tabular-nums text-white/55">
                    <Clock size={12} /> {fmtDuration(r.durationSeconds)}
                  </span>
                  <span className="text-right text-2xl font-black tabular-nums sm:text-3xl" style={{ color: r.score >= 5 ? "#4ade80" : "#f87171" }}>
                    {fmtScore(r.score)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {rows.length > visible.length && (
            <p className="px-4 py-2.5 text-xs text-white/45">
              + {rows.length - visible.length} bài nộp nữa (xem đầy đủ ở trang kết quả của giáo viên)
            </p>
          )}
        </section>

        {/* ── Chân trang: vào thi ───────────────────────────────────── */}
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-4 py-4" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/45">Mã vào thi</p>
            <p className="text-4xl font-black tracking-[0.2em] tabular-nums" style={{ color: "#7dd3fc" }}>
              {board.exam?.joinCode}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {joinUrl ?? "Vào /vao-thi"} · {board.exam?.durationMinutes} phút · {board.exam?.questionCount} câu · {fmtScore(board.exam?.totalPoints ?? 0)}đ
            </p>
          </div>
          {qrUrl && (
            <div className="rounded-xl bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt={`QR mã vào thi ${board.exam?.joinCode ?? ""}`} width={132} height={132} />
            </div>
          )}
        </footer>

        <p className="mt-4 text-center text-xs text-white/30">
          {board.phase === "closed"
            ? "Đề thi đã đóng — đây là bảng điểm cuối cùng."
            : "Chỉ hiển thị những bài đã nộp."}
        </p>
      </div>
    </div>
  );
}
