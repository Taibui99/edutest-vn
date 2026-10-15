"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, FileText, ListChecks, MessageSquare,
  PenLine, QrCode, ShieldAlert, Wifi, XCircle,
} from "lucide-react";
import type { LiveQuestionView, LiveSubmissionDetail } from "@/lib/live-board";
import { livePath, liveSubmissionApiPath } from "@/lib/live-paths";

/* LIVE-1b — màn chi tiết 1 bài làm mở từ bảng điểm (bấm tên học sinh).
 * Chữ to để giáo viên đọc khi chữa đề miệng. Tự poll như bảng; CHỈ XEM.
 * LIVE-1c — hiện đáp án chuẩn + lời giải kể cả khi đề đang mở (GV chữa bài). */

const POLL_MS = 5000;

const PHASE = {
  live: { label: "TRỰC TIẾP", color: "#22c55e", glow: "rgba(34,197,94,.35)" },
  waiting: { label: "CHƯA MỞ ĐỀ", color: "#f5b942", glow: "rgba(245,185,66,.3)" },
  closed: { label: "KẾT THÚC", color: "#94a3b8", glow: "rgba(148,163,184,.25)" },
} as const;

const TYPE_LABEL: Record<string, { label: string; Icon: typeof FileText }> = {
  mcq: { label: "Trắc nghiệm", Icon: FileText },
  true_false: { label: "Đúng / Sai", Icon: ListChecks },
  short_answer: { label: "Trả lời ngắn", Icon: MessageSquare },
  essay: { label: "Tự luận", Icon: PenLine },
};

const STATUS: Record<LiveQuestionView["status"], { label: string; color: string; bg: string }> = {
  correct: { label: "Đúng", color: "#4ade80", bg: "rgba(74,222,128,.15)" },
  partial: { label: "Đúng một phần", color: "#f5b942", bg: "rgba(245,185,66,.15)" },
  wrong: { label: "Sai", color: "#f87171", bg: "rgba(248,113,113,.15)" },
  blank: { label: "Bỏ trống", color: "#94a3b8", bg: "rgba(148,163,184,.15)" },
  pending: { label: "Chưa chấm", color: "#7dd3fc", bg: "rgba(125,211,252,.15)" },
};

const GREEN = { solid: "#4ade80", bg: "rgba(74,222,128,.16)", line: "rgba(74,222,128,.45)" };
const RED = { solid: "#f87171", bg: "rgba(248,113,113,.16)", line: "rgba(248,113,113,.45)" };
const PLAIN = { bg: "rgba(255,255,255,.05)", line: "rgba(255,255,255,.12)" };

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

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

/** Đáp án Đúng/Sai của học sinh: {0: true} hoặc mảng boolean. */
function tfPick(answer: LiveQuestionView["studentAnswer"], index: number): boolean | undefined {
  if (Array.isArray(answer)) return answer[index] as boolean | undefined;
  if (answer && typeof answer === "object") {
    const v = (answer as Record<string, unknown>)[String(index)];
    if (typeof v === "boolean") return v;
  }
  return undefined;
}

/** Bài làm dạng chữ (trả lời ngắn / tự luận). */
function textOf(answer: LiveQuestionView["studentAnswer"]): string {
  if (typeof answer === "string") return answer;
  if (answer && typeof answer === "object" && !Array.isArray(answer)) {
    const v = (answer as { text?: unknown }).text;
    if (typeof v === "string") return v;
  }
  return "";
}

function McqOptions({ q }: { q: LiveQuestionView }) {
  const picked = typeof q.studentAnswer === "string" ? q.studentAnswer.trim().toUpperCase() : "";
  const key = typeof q.key?.answer === "string" ? q.key.answer.trim().toUpperCase() : null;
  const isRight = q.status === "correct";

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {q.options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const isKey = key !== null && key === letter;
        const isPick = picked === letter;
        const tone = isKey || (isPick && isRight) ? GREEN : isPick ? RED : PLAIN;
        const badge = isKey && isPick
          ? { text: "Bạn chọn · Đáp án đúng", tone: GREEN }
          : isKey
            ? { text: "Đáp án đúng", tone: GREEN }
            : isPick
              ? { text: isRight ? "Bạn chọn — đúng" : "Bạn chọn — sai", tone: isRight ? GREEN : RED }
              : null;

        return (
          <li
            key={letter}
            className="flex items-center gap-3 rounded-xl px-4 py-3 sm:text-xl"
            style={{ background: tone.bg, border: `1px solid ${tone.line}` }}
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-black"
              style={{
                background: isKey || (isPick && isRight) ? GREEN.solid : isPick ? RED.solid : "rgba(255,255,255,.12)",
                color: isKey || (isPick && isRight) || isPick ? "#06121f" : "rgba(255,255,255,.7)",
              }}
            >
              {letter}
            </span>
            <span className="min-w-0 flex-1 text-lg font-semibold">{opt}</span>
            {badge && (
              <span
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-black"
                style={{ background: badge.tone.bg, color: badge.tone.solid }}
              >
                {badge.text}
              </span>
            )}
            {isPick && !isKey && (
              isRight
                ? <CheckCircle2 size={20} className="shrink-0" style={{ color: GREEN.solid }} />
                : <XCircle size={20} className="shrink-0" style={{ color: RED.solid }} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Statements({ q }: { q: LiveQuestionView }) {
  const list = q.key?.statements ?? [];
  if (list.length === 0) {
    return <p className="mt-3 text-lg text-white/60">Câu hỏi này không có dữ liệu mệnh đề.</p>;
  }
  return (
    <div className="mt-3 flex flex-col gap-2">
      {list.map((s, i) => {
        const pick = tfPick(q.studentAnswer, i);
        const ok = typeof s.answer === "boolean" ? (pick === undefined ? null : pick === s.answer) : null;
        const tone = ok === true ? GREEN : ok === false ? RED : PLAIN;
        return (
          <div
            key={i}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
            style={{ background: tone.bg, border: `1px solid ${tone.line}` }}
          >
            <span className="text-lg font-semibold sm:text-xl">
              {String.fromCharCode(97 + i)}. {s.text}
            </span>
            <span className="shrink-0 text-base font-bold text-white/75">
              Bạn: {pick === undefined ? "—" : pick ? "Đúng" : "Sai"}
              {typeof s.answer === "boolean" && <> · Chuẩn: {s.answer ? "Đúng" : "Sai"}</>}
              {typeof s.points === "number" && s.points > 0 && <> · {fmtScore(s.points)}đ</>}
            </span>
          </div>
        );
      })}
      <p className="text-base font-bold text-white/60">Điểm câu này: {fmtScore(q.earned)}/{fmtScore(q.points)}đ</p>
    </div>
  );
}

function TextAnswers({ q }: { q: LiveQuestionView }) {
  const text = textOf(q.studentAnswer);
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      <div className="rounded-xl px-4 py-3" style={{ background: PLAIN.bg, border: `1px solid ${PLAIN.line}` }}>
        <p className="text-xs font-black uppercase tracking-wide text-white/45">Bài làm của học sinh</p>
        <p className="mt-1 whitespace-pre-wrap text-lg sm:text-xl">
          {text.trim() || <span className="text-white/45">— bỏ trống —</span>}
        </p>
      </div>

      {q.type === "short_answer" && !!q.key?.acceptedAnswers?.length && (
        <div className="rounded-xl px-4 py-3" style={{ background: GREEN.bg, border: `1px solid ${GREEN.line}` }}>
          <p className="text-xs font-black uppercase tracking-wide" style={{ color: GREEN.solid }}>Đáp án chấp nhận</p>
          <p className="mt-1 text-lg font-semibold">{q.key.acceptedAnswers.join(" · ")}</p>
        </div>
      )}

      {q.type === "essay" && (
        <div className="rounded-xl px-4 py-3" style={{ background: "rgba(125,211,252,.12)", border: "1px solid rgba(125,211,252,.4)" }}>
          <p className="text-xs font-black uppercase tracking-wide text-[#7dd3fc]">Chấm điểm tự luận</p>
          {q.manualScore !== null ? (
            <p className="mt-1 text-lg">
              Giáo viên chấm: <b className="tabular-nums">{fmtScore(q.manualScore)}/{fmtScore(q.points)}đ</b>
            </p>
          ) : (
            <p className="mt-1 text-lg">Chưa chấm — câu này do giáo viên chấm tay.</p>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionCard({ q, showKey }: { q: LiveQuestionView; showKey: boolean }) {
  const st = STATUS[q.status];
  const t = TYPE_LABEL[q.type] ?? { label: q.type, Icon: FileText };
  const Icon = t.Icon;

  return (
    <article className="rounded-3xl p-4 sm:p-6" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-black" style={{ background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.85)" }}>
          {q.order}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-white/50">
          <Icon size={14} /> {t.label}
        </span>
        <span className="rounded-lg px-2.5 py-1 text-xs font-black" style={{ background: st.bg, color: st.color }}>
          {st.label}
        </span>
        <span className="ml-auto rounded-xl px-3 py-1.5 text-xl font-black tabular-nums sm:text-2xl" style={{ background: st.bg, color: st.color }}>
          {fmtScore(q.earned)}/{fmtScore(q.points)}đ
        </span>
      </div>

      <p className="mt-3 text-xl font-bold leading-snug text-white sm:text-2xl">
        {q.text || "(Câu hỏi trống)"}
      </p>

      {q.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={q.image}
          alt="Hình minh hoạ câu hỏi"
          className="mt-3 max-h-80 w-auto rounded-xl border border-white/15 bg-white"
        />
      )}

      {q.type === "mcq" && <McqOptions q={q} />}
      {q.type === "true_false" && <Statements q={q} />}
      {(q.type === "short_answer" || q.type === "essay") && <TextAnswers q={q} />}

      {showKey && q.key?.explanation && (
        <div className="mt-3 rounded-xl px-4 py-3" style={{ background: "rgba(125,211,252,.12)", border: "1px solid rgba(125,211,252,.35)" }}>
          <p className="text-xs font-black uppercase tracking-wide text-[#7dd3fc]">Lời giải</p>
          <p className="mt-1 text-lg text-white/85">{q.key.explanation}</p>
        </div>
      )}

      {!q.answered && (
        <p className="mt-3 text-base font-bold text-white/50">Học sinh không trả lời câu này.</p>
      )}
    </article>
  );
}

interface Props {
  initial: LiveSubmissionDetail;
  token: string;
  submissionId: string;
}

export function LiveSubmissionView({ initial, token, submissionId }: Props) {
  const [detail, setDetail] = useState<LiveSubmissionDetail>(initial);
  const [revoked, setRevoked] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>(initial.serverTime);

  const tick = useCallback(async () => {
    try {
      const res = await fetch(liveSubmissionApiPath(token, submissionId), { cache: "no-store" });
      if (res.status === 404) {
        setRevoked(true);
        return;
      }
      if (!res.ok) return;
      const next: LiveSubmissionDetail = await res.json();
      if (!next.found || !next.submission) {
        setRevoked(true);
        return;
      }
      setDetail(next);
      setUpdatedAt(next.serverTime);
    } catch {
      /* mạng chập chờn ở lớp — bỏ qua lần này, lần sau poll lại */
    }
  }, [token, submissionId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) void tick();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [tick]);

  if (revoked || !detail.exam || !detail.submission) {
    return (
      <div className="grid min-h-screen place-items-center px-6" style={{ background: "#071527" }}>
        <div className="max-w-md text-center text-white">
          <QrCode size={56} className="mx-auto mb-4 text-white/40" />
          <h1 className="text-3xl font-black">Không tìm thấy bài làm</h1>
          <p className="mt-3 text-white/60">Bài làm này đã bị xóa hoặc giáo viên đã thu hồi link bảng điểm.</p>
          <Link
            href={livePath(token)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-black"
            style={{ background: "rgba(125,211,252,.15)", color: "#7dd3fc" }}
          >
            <ArrowLeft size={16} /> Quay lại bảng điểm
          </Link>
        </div>
      </div>
    );
  }

  const { exam, submission: s, showAnswerKey } = detail;
  const meta = PHASE[detail.phase];
  const scoreColor = s.score >= 5 ? "#4ade80" : "#f87171";
  const wrongCount = Math.max(0, s.totalQuestions - s.correctCount);

  const stats = [
    { label: "Đúng", value: `${s.correctCount}/${s.totalQuestions}` },
    { label: "Sai / bỏ trống", value: String(wrongCount) },
    { label: "Thời gian", value: fmtDuration(s.durationSeconds) },
    { label: "Nộp lúc", value: fmtDateTime(s.submittedAt) },
  ];

  return (
    <div
      className="min-h-screen w-full text-white"
      style={{ background: "linear-gradient(165deg,#06121f 0%,#0b2447 55%,#06121f 100%)" }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        {/* ── Đầu trang ─────────────────────────────────────────────── */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={livePath(token)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-white/60 transition-colors hover:text-white"
            >
              <ArrowLeft size={15} /> Quay lại bảng điểm
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-wider"
                style={{ background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.75)" }}
              >
                {exam.subject}
              </span>
              <span
                className="flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-black uppercase tracking-widest"
                style={{ background: "rgba(255,255,255,.08)", color: meta.color, boxShadow: `0 0 18px ${meta.glow}` }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
                {meta.label}
              </span>
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-wider"
                style={{ background: "rgba(125,211,252,.14)", color: "#7dd3fc" }}
              >
                Bài làm chi tiết
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black leading-tight text-balance sm:text-3xl">{exam.title}</h1>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <Wifi size={15} style={{ color: meta.color }} />
              Cập nhật {fmtClock(updatedAt)}
            </div>
            <div className="text-xs text-white/40">Tự làm mới mỗi {POLL_MS / 1000} giây</div>
          </div>
        </header>

        {/* ── Thông tin học sinh + điểm ─────────────────────────────── */}
        <section
          className="mb-6 rounded-3xl p-5 sm:p-6"
          style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-white/45">
                Hạng {s.rank}/{s.submittedTotal}{s.isGuest ? " · Học sinh khách" : ""}
              </p>
              <h2 className="mt-1 text-4xl font-black leading-none text-balance sm:text-5xl">{s.name}</h2>
              <p className="mt-2 text-lg font-bold text-white/60">{s.className || "Chưa có lớp"}</p>
            </div>
            <div className="text-right">
              <div className="text-6xl font-black leading-none tabular-nums sm:text-7xl" style={{ color: scoreColor }}>
                {fmtScore(s.score)}
              </div>
              <p className="mt-1 text-sm font-black text-white/50">/ {fmtScore(exam.totalPoints)} điểm</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(({ label, value }) => (
              <div key={label} className="rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">{label}</p>
                <p className="mt-1 text-2xl font-black tabular-nums leading-none">{value}</p>
              </div>
            ))}
          </div>

          {s.violationCount > 0 && (
            <p
              className="mt-3 flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
              style={{ background: "rgba(245,185,66,.14)", color: "#f5b942" }}
            >
              <ShieldAlert size={16} className="shrink-0" />
              {s.violationCount} vi phạm · điểm rủi ro {s.riskScore}/100
              {s.autoSubmitted && " · đã bị nộp tự động"}
              <span className="text-xs font-semibold text-white/50">— chỉ tham khảo, điểm không bị trừ.</span>
            </p>
          )}

        </section>

        {/* ── Chi tiết từng câu ─────────────────────────────────────── */}
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white/55">
            <FileText size={15} /> Chi tiết {detail.questions.length} câu — dùng để chữa đề miệng
          </h2>
          <div className="flex flex-col gap-4">
            {detail.questions.map((q) => (
              <QuestionCard key={q.id} q={q} showKey={showAnswerKey} />
            ))}
          </div>
        </section>

        {/* ── Chân trang ────────────────────────────────────────────── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-4" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}>
          <p className="text-xs text-white/45">
            Chỉ xem — trang này dùng để đọc bài và chữa đề miệng, không sửa điểm ở đây.
          </p>
          <Link
            href={livePath(token)}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-base font-black"
            style={{ background: "rgba(125,211,252,.15)", color: "#7dd3fc" }}
          >
            <ArrowLeft size={16} /> Quay lại bảng điểm
          </Link>
        </footer>

        <p className="mt-4 text-center text-xs text-white/30">
          {detail.phase === "closed"
            ? "Đề thi đã đóng — đây là bài làm cuối cùng của học sinh."
            : "Điểm và bài làm có thể thay đổi khi giáo viên chấm tay câu tự luận."}
        </p>
      </div>
    </div>
  );
}
