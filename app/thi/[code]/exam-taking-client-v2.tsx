"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Clock, Eye, Flag, Hourglass, Menu, MinusCircle, RotateCcw, Send, TimerOff, Trophy, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TransitionOverlay } from "@/app/components/transition-overlay";
import { cn } from "@/lib/cn";
import { MAX_VIOLATIONS, resolveProctorMode, type ProctorEventType, type ProctorMode } from "@/lib/integrity";

/* GĐ0: `answer` và `statements[].answer`/`acceptedAnswers` KHÔNG còn được gửi cho
   học sinh (xem `page.tsx`) — payload RSC đọc được bằng mắt thường nên không
   được để đáp án lọt xuống. Chỉ xem trước của giáo viên mới có. Component này có
   thật sự không đọc chỗ này, nên để optional cho khớp cả hai bên. */
type Question = {
  id: string;
  type: "mcq" | "true_false" | "short_answer" | "essay" | string;
  text: string;
  options: string[];
  answer?: string;
  grading?: { statements?: Array<{ text: string; answer?: boolean; points?: number }>; acceptedAnswers?: string[]; image?: string } | null;
  order: number;
};

type Exam = {
  id: string;
  title: string;
  subject: string;
  durationMinutes: number;
  joinCode: string;
  isGuest: boolean;
  participantName?: string;
  participantClass?: string;
  showScoreImmediately?: boolean;
  showAnswers?: boolean;
  // GĐ3 — chế độ giáo viên chọn: "off" | "light" | "strict" (mặc định "off").
  proctorMode?: ProctorMode;
  questions: Question[];
};

/* GĐ1 — lần làm bài do server sinh: thứ tự câu/đáp án và mốc thời gian đều đọc
   từ đây, client không tự xáo trộn (`Math.random`) cũng không tự tính thời gian. */
type Attempt = {
  id: string;
  questionOrder: number[];
  optionOrder: Record<string, number[]>;
  deadlineAt: Date;
  startedAt: Date;
  remainingSeconds: number;
  submittedAt: Date | null;
};

/* KQ-1 (khách) — màn kết quả của khách kèm dữ liệu xem lại đáp án do server trả
   về (chỉ khi GV bật `showAnswers`). Học sinh vẫn được chuyển sang trang
   `/bang-dieu-khien/ket-qua/[id]` nên không dùng payload này. */
type ReviewItem = {
  id: string;
  order: number;
  type: string;
  text: string;
  options: string[];
  answer: string;
  grading: { statements: { text: string; answer: boolean; points?: number }[]; acceptedAnswers: string[]; image?: string };
  explanation?: string | null;
  userAnswer: AnswerValue | null;
  correct: boolean | null;
};

type SubmissionResult = {
  score: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  canRetry?: boolean;
  review?: ReviewItem[];
};

type AnswerValue = string | Record<string, boolean>;

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function scoreColor(score: number) {
  if (score >= 8) return "var(--score-good)";
  if (score >= 5) return "var(--score-mid)";
  return "var(--score-bad)";
}

/* RUNNER-1 — lưới câu hỏi dùng chung cho sidebar desktop và sheet mobile. */
function QuestionPalette({ orderedQuestions, current, setCurrent, marked, answers, preview, totalQuestions, submitting, submitExam }: {
  orderedQuestions: { id: string }[];
  current: number;
  setCurrent: (v: number | ((v: number) => number)) => void;
  marked: Record<string, boolean>;
  answers: Record<string, AnswerValue>;
  preview: boolean;
  totalQuestions: number;
  submitting: boolean;
  submitExam: (auto: boolean) => void;
}) {
  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--surface-border)] p-4 lg:sticky lg:top-24">
      <p className="text-xs font-bold text-[var(--text-muted)] mb-3">CÂU HỎI</p>
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {orderedQuestions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Câu ${i + 1}${answers[q.id] ? " (đã trả lời)" : ""}`}
            className={cn("aspect-square rounded-lg text-xs font-bold", current === i ? "bg-[var(--primary)] text-white" : marked[q.id] ? "bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning-border)]" : answers[q.id] ? "bg-[var(--success-light)] text-[var(--success)] border border-[var(--success-light)]" : "bg-[var(--gray-100)] text-[var(--text-muted)] border border-[var(--surface-border)]")}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)] mb-3">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-[var(--warning-border)] bg-[var(--warning-light)] inline-block" /> Xem lại</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-[var(--success-light)] bg-[var(--success-light)] inline-block" /> Đã trả lời</span>
      </div>
      <Button className="w-full" onClick={() => submitExam(false)} disabled={preview || totalQuestions === 0} loading={submitting}>{preview ? "Xem trước" : "Nộp bài"}</Button>
    </div>
  );
}

/* KQ-1 (khách) — bảng "Xem lại bài làm" ngay trên màn kết quả của khách.
   Khách không có tài khoản nên không vào được `/bang-dieu-khien/ket-qua`. */
function GuestReview({ items }: { items: ReviewItem[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] px-4 py-3"
      >
        <span className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
          <BookOpen size={15} className="text-[var(--primary)]" /> Xem lại bài làm
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {items.map((q) => (
            <div key={q.id} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-4">
              {q.grading.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.grading.image} alt="Hình minh hoạ câu hỏi" className="mb-2 max-h-64 w-auto rounded-lg border border-[var(--surface-border)] bg-white" />
              )}
              <div className="flex items-start gap-2 mb-2">
                <span className={cn("shrink-0 w-5 h-5 rounded-full flex items-center justify-center", q.correct === null ? "bg-[var(--gray-200)]" : q.correct ? "bg-[var(--success-light)]" : "bg-[var(--danger-light)]")}>
                  {q.correct === null ? <MinusCircle size={13} className="text-[var(--text-muted)]" /> : q.correct ? <CheckCircle2 size={13} className="text-[var(--success)]" /> : <XCircle size={13} className="text-[var(--danger)]" />}
                </span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  <span className="text-[var(--text-muted)] font-normal mr-1">Câu {q.order}.</span>{q.text}
                </p>
              </div>

              {q.type === "mcq" && (
                <div className="flex flex-col gap-1 pl-7">
                  {q.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isUserPick = q.userAnswer === letter;
                    const isCorrectAnswer = q.answer === letter;
                    return (
                      <div key={letter} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm", isCorrectAnswer ? "bg-[var(--success-light)] text-[var(--success-dark)] font-semibold" : isUserPick ? "bg-[var(--danger-light)] text-[var(--danger-dark)]" : "text-[var(--text-secondary)]")}>
                        <span className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center shrink-0 bg-[var(--gray-100)] text-[var(--text-muted)]">{letter}</span>
                        {opt}
                        {isUserPick && <span className="ml-auto text-[10px] font-bold shrink-0">{isCorrectAnswer ? "Bạn chọn ✓" : "Bạn chọn"}</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === "true_false" && (() => {
                const userObj = typeof q.userAnswer === "object" && q.userAnswer !== null ? (q.userAnswer as Record<string, unknown>) : {};
                const earned = q.grading.statements.reduce((a, s, si) => a + (userObj[String(si)] === s.answer ? (s.points || 0) : 0), 0);
                const totalPts = q.grading.statements.reduce((a, s) => a + (s.points || 0), 0);
                return (
                <div className="flex flex-col gap-1 pl-7">
                  {q.grading.statements.map((s, si) => {
                    const pick = userObj[String(si)];
                    const ok = pick === s.answer;
                    return (
                      <div key={si} className={cn("flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm", ok ? "bg-[var(--success-light)] text-[var(--success-dark)]" : pick === undefined ? "text-[var(--text-secondary)]" : "bg-[var(--danger-light)] text-[var(--danger-dark)]")}>
                        <span className="font-medium">{String.fromCharCode(97 + si)}. {s.text}</span>
                        <span className="shrink-0 text-xs font-bold">{ok && s.points ? `+${s.points}đ · ` : ""}Bạn làm: {pick === true ? "Đúng" : pick === false ? "Sai" : "—"} · Đáp án đúng: {s.answer ? "Đúng" : "Sai"}</span>
                      </div>
                    );
                  })}
                  {totalPts > 0 && <div className="pl-1 pt-0.5 text-xs font-bold text-[var(--text-muted)]">Điểm câu này: {earned}/{totalPts}đ</div>}
                </div>
                );
              })()}

              {(q.type === "short_answer" || q.type === "essay") && (
                <div className="flex flex-col gap-1 pl-7">
                  <div className="px-3 py-1.5 rounded-lg text-sm bg-[var(--surface-bg)] border border-[var(--surface-border)] text-[var(--text-primary)]">
                    <span className="text-xs font-bold text-[var(--text-muted)]">Bạn trả lời: </span>
                    {String(q.userAnswer ?? "").trim() || <span className="text-[var(--text-muted)]">— bỏ trống —</span>}
                  </div>
                  {q.type === "short_answer" && q.grading.acceptedAnswers.length > 0 && (
                    <div className="px-3 py-1.5 rounded-lg text-sm bg-[var(--success-light)] text-[var(--success-dark)]">
                      <span className="text-xs font-bold">Đáp án: </span>{q.grading.acceptedAnswers.join(" · ")}
                    </div>
                  )}
                  {q.type === "essay" && <p className="text-xs text-[var(--warning)]">Câu tự luận do giáo viên chấm thủ công.</p>}
                </div>
              )}

              {q.explanation && (
                <p className="mt-2 pl-7 text-xs text-[var(--text-muted)]">Giải thích: {q.explanation}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExamTakingClientV2({ exam, attempt, preview = false, backHref }: { exam: Exam; attempt?: Attempt; preview?: boolean; backHref: string }) {
  const router = useRouter();
  const { toast } = useToast();
  // Đồng hồ khởi động từ số giây SERVER tính lúc render — không tự suy ra từ
  // `durationMinutes` nữa. Các lần đồng bộ sau lấy từ `/api/attempts/[id]`.
  const [remaining, setRemaining] = useState(() => attempt?.remainingSeconds ?? exam.durationMinutes * 60);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [restored, setRestored] = useState(false);
  const [expired, setExpired] = useState(false);
  // Bài nháp đã vào state xong chưa — xem chú thích ở khối tự nộp khi hết giờ.
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [questionOrder, setQuestionOrder] = useState<number[] | null>(() => attempt?.questionOrder ?? null);
  const optionShuffleRef = useRef<Record<string, number[]>>(attempt?.optionOrder ?? {});
  const [violations, setViolations] = useState(0);
  const [warnVisible, setWarnVisible] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // PROCTOR-1: hẹn giờ ân hạn cho rời trang bị động (blur/khóa màn hình).
  const pendingFlag = useRef<{ type: ProctorEventType; timer: number } | null>(null);
  /* SSR an toàn: KHÔNG đọc `navigator` lúc render. Node hiện đại (21+) có
   * `navigator` toàn cục nhưng KHÔNG có `onLine` → `!navigator.onLine` = `!undefined`
   * = true → HTML server LUÔN kèm banner "Mất kết nối", client lại tính false →
   * lệch hydration (#418) và trên máy yếu (iOS cũ) React phải dựng lại cả cây →
   * trang đứng, không bấm được. Khởi tạo false rồi đồng bộ trong effect (client). */
  const [offline, setOffline] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [strictActive, setStrictActive] = useState(false);
  const violationsRef = useRef(0);
  const multiTabRef = useRef(false);

  useEffect(() => {
    // Đồng bộ trạng thái mạng THẬT sau khi mount (chỉ client chạy) — tránh lệch SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const orderedQuestions = questionOrder ? questionOrder.map((i) => exam.questions[i]) : exam.questions;
  const question = orderedQuestions[current];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = exam.questions.length;

  const draftKey = `edutest-draft-${exam.id}`;
  /* Bài nháp CHỈ giữ lời làm + cờ đánh dấu. Thứ tự câu/đáp án và thời gian do
   * server giữ (`Attempt`), không còn lưu trong localStorage nữa. */
  const draftRef = useRef<{ answers: Record<string, unknown>; marked: Record<string, boolean>; meta: null | { title: string; joinCode: string; subject: string; totalQuestions: number } } | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    draftRef.current = { answers, marked, meta: { title: exam.title, joinCode: exam.joinCode, subject: exam.subject, totalQuestions: exam.questions.length } };
  }, [answers, marked, exam.title, exam.joinCode, exam.subject, exam.questions.length]);

  const saveDraft = useCallback(() => {
    if (preview || submittedRef.current) return;
    if (!draftRef.current) return;
    if (Object.keys(draftRef.current.answers).length === 0 && Object.keys(draftRef.current.marked).length === 0) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ ...draftRef.current, savedAt: Date.now() }));
      setLastSaved(Date.now());
    } catch {
      /* localStorage unavailable */
    }
  }, [preview, draftKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  const submitExam = useCallback(async (auto = false) => {
    if (preview || submitting || result) return;
    if (!attempt) return;
    if (!auto && answeredCount < totalQuestions && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // GĐ1: KHÔNG gửi `durationSeconds` — server tự chốt từ `Attempt`.
        body: JSON.stringify({ examId: exam.id, attemptId: attempt.id, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Server đã chốt attempt vì quá hạn: đóng nháp, hiện màn hết giờ.
        if (data?.timedOut) {
          submittedRef.current = true;
          clearDraft();
          setExpired(true);
          setSubmitting(false);
          return;
        }
        throw new Error(data?.error || "Không thể nộp bài");
      }
      submittedRef.current = true;
      clearDraft();
      toast("success", "Đã nộp bài thành công", "Kết quả đã được hệ thống ghi nhận.");
      if (data.resultLink) {
        router.push(data.resultLink);
        return;
      }
      setResult({
        ...data.submission,
        canRetry: data.canRetry,
        review: data.review,
      });
    } catch (err) {
      toast("error", "Không thể nộp bài", err instanceof Error ? err.message : "Vui lòng kiểm tra mạng rồi thử lại.");
      setSubmitting(false);
    }
  }, [answers, attempt, answeredCount, clearDraft, exam.id, preview, result, router, showConfirm, submitting, toast, totalQuestions]);

  /* KQ-1 (khách) — nút "Làm lại": xoá phiên khách rồi quay lại form (điền sẵn
   * tên/lớp) để tạo người tham gia mới. Học sinh chỉ cần vào lại đề, server tự
   * quyết định còn lượt hay không. Điều hướng cứng cho chắc trên mọi máy. */
  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    if (!exam.isGuest) {
      // Chờ một nhịp để lớp phủ "Đang vào lại…" kịp vẽ trước khi điều hướng cứng.
      await new Promise((r) => window.setTimeout(r, 150));
      window.location.assign(`/thi/${exam.joinCode}`);
      return;
    }
    try {
      await fetch("/api/guest-attempts/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examCode: exam.joinCode }),
      });
    } catch {
      /* vẫn thử vào lại — cookie có thể chưa xoá được nhưng không chặn điều hướng */
    }
    const qs = new URLSearchParams();
    if (exam.participantName) qs.set("name", exam.participantName);
    if (exam.participantClass) qs.set("class", exam.participantClass);
    const suffix = qs.toString();
    window.location.assign(`/thi/${exam.joinCode}${suffix ? `?${suffix}` : ""}`);
  }, [exam, retrying]);

  /* GĐ2/GĐ3 — báo MỘT sự kiện vi phạm cho server ghi vào nhật ký của lần làm bài.
   * Hệ thống chỉ GHI NHẬN + CẢNH BÁO; việc đánh giá để giáo viên quyết (đúng bất
   * biến anti-cheat). Trước đây chạm `MAX_VIOLATIONS` là tự nộp bài — bỏ hẳn:
   * user báo "đang làm tự nhiên tính vi phạm rồi nộp luôn" (iPhone khoá màn hình
   * cũng bị). Giờ không đường nào để mất bài vì cờ rủi ro. */
  const flag = useCallback((type: ProctorEventType) => {
    if (submittedRef.current || result || violationsRef.current >= MAX_VIOLATIONS) return;
    violationsRef.current += 1;
    setViolations(violationsRef.current);
    setWarnVisible(true);
    window.setTimeout(() => setWarnVisible(false), 5000);

    const report = async () => {
      if (!attempt?.id) return;
      try {
        await fetch("/api/proctor-events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attemptId: attempt.id, type }),
        });
      } catch {
        /* mạng lỗi — bỏ qua, không để mất bài vì đường ghi nhật ký */
      }
    };
    void report();
  }, [attempt, result]);

  // Đồng hồ: chỉ đếm ngược. Việc tự nộp khi về 0 nằm ở effect riêng bên dưới,
  // không đặt trong hàm updater của setState (updater phải thuần, không side-effect).
  useEffect(() => {
    if (preview || result) return;
    const timer = window.setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [preview, result]);

  useEffect(() => {
    if (preview) {
      setQuestionOrder(Array.from({ length: exam.questions.length }, (_, i) => i)); // eslint-disable-line react-hooks/set-state-in-effect
      setDraftLoaded(true);
      return;
    }
    // Thứ tự câu/đáp án lấy từ Attempt (server) — client không sinh nữa.
    if (attempt) {
      setQuestionOrder(attempt.questionOrder.length ? attempt.questionOrder : Array.from({ length: exam.questions.length }, (_, i) => i));
      optionShuffleRef.current = attempt.optionOrder || {};
    } else {
      setQuestionOrder(Array.from({ length: exam.questions.length }, (_, i) => i));
    }
    try {
      const raw = localStorage.getItem(draftKey);
      const d = raw ? JSON.parse(raw) : null;
      // Nháp CHỈ khôi phục lời làm. Thời gian còn lại do server tính từ
      // `deadlineAt` — không đọc `d.remaining`/`d.shuffle` như trước nữa.
      if (d && d.answers && typeof d.answers === "object") {
        setAnswers((prev) => ({ ...prev, ...(d.answers || {}) }));
        if (d.marked && typeof d.marked === "object") setMarked((prev) => ({ ...prev, ...(d.marked || {}) }));
        if (Object.keys(d.answers).length > 0) setRestored(true);
      }
    } catch {
      /* corrupt draft */
    }
    setDraftLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Hết giờ → tự nộp. Chờ `draftLoaded` để không nộp khi đáp án trong localStorage
   * chưa kịp vào state (trường hợp mở lại trang khi đã quá hạn). */
  useEffect(() => {
    if (preview || result || expired || !draftLoaded) return;
    if (remaining > 0 || submittedRef.current) return;
    void submitExam(true);
  }, [draftLoaded, expired, preview, result, remaining, submitExam]);

  /* GĐ1 — đồng bộ đồng hồ với server. Sửa lệch múi giờ/đồng hồ máy khách và phát
   * hiện bài đã bị chốt ở nơi khác (tab khác, giáo viên, hết giờ) để ngừng đếm. */
  useEffect(() => {
    if (preview || result || !attempt?.id) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const res = await fetch(`/api/attempts/${attempt.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || submittedRef.current) return;
        if (data.submittedAt) {
          submittedRef.current = true;
          clearDraft();
          if (data.submission) setResult(data.submission);
          return;
        }
        if (typeof data.remainingSeconds === "number") setRemaining(data.remainingSeconds);
      } catch {
        /* offline — đồng hồ vẫn chạy local, lần sync sau sẽ tự sửa */
      }
    };
    const timer = window.setInterval(sync, 20_000);
    window.addEventListener("focus", sync);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
    };
  }, [attempt?.id, clearDraft, preview, result]);

  useEffect(() => {
    if (preview) return;
    const t = window.setTimeout(() => saveDraft(), 600);
    return () => window.clearTimeout(t);
  }, [answers, marked, saveDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (preview) return;
    const interval = window.setInterval(() => saveDraft(), 15000);
    const onHide = () => saveDraft();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [saveDraft, preview]);

  /* PROCTOR-1 — theo dõi rời trang BỊ ĐỘNG (blur/khóa màn hình/tab khác):
   * - Chế độ TẮT (`off`, mặc định): không gắn gì cả — trước đây vẫn đếm +
   *   tự nộp dù GV không bật, đúng lỗi user báo ("không bật mà vẫn chạy").
   * - Ân hạn 30s: quay lại kịp thì không tính. iPhone tự khoá màn hình / đổi app
   *   làm `visibilityState` = hidden — trước ân hạn 10s nên ngồi lâu máy tự tắt là
   *   bị tính oan; nới lên 30s và KHÔNG tự nộp nữa (chỉ ghi nhận). Vẫn đi mới tính
   *   1 lần — blur và hidden của cùng 1 lần rời trang gộp làm một.
   * - Hành động CHỦ ĐỘNG (copy/paste/devtools...) vẫn tính ngay, không ân hạn. */
  useEffect(() => {
    if (preview || result || submittedRef.current) return;
    const requested = exam.proctorMode === "light" || exam.proctorMode === "strict" ? exam.proctorMode : "off";
    if (requested === "off") return;

    const cancelPending = () => {
      if (pendingFlag.current) {
        window.clearTimeout(pendingFlag.current.timer);
        pendingFlag.current = null;
      }
    };
    const schedule = (type: ProctorEventType) => {
      if (submittedRef.current || pendingFlag.current) return;
      pendingFlag.current = {
        type,
        timer: window.setTimeout(() => {
          pendingFlag.current = null;
          flag(type);
        }, 30_000),
      };
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") schedule("visibility_hidden");
      else cancelPending();
    };
    const onBlur = () => schedule("tab_blur");
    const onFocus = () => cancelPending();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      cancelPending();
    };
  }, [preview, result, flag, exam.proctorMode]);

  /* GĐ3 — rào trình duyệt theo chế độ giáo viên chọn. `off` = không gắn gì
   * (mặc định, giữ nguyên hành vi cũ); `light` = phát hiện + ghi nhật ký;
   * `strict` = như light nhưng chặn cứng thao tác + bắt toàn màn hình. Thi trên
   * điện thoại tự hạ `strict` → `light` (không có bàn phím/fullscreen hữu ích).
   *
   * TRUNG THỰC: rào này LUÔN bypass được (Ctrl+Shift+Esc, trình duyệt khác, VM,
   * tắt JS) — chỉ có giá trị răn đe. GĐ0/GĐ1/GĐ2 mới thực sự chống gian lận vì
   * server không còn phải "tin" học sinh. */
  useEffect(() => {
    if (preview || result || submittedRef.current) return;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0;
    const requested = exam.proctorMode === "light" || exam.proctorMode === "strict" ? exam.proctorMode : "off";
    const mode = resolveProctorMode(requested, { isMobile });
    if (mode === "off") return;
    const strict = mode === "strict";
    setStrictActive(strict); // eslint-disable-line react-hooks/set-state-in-effect

    const onCopy = (e: Event) => { flag("copy"); if (strict) e.preventDefault(); };
    const onPaste = (e: Event) => { flag("paste"); if (strict) e.preventDefault(); };
    const onContextMenu = (e: Event) => { flag("context_menu"); if (strict) e.preventDefault(); };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (e.key === "PrintScreen") { flag("screenshot"); return; }
      if (e.key === "F12") { flag("devtools_open"); if (strict) e.preventDefault(); return; }
      if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(key)) { flag("devtools_open"); if (strict) e.preventDefault(); return; }
      if (e.ctrlKey && !e.shiftKey && key === "U") { flag("view_source"); if (strict) e.preventDefault(); return; }
      if (e.ctrlKey && !e.shiftKey && key === "P") { flag("print"); if (strict) e.preventDefault(); return; }
    };

    /* Toàn màn hình: trình duyệt bắt buộc phải có thao tác người dùng nên chỉ
     * vào được ở lần chạm/phím đầu tiên. Thoát ra sau khi đã vào → ghi nhật ký. */
    let hadFullscreen = false;
    const onFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (active) hadFullscreen = true;
      else if (strict && hadFullscreen) flag("fullscreen_exit");
    };
    const enterFullscreen = () => {
      if (!strict || document.fullscreenElement) return;
      const p = document.documentElement.requestFullscreen?.();
      if (p) void p.catch(() => {});
    };

    /* Cảnh báo trước khi rời trang khi bài chưa nộp (chống đóng nhầm tab). */
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submittedRef.current || result) return;
      e.preventDefault();
      e.returnValue = "";
    };

    /* In ấn: Ctrl+P đã bắt ở keydown, còn `window.print()` gọi trực tiếp thì chặn ở đây. */
    const originalPrint = window.print;
    window.print = () => { flag("print"); originalPrint.call(window); };

    /* Chia sẻ/ghi màn hình: bọc `getDisplayMedia` để biết học sinh vừa xin quyền. */
    const mediaDevices = navigator.mediaDevices;
    const originalGetDisplayMedia = mediaDevices?.getDisplayMedia?.bind(mediaDevices);
    if (mediaDevices && originalGetDisplayMedia) {
      try {
        Object.defineProperty(mediaDevices, "getDisplayMedia", {
          configurable: true,
          writable: true,
          value: async (...args: Parameters<MediaDevices["getDisplayMedia"]>) => { flag("screen_share"); return originalGetDisplayMedia(...args); },
        });
      } catch {
        /* một số trình duyệt không cho ghi đè — bỏ qua */
      }
    }

    /* Nhiều tab: BroadcastChannel cùng origin phát hiện tab thứ hai của cùng đề. */
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      const myId = Math.random().toString(36).slice(2);
      try {
        channel = new BroadcastChannel(`edutest-exam-${exam.id}`);
        channel.onmessage = (ev) => {
          const data = ev.data as { kind?: string; from?: string } | undefined;
          if (!data || data.from === myId) return;
          if (data.kind === "hello") {
            if (!multiTabRef.current) { multiTabRef.current = true; flag("multi_tab"); }
            try { channel?.postMessage({ kind: "ack", from: myId }); } catch { /* ignore */ }
          } else if (data.kind === "ack" && !multiTabRef.current) {
            multiTabRef.current = true;
            flag("multi_tab");
          }
        };
        try { channel.postMessage({ kind: "hello", from: myId }); } catch { /* ignore */ }
      } catch {
        /* BroadcastChannel không khả dụng — bỏ qua */
      }
    }

    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    if (strict) {
      window.addEventListener("pointerdown", enterFullscreen, { once: true });
      window.addEventListener("keydown", enterFullscreen, { once: true });
    }

    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pointerdown", enterFullscreen);
      window.removeEventListener("keydown", enterFullscreen);
      window.print = originalPrint;
      if (mediaDevices && originalGetDisplayMedia) {
        try {
          Object.defineProperty(mediaDevices, "getDisplayMedia", { configurable: true, writable: true, value: originalGetDisplayMedia });
        } catch { /* ignore */ }
      }
      try { channel?.close(); } catch { /* ignore */ }
    };
  }, [preview, result, exam.proctorMode, exam.id, flag]);

  const leaveExam = () => router.push(backHref);

  const setMcqAnswer = (letter: string) => setAnswers((prev) => ({ ...prev, [question.id]: letter }));
  const setTrueFalse = (index: number, value: boolean) => {
    const currentValue = typeof answers[question.id] === "object" ? answers[question.id] as Record<string, boolean> : {};
    setAnswers((prev) => ({ ...prev, [question.id]: { ...currentValue, [String(index)]: value } }));
  };
  const setShortAnswer = (value: string) => setAnswers((prev) => ({ ...prev, [question.id]: value }));
  const setEssay = (value: string) => setAnswers((prev) => ({ ...prev, [question.id]: value }));
  const toggleMark = () => setMarked((prev) => ({ ...prev, [question?.id]: !prev[question?.id] }));

  if (expired) {
    return (
      <div className="min-h-screen bg-[var(--surface-bg)] flex items-center justify-center p-4">
        <div className="animate-pop-in bg-[var(--surface-card)] rounded-2xl border border-[var(--surface-border)] p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center bg-[var(--danger-light)] text-[var(--danger)]"><TimerOff size={36} /></div>
          <h1 className="text-2xl font-black tracking-tight mb-2 text-[var(--text-primary)]">Đã hết thời gian làm bài</h1>
          <p className="text-[var(--text-secondary)] text-sm mb-5">Bài làm của bạn không được ghi nhận vì đã quá thời hạn nộp.</p>
          <Button className="w-full" onClick={() => router.push(exam.isGuest ? backHref : "/bang-dieu-khien/de-thi")}>Về danh sách đề thi</Button>
        </div>
      </div>
    );
  }

  if (result) {
    const col = scoreColor(result.score);
    return (
      <div className="min-h-screen bg-[var(--surface-bg)] flex justify-center p-4">
        <TransitionOverlay show={retrying} label={exam.isGuest ? "Đang quay lại trang nhập tên…" : "Đang vào lại phòng thi…"} />
        <div className="w-full max-w-2xl">
          <div className="animate-pop-in bg-[var(--surface-card)] rounded-2xl border border-[var(--surface-border)] p-8 w-full text-center">
            {exam.showScoreImmediately === false ? (
              <>
                <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center bg-[var(--warning-light)] text-[var(--warning)]"><Hourglass size={36} /></div>
                <h1 className="text-2xl font-black tracking-tight mb-2 text-[var(--text-primary)]">Đã nộp bài thành công!</h1>
                <p className="text-[var(--text-secondary)] text-sm mb-5">
                  Giáo viên sẽ công bố điểm sau khi chấm. Bạn đã trả lời {result.totalQuestions} câu hỏi trong {formatTime(result.durationSeconds)}.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: `color-mix(in srgb, ${col} 15%, transparent)` }}><Trophy size={36} style={{ color: col }} /></div>
                <h1 className="text-3xl font-black tracking-tight tabular-nums mb-1" style={{ color: col }}>{result.score}/10</h1>
                <p className="text-[var(--text-secondary)] text-sm mb-5">{result.correctCount}/{result.totalQuestions} câu được chấm · {formatTime(result.durationSeconds)}</p>
              </>
            )}
            {exam.isGuest && <p className="text-xs text-[var(--text-muted)]">Kết quả đã được ghi nhận cho bài thi này.</p>}
          </div>

          {result.review && result.review.length > 0 && <GuestReview items={result.review} />}

          <div className="mt-6 flex flex-col gap-3">
            {result.canRetry !== false && (
              <Button size="lg" className="w-full h-14 sm:h-14 text-base" onClick={handleRetry}><RotateCcw size={18} /> Làm lại</Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => router.push(exam.isGuest ? backHref : "/bang-dieu-khien")}>
              {exam.isGuest ? "Về danh sách đề thi" : "Về trang chủ"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const progress = totalQuestions ? (answeredCount / totalQuestions) * 100 : 0;
  const isLow = remaining <= 60;
  const currentAnswer = answers[question?.id];

  return (
    <div className="min-h-screen bg-[var(--surface-bg)] flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--surface-card)] border-b border-[var(--surface-border)] px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {!preview && (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={`Danh sách câu hỏi (đã làm ${answeredCount}/${totalQuestions})`}
              className="lg:hidden grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--gray-100)]"
            >
              <Menu size={17} />
            </button>
          )}
          <button type="button" onClick={() => (preview || answeredCount === 0 ? leaveExam() : setShowExitConfirm(true))} className="inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-xl border border-[var(--surface-border)] px-2.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-100)]"><ArrowLeft size={15}/><span className="hidden sm:inline">{preview ? "Quay lại" : "Thoát"}</span></button>
          <div className="min-w-0 hidden sm:block"><p className="truncate text-sm font-semibold text-[var(--text-primary)]">{exam.title}</p>{preview ? <p className="text-[11px] font-semibold text-[var(--primary)] flex items-center gap-1"><Eye size={11}/> Chế độ xem trước</p> : lastSaved ? <p className="text-[11px] font-medium text-[var(--success)] flex items-center gap-1"><CheckCircle2 size={11}/> Đã lưu tự động</p> : <p className="text-[11px] text-[var(--text-muted)]">Tự động lưu bài làm</p>}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-black tabular-nums", isLow && !preview ? "bg-[var(--danger-light)] text-[var(--danger)] animate-pulse" : "border border-[var(--surface-border)] text-[var(--text-primary)] bg-[var(--gray-50)]")}><Clock size={15}/>{preview ? "XEM TRƯỚC" : formatTime(remaining)}</div>
          {!preview && (
            <Button size="sm" className="lg:hidden" onClick={() => submitExam(false)} disabled={totalQuestions === 0} loading={submitting}>Nộp bài</Button>
          )}
        </div>
      </header>

      {preview && <div className="bg-[var(--primary-light)] border-b border-[var(--primary-muted)] px-4 py-2 text-center text-xs font-semibold text-[var(--primary)]">Đây là chế độ xem trước. Lựa chọn của bạn sẽ không được nộp.</div>}
      {!preview && violations > 0 && (
        <div className={`border-b px-4 py-2 text-center text-xs font-bold ${violations >= MAX_VIOLATIONS ? "bg-[var(--danger)] text-white" : "bg-[var(--warning-light)] border-[var(--warning-border)] text-[var(--warning)]"}`}>
          {violations >= MAX_VIOLATIONS
            ? `Đã ghi nhận ${violations} lần rời khỏi trang thi. Giáo viên sẽ xem lại phần này.`
            : `Cảnh báo ${violations}/${MAX_VIOLATIONS}: Không rời khỏi trang thi.`}
        </div>
      )}
      {!preview && warnVisible && violations < MAX_VIOLATIONS && (
        <div role="alert" className="fixed bottom-6 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-[var(--warning-border)] bg-[var(--surface-card)] p-4 shadow-xl flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--warning-light)] text-[var(--warning)]">
            <AlertTriangle size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[var(--text-primary)]">Phát hiện rời khỏi bài thi (lần {violations}/{MAX_VIOLATIONS})</p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Quay lại làm bài ngay. Việc rời trang sẽ được ghi nhận để giáo viên xem lại.</p>
          </div>
          <button type="button" onClick={() => setWarnVisible(false)} aria-label="Đóng cảnh báo" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--gray-100)]">
            <X size={15} />
          </button>
        </div>
      )}
      {!preview && strictActive && !isFullscreen && <div className="bg-[var(--warning-light)] border-b border-[var(--warning-border)] px-4 py-2 text-center text-xs font-bold text-[var(--warning)]">Chế độ nghiêm: làm bài ở chế độ toàn màn hình. <button type="button" className="underline font-black" onClick={() => { const p = document.documentElement.requestFullscreen?.(); if (p) void p.catch(() => {}); }}>Bật toàn màn hình</button></div>}
      {!preview && restored && <div className="bg-[var(--primary-light)] border-b border-[var(--primary-muted)] px-4 py-2 text-center text-xs font-semibold text-[var(--primary)]">Đã khôi phục bài làm trước đó của bạn</div>}
      {offline && !preview && (
        <div role="status" className="bg-[var(--warning-light)] border-b border-[var(--warning-border)] px-4 py-2 text-center text-xs font-bold text-[var(--warning)]">
          Mất kết nối mạng — bài làm vẫn được lưu cục bộ. Kiểm tra lại mạng để nộp bài.
        </div>
      )}
      {!preview && remaining <= 60 && remaining > 0 && <div className="bg-[var(--danger-light)] border-b border-[var(--danger-light)] px-4 py-2 text-center text-xs font-bold text-[var(--danger)] animate-pulse">Còn {formatTime(remaining)} — sắp hết giờ!</div>}
      {!preview && remaining <= 300 && remaining > 60 && <div className="bg-[var(--warning-light)] border-b border-[var(--warning-border)] px-4 py-2 text-center text-xs font-bold text-[var(--warning)]">Còn {Math.ceil(remaining / 60)} phút để hoàn thành bài thi</div>}
      <div className="h-1 bg-[var(--gray-100)]"><div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${progress}%` }}/></div>

      <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-5 p-4 pt-6">
        <main className="flex-1 min-w-0">
          <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-2xl p-5 sm:p-6 mb-4">
            <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 min-w-0"><span className="text-xs font-bold text-white bg-[var(--primary)] rounded-md px-2.5 py-1">Câu {current + 1}/{totalQuestions}</span><span className="text-xs font-semibold text-[var(--text-secondary)]">{question?.type === "mcq" ? "Trắc nghiệm" : question?.type === "true_false" ? "Đúng / Sai" : question?.type === "short_answer" ? "Trả lời ngắn" : "Tự luận"}</span></div>
            {!preview && (
              <button type="button" onClick={toggleMark} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition shrink-0", marked[question?.id] ? "border-[var(--warning-border)] bg-[var(--warning-light)] text-[var(--warning)]" : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--gray-100)]")}>
                <Flag size={12} className={marked[question?.id] ? "fill-[var(--warning)] text-[var(--warning)]" : ""} />{marked[question?.id] ? "Đã đánh dấu" : "Đánh dấu"}
              </button>
            )}
          </div>
            {question?.grading?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={question.grading.image} alt="Hình minh hoạ câu hỏi" className="mb-4 max-h-80 w-auto rounded-xl border border-[var(--surface-border)] bg-white" />
            )}
            <p className="text-base font-medium leading-relaxed text-[var(--text-primary)] mb-5">{question?.text}</p>

            {question?.type === "mcq" && <div className="flex flex-col gap-2">{(() => { const perm = optionShuffleRef.current[question.id] || Array.from({ length: question.options.length }, (_, i) => i); // eslint-disable-line react-hooks/refs
 return question.options.map((_, displayIndex) => { const origIndex = perm[displayIndex]; const letter = String.fromCharCode(65 + displayIndex); const selected = typeof currentAnswer === "string" && (currentAnswer.charCodeAt(0) - 65) === origIndex; return <button key={displayIndex} onClick={() => setMcqAnswer(String.fromCharCode(65 + origIndex))} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition", selected ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] font-semibold" : "border-[var(--surface-border)] hover:bg-[var(--gray-100)]")}><span className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0", selected ? "bg-[var(--primary)] text-white" : "bg-[var(--gray-100)] text-[var(--text-secondary)]")}>{letter}</span>{question.options[origIndex]}</button>; }); })()}</div>}

            {question?.type === "true_false" && <div className="flex flex-col gap-3">{(question.grading?.statements || []).map((statement, index) => { const values = (typeof currentAnswer === "object" ? currentAnswer : {}) as Record<string, boolean>; const selected = values[String(index)]; return <div key={index} className="rounded-xl border border-[var(--surface-border)] p-4"><p className="text-sm text-[var(--text-primary)] mb-3"><span className="font-bold mr-2">{String.fromCharCode(97 + index)}.</span>{statement.text}</p><div className="flex gap-2"><button onClick={() => setTrueFalse(index, true)} className={cn("flex-1 rounded-lg border py-2 text-sm font-semibold", selected === true ? "border-[var(--success)] bg-[var(--success-light)] text-[var(--success)]" : "border-[var(--surface-border)]")}>Đúng</button><button onClick={() => setTrueFalse(index, false)} className={cn("flex-1 rounded-lg border py-2 text-sm font-semibold", selected === false ? "border-[var(--danger)] bg-[var(--danger-light)] text-[var(--danger)]" : "border-[var(--surface-border)]")}>Sai</button></div></div>;})}</div>}

            {question?.type === "short_answer" && <div><input value={typeof currentAnswer === "string" ? currentAnswer : ""} onChange={(e) => setShortAnswer(e.target.value)} placeholder="Nhập câu trả lời..." className="w-full rounded-xl border border-[var(--surface-border)] p-4 text-sm outline-none focus:border-[var(--primary)]"/><p className="mt-2 text-xs text-[var(--text-muted)]">Hãy nhập câu trả lời ngắn gọn.</p></div>}

            {question?.type === "essay" && <div><textarea value={typeof currentAnswer === "string" ? currentAnswer : ""} onChange={(e) => setEssay(e.target.value)} rows={8} placeholder="Nhập câu trả lời của bạn..." className="w-full rounded-xl border border-[var(--surface-border)] p-4 text-sm outline-none resize-y focus:border-[var(--primary)]"/><p className="mt-2 text-xs text-[var(--warning)]">Câu tự luận sẽ được giáo viên chấm thủ công.</p></div>}
          </div>

          <div className="flex items-center justify-between gap-3"><Button variant="outline" onClick={() => setCurrent((v) => Math.max(0, v - 1))} disabled={current === 0}><ArrowLeft size={16}/> Trước</Button>{current < totalQuestions - 1 ? <Button onClick={() => setCurrent((v) => v + 1)}>Tiếp <ArrowRight size={16}/></Button> : <Button onClick={() => submitExam(false)} loading={submitting} disabled={preview || totalQuestions === 0}><Send size={16}/> {preview ? "Không nộp trong xem trước" : "Nộp bài"}</Button>}</div>
        </main>

        <aside className="hidden lg:block lg:w-56 lg:shrink-0">
          <QuestionPalette orderedQuestions={orderedQuestions} current={current} setCurrent={setCurrent} marked={marked} answers={answers} preview={preview} totalQuestions={totalQuestions} submitting={submitting} submitExam={submitExam} />
        </aside>
        {paletteOpen && !preview && (
          <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-label="Danh sách câu hỏi">
            <div className="absolute inset-0 bg-black/40" onClick={() => setPaletteOpen(false)} />
            <div className="absolute inset-x-3 bottom-3 max-h-[70vh] overflow-y-auto rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-bg)] p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-black text-[var(--text-secondary)]">Đã làm {answeredCount}/{totalQuestions} câu</p>
                <button type="button" onClick={() => setPaletteOpen(false)} aria-label="Đóng danh sách câu hỏi" className="grid h-9 w-9 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--gray-100)]">
                  <X size={16} />
                </button>
              </div>
              <div onClick={() => setPaletteOpen(false)}>
                <QuestionPalette orderedQuestions={orderedQuestions} current={current} setCurrent={setCurrent} marked={marked} answers={answers} preview={preview} totalQuestions={totalQuestions} submitting={submitting} submitExam={submitExam} />
              </div>
            </div>
          </div>
        )}
      </div>

      {showConfirm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"><div className="bg-[var(--surface-card)] rounded-2xl p-6 max-w-sm w-full"><h3 className="font-bold mb-2">Xác nhận nộp bài?</h3><p className="text-sm text-[var(--text-secondary)] mb-5">Bạn còn {totalQuestions - answeredCount} câu chưa trả lời. Vẫn nộp bài?</p><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Làm tiếp</Button><Button className="flex-1" onClick={() => submitExam(true)} loading={submitting}>Nộp bài</Button></div></div></div>}
      {showExitConfirm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"><div className="bg-[var(--surface-card)] rounded-2xl p-6 max-w-sm w-full"><h3 className="font-bold mb-2">Thoát bài thi?</h3><p className="text-sm text-[var(--text-secondary)] mb-5">Bài làm sẽ được lưu tự động. Bạn có thể quay lại làm tiếp trong thời gian còn lại.</p><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setShowExitConfirm(false)}>Ở lại</Button><Button className="flex-1" onClick={leaveExam}>Thoát</Button></div></div></div>}
      <TransitionOverlay show={submitting} label="Đang nộp bài…" hint="Vui lòng không tắt trang trong lúc nộp." />
    </div>
  );
}
