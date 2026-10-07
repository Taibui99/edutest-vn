"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Eye, Flag, Send, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { MAX_VIOLATIONS, type ProctorEventType } from "@/lib/integrity";

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
  grading?: { statements?: Array<{ text: string; answer?: boolean }>; acceptedAnswers?: string[] } | null;
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

type SubmissionResult = { score: number; correctCount: number; totalQuestions: number; durationSeconds: number };

type AnswerValue = string | Record<string, boolean>;

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function scoreColor(score: number) {
  if (score >= 8) return "var(--score-good)";
  if (score >= 5) return "var(--score-mid)";
  return "var(--score-bad)";
}

export function ExamTakingClientV2({ exam, attempt, preview = false, backHref }: { exam: Exam; attempt?: Attempt; preview?: boolean; backHref: string }) {
  const router = useRouter();
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
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [questionOrder, setQuestionOrder] = useState<number[] | null>(() => attempt?.questionOrder ?? null);
  const optionShuffleRef = useRef<Record<string, number[]>>(attempt?.optionOrder ?? {});
  const [violations, setViolations] = useState(0);
  const [warnVisible, setWarnVisible] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator === "undefined" ? false : !navigator.onLine);
  const violationsRef = useRef(0);

  useEffect(() => {
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
      if (data.resultLink) {
        router.push(data.resultLink);
        return;
      }
      setResult(data.submission);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể nộp bài");
      setSubmitting(false);
    }
  }, [answers, attempt, answeredCount, clearDraft, exam.id, preview, result, router, showConfirm, submitting, totalQuestions]);

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

  useEffect(() => {
    if (preview || result || submittedRef.current) return;
    /* GĐ2 — mỗi lần rời tab đều báo cho server ghi vào nhật ký của lần làm bài,
     * để giáo viên có timeline "vì sao bài này bị gắn cờ".
     *
     * Lần vi phạm CUỐI cùng phải CHỜ server ghi xong rồi mới nộp: nộp trước
     * thì server đếm thiếu → không gán được `autoSubmitted` (server tự suy ra
     * từ số sự kiện, không tin cờ do client gửi). Báo lỗi mạng vẫn nộp, không
     * để mất bài chỉ vì đường ghi nhật ký. */
    const flag = (type: ProctorEventType) => {
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

      if (violationsRef.current >= MAX_VIOLATIONS) void report().then(() => submitExam(true));
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flag("visibility_hidden");
    };
    const onBlur = () => flag("tab_blur");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [preview, result, submitExam, attempt?.id]);

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
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--surface-border)] p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center bg-[var(--danger-light)] text-[var(--danger)] text-3xl">⏰</div>
          <h1 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Đã hết thời gian làm bài</h1>
          <p className="text-[var(--text-secondary)] text-sm mb-5">Bài làm của bạn không được ghi nhận vì đã quá thời hạn nộp.</p>
          <Button className="w-full" onClick={() => router.push(exam.isGuest ? backHref : "/bang-dieu-khien/de-thi")}>Về danh sách đề thi</Button>
        </div>
      </div>
    );
  }

  if (result) {
    const col = scoreColor(result.score);
    return (
      <div className="min-h-screen bg-[var(--surface-bg)] flex items-center justify-center p-4">
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--surface-border)] p-8 max-w-md w-full text-center">
          {exam.showScoreImmediately === false ? (
            <>
              <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center bg-[var(--warning-light)] text-[var(--warning)] text-3xl">⏳</div>
              <h1 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Đã nộp bài thành công!</h1>
              <p className="text-[var(--text-secondary)] text-sm mb-5">
                Giáo viên sẽ công bố điểm sau khi chấm. Bạn đã trả lời {result.totalQuestions} câu hỏi trong {formatTime(result.durationSeconds)}.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: `color-mix(in srgb, ${col} 15%, transparent)` }}><Trophy size={36} style={{ color: col }} /></div>
              <h1 className="text-3xl font-bold mb-1" style={{ color: col }}>{result.score}/10</h1>
              <p className="text-[var(--text-secondary)] text-sm mb-5">{result.correctCount}/{result.totalQuestions} câu được chấm · {formatTime(result.durationSeconds)}</p>
            </>
          )}
          {exam.isGuest ? <p className="text-xs text-[var(--text-muted)]">Kết quả đã được ghi nhận cho bài thi này.</p> : <Button className="w-full" onClick={() => router.push("/bang-dieu-khien")}>Về trang chủ</Button>}
        </div>
      </div>
    );
  }

  const progress = totalQuestions ? (answeredCount / totalQuestions) * 100 : 0;
  const isLow = remaining <= 60;
  const currentAnswer = answers[question?.id];

  return (
    <div className="min-h-screen bg-[var(--surface-bg)] flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--surface-card)] border-b border-[var(--surface-border)] px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={() => (preview || answeredCount === 0 ? leaveExam() : setShowExitConfirm(true))} className="inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-xl border border-[var(--surface-border)] px-2.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-100)]"><ArrowLeft size={15}/><span className="hidden sm:inline">{preview ? "Quay lại" : "Thoát"}</span></button>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-primary)]">{exam.title}</p>{preview ? <p className="text-[11px] font-semibold text-[var(--primary)] flex items-center gap-1"><Eye size={11}/> Chế độ xem trước</p> : lastSaved ? <p className="text-[11px] font-medium text-[var(--success)] flex items-center gap-1"><CheckCircle2 size={11}/> Đã lưu tự động</p> : <p className="text-[11px] text-[var(--text-muted)]">Tự động lưu bài làm</p>}</div>
        </div>
        <div className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-black tabular-nums", isLow && !preview ? "bg-[var(--danger-light)] text-[var(--danger)] animate-pulse" : "border border-[var(--surface-border)] text-[var(--text-primary)] bg-[var(--gray-50)]")}><Clock size={15}/>{preview ? "XEM TRƯỚC" : formatTime(remaining)}</div>
      </header>

      {preview && <div className="bg-[var(--primary-light)] border-b border-[var(--primary-muted)] px-4 py-2 text-center text-xs font-semibold text-[var(--primary)]">Đây là chế độ xem trước. Lựa chọn của bạn sẽ không được nộp.</div>}
      {!preview && violations > 0 && (
        <div className={`border-b px-4 py-2 text-center text-xs font-bold ${violations >= MAX_VIOLATIONS ? "bg-[var(--danger)] text-white" : "bg-[var(--warning-light)] border-[var(--warning-border)] text-[var(--warning)]"}`}>
          {violations >= MAX_VIOLATIONS
            ? "Bạn đã rời khỏi trang thi quá nhiều lần. Bài thi đã được nộp tự động."
            : `Cảnh báo ${violations}/${MAX_VIOLATIONS}: Không rời khỏi trang thi. Rời khỏi trang ${MAX_VIOLATIONS} lần sẽ bị nộp bài tự động!`}
        </div>
      )}
      {!preview && warnVisible && violations < MAX_VIOLATIONS && <div className="bg-[var(--warning-light)] border-b border-[var(--warning-border)] px-4 py-1.5 text-center text-[11px] font-bold text-[var(--warning)]">Bạn đã rời khỏi trang thi (lần {violations}). Vui lòng quay lại làm bài ngay!</div>}
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
            <p className="text-base font-medium leading-relaxed text-[var(--text-primary)] mb-5">{question?.text}</p>

            {question?.type === "mcq" && <div className="flex flex-col gap-2">{(() => { const perm = optionShuffleRef.current[question.id] || Array.from({ length: question.options.length }, (_, i) => i); // eslint-disable-line react-hooks/refs
 return question.options.map((_, displayIndex) => { const origIndex = perm[displayIndex]; const letter = String.fromCharCode(65 + displayIndex); const selected = typeof currentAnswer === "string" && (currentAnswer.charCodeAt(0) - 65) === origIndex; return <button key={displayIndex} onClick={() => setMcqAnswer(String.fromCharCode(65 + origIndex))} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition", selected ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] font-semibold" : "border-[var(--surface-border)] hover:bg-[var(--gray-100)]")}><span className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0", selected ? "bg-[var(--primary)] text-white" : "bg-[var(--gray-100)] text-[var(--text-secondary)]")}>{letter}</span>{question.options[origIndex]}</button>; }); })()}</div>}

            {question?.type === "true_false" && <div className="flex flex-col gap-3">{(question.grading?.statements || []).map((statement, index) => { const values = (typeof currentAnswer === "object" ? currentAnswer : {}) as Record<string, boolean>; const selected = values[String(index)]; return <div key={index} className="rounded-xl border border-[var(--surface-border)] p-4"><p className="text-sm text-[var(--text-primary)] mb-3"><span className="font-bold mr-2">{String.fromCharCode(97 + index)}.</span>{statement.text}</p><div className="flex gap-2"><button onClick={() => setTrueFalse(index, true)} className={cn("flex-1 rounded-lg border py-2 text-sm font-semibold", selected === true ? "border-[var(--success)] bg-[var(--success-light)] text-[var(--success)]" : "border-[var(--surface-border)]")}>Đúng</button><button onClick={() => setTrueFalse(index, false)} className={cn("flex-1 rounded-lg border py-2 text-sm font-semibold", selected === false ? "border-[var(--danger)] bg-[var(--danger-light)] text-[var(--danger)]" : "border-[var(--surface-border)]")}>Sai</button></div></div>;})}</div>}

            {question?.type === "short_answer" && <div><input value={typeof currentAnswer === "string" ? currentAnswer : ""} onChange={(e) => setShortAnswer(e.target.value)} placeholder="Nhập câu trả lời..." className="w-full rounded-xl border border-[var(--surface-border)] p-4 text-sm outline-none focus:border-[var(--primary)]"/><p className="mt-2 text-xs text-[var(--text-muted)]">Hãy nhập câu trả lời ngắn gọn.</p></div>}

            {question?.type === "essay" && <div><textarea value={typeof currentAnswer === "string" ? currentAnswer : ""} onChange={(e) => setEssay(e.target.value)} rows={8} placeholder="Nhập câu trả lời của bạn..." className="w-full rounded-xl border border-[var(--surface-border)] p-4 text-sm outline-none resize-y focus:border-[var(--primary)]"/><p className="mt-2 text-xs text-[var(--warning)]">Câu tự luận sẽ được giáo viên chấm thủ công.</p></div>}
          </div>

          <div className="flex items-center justify-between gap-3"><Button variant="outline" onClick={() => setCurrent((v) => Math.max(0, v - 1))} disabled={current === 0}><ArrowLeft size={16}/> Trước</Button>{current < totalQuestions - 1 ? <Button onClick={() => setCurrent((v) => v + 1)}>Tiếp <ArrowRight size={16}/></Button> : <Button onClick={() => submitExam(false)} loading={submitting} disabled={preview || totalQuestions === 0}><Send size={16}/> {preview ? "Không nộp trong xem trước" : "Nộp bài"}</Button>}</div>
        </main>

        <aside className="lg:w-56 lg:shrink-0"><div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--surface-border)] p-4 lg:sticky lg:top-24"><p className="text-xs font-bold text-[var(--text-muted)] mb-3">CÂU HỎI</p><div className="grid grid-cols-5 gap-1.5 mb-3">{orderedQuestions.map((q, i) => <button key={q.id} onClick={() => setCurrent(i)} className={cn("aspect-square rounded-lg text-xs font-bold", current === i ? "bg-[var(--primary)] text-white" : marked[q.id] ? "bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning-border)]" : answers[q.id] ? "bg-[var(--success-light)] text-[var(--success)] border border-[var(--success-light)]" : "bg-[var(--gray-100)] text-[var(--text-muted)] border border-[var(--surface-border)]")}>{i + 1}</button>)}</div><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)] mb-3"><span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-[var(--warning-border)] bg-[var(--warning-light)] inline-block" /> Xem lại</span><span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-[var(--success-light)] bg-[var(--success-light)] inline-block" /> Đã trả lời</span></div><Button className="w-full" onClick={() => submitExam(false)} disabled={preview || totalQuestions === 0} loading={submitting}>{preview ? "Xem trước" : "Nộp bài"}</Button></div></aside>
      </div>

      {showConfirm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"><div className="bg-[var(--surface-card)] rounded-2xl p-6 max-w-sm w-full"><h3 className="font-bold mb-2">Xác nhận nộp bài?</h3><p className="text-sm text-[var(--text-secondary)] mb-5">Bạn còn {totalQuestions - answeredCount} câu chưa trả lời. Vẫn nộp bài?</p><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Làm tiếp</Button><Button className="flex-1" onClick={() => submitExam(true)} loading={submitting}>Nộp bài</Button></div></div></div>}
      {showExitConfirm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"><div className="bg-[var(--surface-card)] rounded-2xl p-6 max-w-sm w-full"><h3 className="font-bold mb-2">Thoát bài thi?</h3><p className="text-sm text-[var(--text-secondary)] mb-5">Bài làm sẽ được lưu tự động. Bạn có thể quay lại làm tiếp trong thời gian còn lại.</p><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setShowExitConfirm(false)}>Ở lại</Button><Button className="flex-1" onClick={leaveExam}>Thoát</Button></div></div></div>}
    </div>
  );
}
