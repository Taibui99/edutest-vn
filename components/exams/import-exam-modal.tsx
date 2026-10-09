"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  FileUp,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import { importExamFile, type GenerateOptions, type ImportMode, type ImportStage } from "@/lib/import-exam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type View = "select" | "processing" | "review" | "error";

type Grading = {
  statements?: { text: string; answer: boolean }[];
  acceptedAnswers?: string[];
  difficulty?: string;
  rubricPoints?: string[];
};

/* AI-6a — export để panel soạn đề trong chat tái dùng đúng logic parse của modal. */
export type ReviewedQuestion = {
  type: string;
  question: string;
  options: string[];
  answer: string;
  grading?: Grading;
  difficulty?: string;
  rubricPoints?: string[];
  points: number;
  answerSource?: string;
  confidence?: number;
  needsReview?: boolean;
  solveNote?: string;
};

type ImportedPayload = {
  title?: unknown;
  subject?: unknown;
  kind?: string;
  answerKeyFound?: boolean;
  answerKeyNote?: string;
  questions?: ReviewedQuestion[];
};

export type SmartStats = {
  total: number;
  mcq: number;
  theory: number;
  fromDocument: number;
  solvedByAi: number;
  agreed: number;
  needsReview: number;
};

const DIFFICULTIES = ["nhận biết", "thông hiểu", "vận dụng"];

const TYPE_LABELS: { value: string; label: string }[] = [
  { value: "mcq", label: "Trắc nghiệm 4 đáp án" },
  { value: "true_false", label: "Đúng / Sai" },
  { value: "short_answer", label: "Trả lời ngắn" },
];

const TYPE_NAMES: Record<string, string> = {
  mcq: "Trắc nghiệm",
  true_false: "Đúng / Sai",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
  unknown: "Chưa rõ loại",
};

const LETTERS = ["A", "B", "C", "D"];

const STAGES: { key: ImportStage; label: string; smartOnly?: boolean }[] = [
  { key: "upload", label: "Tải tài liệu lên" },
  { key: "extract", label: "Đọc nội dung tài liệu" },
  { key: "analyze", label: "AI dựng lại đề và nhận diện đáp án" },
  { key: "solve", label: "AI tự làm câu thiếu đáp án", smartOnly: true },
  { key: "check", label: "Đối chiếu và kiểm tra" },
  { key: "done", label: "Chờ giáo viên duyệt" },
];

export function parseImportResult(result: string): ImportedPayload {
  const cleaned = result.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as ImportedPayload;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.questions)) {
    throw new Error("AI trả về dữ liệu không hợp lệ");
  }
  return parsed;
}

function normalizeDifficulty(value: unknown): string | undefined {
  const s = String(value ?? "").trim().toLowerCase();
  return DIFFICULTIES.find((d) => d === s);
}

/** Chuẩn hoá câu để màn review hiển thị và áp dụng được. */
export function toReviewItem(raw: ReviewedQuestion): ReviewedQuestion {
  const type = Object.keys(TYPE_NAMES).includes(raw.type) ? raw.type : "mcq";
  const options = (Array.isArray(raw.options) ? raw.options : []).map((o) => String(o).replace(/^[A-F][.)]\s*/i, "").trim());
  const rubric = Array.isArray(raw.rubricPoints)
    ? raw.rubricPoints.map(String).filter(Boolean)
    : Array.isArray(raw.grading?.rubricPoints)
      ? (raw.grading?.rubricPoints ?? []).filter(Boolean)
      : [];
  const difficulty = normalizeDifficulty(raw.difficulty) ?? normalizeDifficulty(raw.grading?.difficulty);
  const mcq = type === "mcq";
  return {
    type,
    question: String(raw.question ?? "").trim(),
    // Server chỉ chấp nhận trắc nghiệm 2-4 đáp án nên giới hạn 4 ở đây để giáo viên không phải xử lý lỗi lúc lưu đề.
    options: mcq ? (options.length ? options.slice(0, 4) : ["", "", "", ""]) : [],
    answer: mcq ? String(raw.answer ?? "").trim().toUpperCase() : String(raw.answer ?? ""),
    grading: {
      ...(raw.grading ?? {}),
      ...(difficulty ? { difficulty } : {}),
      ...(rubric.length ? { rubricPoints: rubric } : {}),
    },
    difficulty,
    rubricPoints: rubric,
    points: Number(raw.points) > 0 ? Number(raw.points) : 1,
    answerSource: mcq ? raw.answerSource ?? "unknown" : undefined,
    confidence: typeof raw.confidence === "number" ? raw.confidence : undefined,
    needsReview: raw.needsReview === true,
    solveNote: raw.solveNote ? String(raw.solveNote) : undefined,
  };
}

export function isCompleteQuestion(q: ReviewedQuestion): boolean {
  if (!q.question) return false;
  if (q.type === "mcq") return q.options.filter((o) => o.trim()).length >= 2 && !!q.answer;
  return true;
}

export function ImportExamModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (parsed: { title?: string; questions: ReviewedQuestion[] }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("select");
  const [mode, setMode] = useState<ImportMode>("smart");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [count, setCount] = useState("10");
  const [subject, setSubject] = useState("");
  const [types, setTypes] = useState<string[]>(["mcq"]);
  const [customNote, setCustomNote] = useState("");
  const [activeStage, setActiveStage] = useState<ImportStage | null>(null);
  const [progress, setProgress] = useState<{ done?: number; total?: number }>({});
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<ImportedPayload | null>(null);
  const [reviewed, setReviewed] = useState<ReviewedQuestion[]>([]);

  const reset = () => {
    setView("select");
    setFile(null);
    setText("");
    setActiveStage(null);
    setProgress({});
    setElapsed(0);
    setError("");
    setPayload(null);
    setReviewed([]);
  };
  const close = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (!open || view !== "processing") return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && view !== "processing") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const stages = useMemo(() => STAGES.filter((s) => !(s.smartOnly && mode !== "smart")), [mode]);
  const stats = useMemo<SmartStats>(() => {
    const list = reviewed;
    const mcq = list.filter((q) => q.type === "mcq").length;
    return {
      total: list.length,
      mcq,
      theory: list.length - mcq,
      fromDocument: list.filter((q) => q.answerSource === "document").length,
      solvedByAi: list.filter((q) => q.answerSource === "ai").length,
      agreed: list.filter((q) => /đồng thuận/.test(q.solveNote ?? "")).length,
      needsReview: list.filter((q) => q.needsReview).length,
    };
  }, [reviewed]);

  if (!open) return null;

  const start = async (next: File | null) => {
    setError("");
    if (mode === "generate") {
      const n = Number(count);
      if (!next && text.trim().length < 80) {
        setError("Cần tài liệu: tải file lên hoặc dán ít nhất vài dòng nội dung lý thuyết.");
        setView("error");
        return;
      }
      if (!Number.isFinite(n) || n < 1 || n > 60) {
        setError("Số câu phải từ 1 đến 60.");
        setView("error");
        return;
      }
    } else if (!next && text.trim().length < 40) {
      setError("Vui lòng tải file PDF/Word hoặc dán nội dung đề thi vào.");
      setView("error");
      return;
    }

    if (next && !/\.(pdf|docx)$/i.test(next.name)) {
      setError("Chỉ hỗ trợ PDF hoặc Word (.docx).");
      setView("error");
      return;
    }

    setFile(next);
    setActiveStage(mode === "generate" && next ? "upload" : "extract");
    setProgress({});
    setElapsed(0);
    setView("processing");
    try {
      const options: GenerateOptions = {
        count: Number(count),
        subject: subject.trim() || undefined,
        types,
        customNote: customNote.trim() || undefined,
        withExplanation: false,
      };
      const { result } = await importExamFile(
        next,
        (s, p) => {
          setActiveStage(s);
          if (p) setProgress({ done: p.done, total: p.total });
        },
        { mode, options, text },
      );
      const parsed = parseImportResult(result);
      const items = (parsed.questions ?? []).map(toReviewItem);
      if (items.length === 0) throw new Error("AI không tạo được câu hỏi nào. Thử thêm nội dung hoặc đổi yêu cầu.");
      setPayload(parsed);
      setReviewed(items);
      setActiveStage("done");
      setView("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : mode === "generate" ? "Không thể soạn đề." : "Không thể đọc tài liệu.");
      setActiveStage(null);
      setView("error");
    }
  };

  const stageIndex = (key: ImportStage) => stages.findIndex((s) => s.key === key);
  const activeIndex = activeStage ? stageIndex(activeStage) : -1;
  const toggleType = (value: string) =>
    setTypes((prev) => (prev.includes(value) ? (prev.length > 1 ? prev.filter((t) => t !== value) : prev) : [...prev, value]));
  const patchQuestion = (index: number, patch: Partial<ReviewedQuestion>) =>
    setReviewed((list) => list.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  const setDifficulty = (index: number, difficulty: string) =>
    patchQuestion(index, { difficulty, grading: { ...(reviewed[index].grading ?? {}), difficulty } });
  const setOption = (index: number, oi: number, value: string) => {
    const options = [...reviewed[index].options];
    options[oi] = value;
    patchQuestion(index, { options });
  };

  const apply = () => {
    const usable = reviewed.filter(isCompleteQuestion);
    const skipped = reviewed.length - usable.length;
    if (usable.length === 0) {
      setError("Chưa có câu nào hoàn chỉnh để áp dụng.");
      return;
    }
    if (skipped > 0 && !window.confirm(`${skipped} câu chưa hoàn chỉnh sẽ bị bỏ qua. Tiếp tục áp dụng ${usable.length} câu?`)) return;
    onSuccess({
      title: payload?.title ? String(payload.title) : undefined,
      questions: usable,
    });
    close();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 py-4 backdrop-blur-[3px] sm:py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tạo đề bằng AI"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-[var(--surface-card)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--surface-border)] px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
              <FileUp size={17} /> Tạo đề bằng AI
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {mode === "smart" ? "AI đọc tài liệu và dựng đề" : "Soạn đề thi từ tài liệu"}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {mode === "smart"
                ? "AI dựng lại đề có sẵn trong tài liệu, tự làm phần đáp án còn thiếu rồi để bạn duyệt."
                : "Tải file Word/PDF hoặc dán phần lý thuyết, AI tự sinh câu hỏi theo yêu cầu."}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={view === "processing"}
            aria-label="Đóng"
            className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--gray-100)] disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 p-5 sm:p-7">
            {view === "select" ? (
              <>
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--gray-100)] p-1">
                  <button
                    type="button"
                    onClick={() => (mode === "smart" || (setMode("smart"), setError("")))}
                    aria-pressed={mode === "smart"}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${mode === "smart" ? "bg-[var(--surface-card)] text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)]"}`}
                  >
                    <ListChecks size={15} /> AI đọc tài liệu, dựng đề
                  </button>
                  <button
                    type="button"
                    onClick={() => (mode === "generate" || (setMode("generate"), setError("")))}
                    aria-pressed={mode === "generate"}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${mode === "generate" ? "bg-[var(--surface-card)] text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)]"}`}
                  >
                    <Wand2 size={15} /> AI soạn câu hỏi mới
                  </button>
                </div>

                {mode === "generate" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="block sm:col-span-1">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Số câu</span>
                        <Input type="number" min={1} max={60} value={count} onChange={(e) => setCount(e.target.value)} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Môn học (không bắt buộc)</span>
                        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="VD: Vật lý 12" />
                      </label>
                    </div>
                    <div>
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Loại câu hỏi</span>
                      <div className="flex flex-wrap gap-2">
                        {TYPE_LABELS.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => toggleType(t.value)}
                            aria-pressed={types.includes(t.value)}
                            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${types.includes(t.value) ? "bg-[var(--primary)] text-white" : "border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--surface-border-strong)]"}`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Yêu cầu riêng (không bắt buộc)</span>
                      <textarea
                        value={customNote}
                        onChange={(e) => setCustomNote(e.target.value)}
                        rows={2}
                        placeholder="VD: ưu tiên câu tính toán, tránh câu hỏi lý thuyết thuần"
                        className="w-full resize-y rounded-xl border border-[var(--surface-border)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      />
                    </label>
                  </>
                ) : (
                  <div className="rounded-2xl bg-[var(--surface-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                    <p className="font-semibold text-[var(--text-primary)]">AI sẽ làm 4 việc:</p>
                    <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[var(--text-muted)]">
                      <li>Đọc tài liệu và dựng lại đúng các câu hỏi có sẵn.</li>
                      <li>Tìm phần đáp án trong tài liệu; không có thì tự giải 2 lượt độc lập rồi đối chiếu.</li>
                      <li>Nếu 2 lượt lệch nhau, AI phân tích lại lần thứ 3 trước khi chốt.</li>
                      <li>Gán độ khó và ý chấm cho câu tự luận để bạn chọn lại trước khi áp dụng.</li>
                    </ol>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void start(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--primary-muted)] bg-[var(--primary-light)] px-5 py-4 text-center hover:border-[var(--primary)] hover:bg-[var(--primary-light)]"
                >
                  <UploadCloud size={24} className="text-[var(--primary)]" />
                  <span className="text-left">
                    <span className="block text-sm font-bold text-[var(--text-primary)]">
                      {mode === "smart" ? "Tải tài liệu đề thi (PDF / Word)" : "Tải file Word / PDF (không bắt buộc)"}
                    </span>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {mode === "smart" ? "Kéo thả file đề vào đây" : "Kéo thả vào đây, hoặc dán nội dung lý thuyết bên dưới"}
                    </span>
                  </span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.currentTarget.value = "";
                    void start(f ?? null);
                  }}
                />

                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-[var(--gray-100)]" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">hoặc dán nội dung</span>
                  <span className="h-px flex-1 bg-[var(--gray-100)]" />
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder={
                    mode === "smart"
                      ? "Dán nội dung đề thi (câu hỏi, lựa chọn A/B/C/D, phần đáp án nếu có)."
                      : "Dán phần lý thuyết bạn muốn AI soạn câu hỏi. Càng rõ ràng, AI càng bám sát kiến thức."
                  }
                  className="w-full resize-y rounded-2xl border border-[var(--surface-border)] px-4 py-3 text-sm leading-relaxed outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
                <Button type="button" onClick={() => void start(null)} className="w-full justify-center gap-2">
                  {mode === "smart" ? <ListChecks size={16} /> : <Sparkles size={16} />}
                  {mode === "smart" ? "Đọc tài liệu và dựng đề" : "Tạo đề từ nội dung đã dán"}
                </Button>
              </>
            ) : null}

            {view === "processing" || view === "error" ? (
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-bg)] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]">
                    {view === "error" ? <X size={24} /> : <Loader2 size={25} className="animate-spin" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[var(--text-primary)]">
                      {view === "error"
                        ? "Xử lý thất bại"
                        : mode === "smart"
                          ? "AI đang đọc tài liệu và dựng đề..."
                          : "AI đang soạn câu hỏi..."}
                    </p>
                    <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{file ? file.name : "Nội dung đã dán"}</p>
                  </div>
                </div>

                {view === "processing" ? (
                  <>
                    <ol className="mt-6 flex flex-col gap-2.5">
                      {stages.map((stage, i) => {
                        const isDone = i < activeIndex;
                        const isActive = i === activeIndex;
                        return (
                          <li
                            key={stage.key}
                            className="flex items-center gap-3 rounded-xl bg-[var(--surface-card)] px-4 py-3 text-sm ring-1 ring-[var(--surface-border)]"
                          >
                            <span
                              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${isDone ? "bg-[var(--mint-light)] text-[var(--mint)]" : isActive ? "bg-[var(--primary)] text-white" : "bg-[var(--gray-200)] text-[var(--text-muted)]"}`}
                            >
                              {isDone ? <Check size={13} /> : isActive ? <Loader2 size={13} className="animate-spin" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                            </span>
                            <span className={`font-medium ${isActive ? "text-[var(--primary)]" : isDone ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}>
                              {stage.label}
                            </span>
                            {isActive && progress.total ? (
                              <span className="ml-auto text-xs font-semibold text-[var(--primary)]">
                                {progress.done ?? 0}/{progress.total}
                              </span>
                            ) : isActive ? (
                              <span className="ml-auto text-xs font-semibold text-[var(--primary)]">đang xử lý</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-muted)] ring-1 ring-[var(--surface-border)]">
                      <Clock3 size={15} className="text-[var(--secondary-dark)]" /> Đã chạy {elapsed}s
                      {mode === "smart" ? (
                        <span>— tài liệu dài và nhiều câu thiếu đáp án sẽ mất vài phút</span>
                      ) : (
                        <span>— đang soạn câu hỏi, có thể mất 1-2 phút</span>
                      )}
                    </div>
                  </>
                ) : null}

                {view === "error" && error ? (
                  <div className="mt-4 rounded-xl border border-[var(--danger-light)] bg-[var(--danger-light)] px-4 py-3 text-sm font-medium text-[var(--danger)]">
                    {error}
                  </div>
                ) : null}

                {view === "error" ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void start(file)}
                      className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                    >
                      <RotateCcw size={15} /> Thử lại
                    </button>
                    <button
                      type="button"
                      onClick={reset}
                      className="flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-bg)]"
                    >
                      <UploadCloud size={15} /> Chọn lại
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {view === "review" ? (
              <>
                <div className="grid gap-3 rounded-2xl bg-[var(--surface-bg)] p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">AI nhận diện</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">
                      {payload?.kind === "theory" ? "Đề lý thuyết / tự luận" : "Đề trắc nghiệm"}
                    </p>
                    <p className="mt-0.5 text-[var(--text-muted)]">
                      {stats.total} câu · {stats.mcq} trắc nghiệm · {stats.theory} tự luận
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Nguồn đáp án</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">
                      {stats.fromDocument} câu lấy từ tài liệu
                      {stats.solvedByAi > 0 ? ` · ${stats.solvedByAi} câu AI tự làm` : ""}
                    </p>
                    <p className="mt-0.5 text-[var(--text-muted)]">
                      {payload?.answerKeyFound
                        ? "Tài liệu có sẵn phần đáp án."
                        : payload?.answerKeyNote || "Không thấy phần đáp án sẵn — AI đã tự làm và đối chiếu."}
                    </p>
                  </div>
                </div>

                {stats.needsReview > 0 ? (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--warning-light)] bg-[var(--warning-light)] px-4 py-3 text-sm text-[var(--warning)]">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                    <p>
                      <span className="font-bold">{stats.needsReview} câu AI không chắc chắn 100%.</span> Hãy kiểm tra lại đáp án trước khi áp dụng.
                    </p>
                  </div>
                ) : stats.solvedByAi > 0 ? (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--mint-light)] bg-[var(--mint-light)] px-4 py-3 text-sm text-[var(--mint)]">
                    <Check size={17} className="mt-0.5 shrink-0" />
                    <p>
                      <span className="font-bold">{stats.solvedByAi} câu thiếu đáp án đã được giải 2 lượt độc lập và đồng thuận.</span> Bạn vẫn nên rà lại trước khi xuất bản.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {reviewed.map((q, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl border p-4 ${q.needsReview ? "border-[var(--warning)] bg-[var(--warning-light)]/40" : "border-[var(--surface-border)] bg-[var(--surface-bg)]"}`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--primary-light)] text-xs font-black text-[var(--primary)]">{i + 1}</span>
                          <span className="rounded-lg bg-[var(--gray-100)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                            {TYPE_NAMES[q.type] ?? TYPE_NAMES.unknown}
                          </span>
                          {q.type === "mcq" ? (
                            <span
                              className={`rounded-lg px-2 py-1 text-xs font-semibold ${q.answerSource === "document" ? "bg-[var(--mint-light)] text-[var(--mint)]" : q.answerSource === "ai" ? "bg-[var(--blue-light)] text-[var(--blue)]" : "bg-[var(--gray-100)] text-[var(--text-muted)]"}`}
                            >
                              {q.answerSource === "document" ? "Đáp án có trong tài liệu" : q.answerSource === "ai" ? "AI tự làm" : "Chưa có đáp án"}
                            </span>
                          ) : null}
                          {q.needsReview ? (
                            <span className="flex items-center gap-1 rounded-lg bg-[var(--warning-light)] px-2 py-1 text-xs font-semibold text-[var(--warning)]">
                              <AlertTriangle size={12} /> Cần kiểm tra
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => setReviewed((list) => list.filter((_, x) => x !== i))}
                          aria-label={`Bỏ câu ${i + 1}`}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--danger-light)] hover:text-[var(--danger)] sm:h-8 sm:w-8"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <p className="text-sm leading-relaxed text-[var(--text-primary)]">{q.question || <span className="text-[var(--danger)]">Câu hỏi rỗng — cần nhập lại</span>}</p>

                      {q.type === "mcq" ? (
                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          {q.options.map((opt, oi) => {
                            const letter = LETTERS[oi];
                            const selected = q.answer === letter;
                            return (
                              <label
                                key={letter}
                                className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 ${selected ? "border-[var(--success)] bg-[var(--success-light)]" : "border-[var(--surface-border)] bg-[var(--surface-card)]"}`}
                              >
                                <input
                                  type="radio"
                                  name={`answer-${i}`}
                                  checked={selected}
                                  onChange={() => patchQuestion(i, { answer: letter, needsReview: false })}
                                  className="sr-only"
                                />
                                <span
                                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${selected ? "bg-[var(--success)] text-white" : "bg-[var(--gray-100)] text-[var(--text-secondary)]"}`}
                                >
                                  {letter}
                                </span>
                                <input
                                  value={opt}
                                  onChange={(e) => setOption(i, oi, e.target.value)}
                                  placeholder={`Nội dung đáp án ${letter}`}
                                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                                />
                              </label>
                            );
                          })}
                        </div>
                      ) : null}

                      {q.rubricPoints?.length ? (
                        <div className="mt-2.5 rounded-xl bg-[var(--surface-card)] p-3 ring-1 ring-[var(--surface-border)]">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ý chấm AI gợi ý</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-[var(--text-secondary)]">
                            {q.rubricPoints.map((r, ri) => (
                              <li key={ri}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {q.type !== "mcq" ? (
                        <label className="mt-2.5 block rounded-xl bg-[var(--surface-card)] p-3 ring-1 ring-[var(--surface-border)]">
                          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Đáp án tham khảo</span>
                          <textarea
                            value={q.answer}
                            onChange={(e) => patchQuestion(i, { answer: e.target.value })}
                            rows={2}
                            placeholder="Nhập đáp án hoặc ý chính để chấm"
                            className="mt-1 w-full resize-y bg-transparent text-sm outline-none"
                          />
                        </label>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--surface-border)] pt-2.5">
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">Độ khó</span>
                        <div className="flex flex-wrap gap-1.5">
                          {DIFFICULTIES.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDifficulty(i, d)}
                              aria-pressed={q.difficulty === d}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${q.difficulty === d ? "bg-[var(--primary)] text-white" : "border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                        {q.solveNote ? <span className="ml-auto text-xs text-[var(--text-muted)]">{q.solveNote}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>

                {reviewed.length === 0 ? (
                  <p className="rounded-2xl bg-[var(--surface-bg)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    Bạn đã bỏ hết câu hỏi. Hãy quay lại và chạy lại AI.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {view === "review" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--surface-border)] bg-[var(--surface-card)] px-5 py-4 sm:px-7">
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-bg)]"
            >
              <RotateCcw size={15} /> Chạy lại
            </button>
            <Button type="button" onClick={apply} disabled={reviewed.length === 0} className="justify-center gap-2">
              <Check size={16} /> Áp dụng {reviewed.filter(isCompleteQuestion).length} câu vào đề
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
