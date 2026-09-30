"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock3, FileUp, Loader2, RotateCcw, Sparkles, UploadCloud, Wand2, X } from "lucide-react";
import { importExamFile, type GenerateOptions, type ImportStage } from "@/lib/import-exam";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type View = "select" | "processing" | "done" | "error";
type ImportedPayload = { title?: unknown; questions?: unknown[] };

const STAGES: { key: ImportStage; label: string }[] = [
  { key: "upload", label: "Tải file lên" },
  { key: "extract", label: "Đọc nội dung" },
  { key: "analyze", label: "AI đang phân tích" },
  { key: "check", label: "Kiểm tra câu hỏi" },
  { key: "done", label: "Hoàn tất" },
];

const TYPE_LABELS: { value: string; label: string }[] = [
  { value: "mcq", label: "Trắc nghiệm 4 đáp án" },
  { value: "true_false", label: "Đúng / Sai" },
  { value: "short_answer", label: "Trả lời ngắn" },
];

function parseResult(result: string): ImportedPayload {
  const cleaned = result.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as ImportedPayload;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.questions)) {
    throw new Error("AI trả về dữ liệu không hợp lệ");
  }
  return parsed;
}

export function ImportExamModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (parsed: ImportedPayload) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("select");
  const [mode, setMode] = useState<"extract" | "generate">("generate");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [count, setCount] = useState("10");
  const [subject, setSubject] = useState("");
  const [types, setTypes] = useState<string[]>(["mcq"]);
  const [customNote, setCustomNote] = useState("");
  const [activeStage, setActiveStage] = useState<ImportStage | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const reset = () => {
    setView("select"); setFile(null); setText(""); setActiveStage(null); setElapsed(0); setError("");
  };
  const close = () => { reset(); onClose(); };

  useEffect(() => {
    if (!open || view !== "processing") return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [open, view]);

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
    } else if (!next) {
      setError("Vui lòng chọn file PDF hoặc Word (.docx).");
      setView("error");
      return;
    }

    if (next && !/\.(pdf|docx)$/i.test(next.name)) {
      setError("Chỉ hỗ trợ PDF hoặc Word (.docx).");
      setView("error");
      return;
    }
    setFile(next); setActiveStage("upload"); setElapsed(0); setView("processing");
    try {
      const options: GenerateOptions = { count: Number(count), subject: subject.trim() || undefined, types, customNote: customNote.trim() || undefined, withExplanation: false };
      const { result } = await importExamFile(next, (s) => setActiveStage(s), { mode, options, text });
      const parsed = parseResult(result);
      if (parsed.questions.length === 0) throw new Error("AI không tạo được câu hỏi nào. Thử thêm nội dung hoặc đổi yêu cầu.");
      setActiveStage("done");
      setView("done");
      window.setTimeout(() => { onSuccess(parsed); close(); }, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : (mode === "generate" ? "Không thể soạn đề." : "Không thể import đề."));
      setActiveStage(null);
      setView("error");
    }
  };

  const stageIndex = (key: ImportStage) => STAGES.findIndex((s) => s.key === key);
  const activeIndex = activeStage ? stageIndex(activeStage) : -1;
  const toggleType = (value: string) =>
    setTypes((prev) => (prev.includes(value) ? (prev.length > 1 ? prev.filter((t) => t !== value) : prev) : [...prev, value]));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70/45 px-4 py-4 backdrop-blur-[3px] sm:py-6">
      <div role="dialog" aria-modal="true" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/70 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--surface-border)] bg-white px-5 py-4 sm:px-7">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--primary)]"><FileUp size={17} /> Tạo đề bằng AI</div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Soạn đề thi từ tài liệu</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Tải file Word/PDF hoặc dán phần lý thuyết, AI tự sinh câu hỏi theo yêu cầu.</p>
          </div>
          <button type="button" onClick={close} disabled={view === "processing"} className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--gray-100)] disabled:opacity-40"><X size={20} /></button>
        </div>

        <div className="space-y-4 p-5 sm:p-7">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--gray-100)] p-1">
            <button type="button" onClick={() => mode === "extract" || (setMode("extract"), setError(""))}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${mode === "extract" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)]"}`}>
              <FileUp size={15} /> Trích câu hỏi có sẵn
            </button>
            <button type="button" onClick={() => mode === "generate" || (setMode("generate"), setError(""))}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${mode === "generate" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)]"}`}>
              <Wand2 size={15} /> AI soạn câu hỏi mới
            </button>
          </div>

          {view === "select" ? (
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
                    <button key={t.value} type="button" onClick={() => toggleType(t.value)}
                      className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${types.includes(t.value) ? "bg-[var(--primary)] text-white" : "border border-[var(--surface-border)] bg-white text-[var(--text-secondary)] hover:border-[var(--surface-border-strong)]"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Yêu cầu riêng (không bắt buộc)</span>
                <textarea value={customNote} onChange={(e) => setCustomNote(e.target.value)} rows={2}
                  placeholder="VD: ưu tiên câu tính toán, tránh câu hỏi lý thuyết thuần"
                  className="w-full resize-y rounded-xl border border-[var(--surface-border)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </label>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void start(e.dataTransfer.files?.[0] ?? null); }}
                className="group flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 px-5 py-4 text-center hover:border-violet-400 hover:bg-violet-50"
              >
                <UploadCloud size={24} className="text-[var(--primary)]" />
                <span className="text-left">
                  <span className="block text-sm font-bold text-[var(--text-primary)]">Tải file Word / PDF (không bắt buộc)</span>
                  <span className="block text-xs text-[var(--text-muted)]">Kéo thả vào đây, hoặc dán nội dung lý thuyết bên dưới</span>
                </span>
              </button>
              <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; void start(f ?? null); }} />

              {mode === "generate" ? (
                <>
                  <div className="flex items-center gap-3"><span className="h-px flex-1 bg-[var(--gray-100)]" /><span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">hoặc dán nội dung</span><span className="h-px flex-1 bg-[var(--gray-100)]" /></div>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
                    placeholder="Dán phần lý thuyết bạn muốn AI soạn câu hỏi. Càng rõ ràng, AI càng bám sát kiến thức."
                    className="w-full resize-y rounded-2xl border border-[var(--surface-border)] px-4 py-3 text-sm leading-relaxed outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]" />
                  <Button type="button" onClick={() => void start(null)} className="w-full justify-center gap-2">
                    <Sparkles size={16} /> Tạo đề từ nội dung đã dán
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => inputRef.current?.click()} className="w-full justify-center gap-2">
                  <UploadCloud size={16} /> Chọn file để trích câu hỏi
                </Button>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-bg)] p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-[var(--primary)]">
                  {view === "done" ? <Check size={25} /> : view === "error" ? <X size={24} /> : <Loader2 size={25} className="animate-spin" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[var(--text-primary)]">
                    {view === "processing" ? (mode === "generate" ? "AI đang soạn câu hỏi..." : "Đang xử lý đề...") : view === "done" ? "Đã tạo xong câu hỏi" : "Tạo đề thất bại"}
                  </p>
                  <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{file ? file.name : "Nội dung đã dán"}</p>
                </div>
              </div>

              {view === "processing" || view === "done" ? (
                <ol className="mt-6 flex flex-col gap-2.5">
                  {STAGES.map((stage, i) => {
                    const isDone = view === "done" || i < activeIndex;
                    const isActive = view !== "done" && i === activeIndex;
                    return (
                      <li key={stage.key} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-[var(--surface-border)]">
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${isDone ? "bg-[var(--mint-light)] text-[var(--mint)]" : isActive ? "bg-[var(--primary)] text-white" : "bg-[var(--gray-200)] text-[var(--text-muted)]"}`}>
                          {isDone ? <Check size={13} /> : isActive ? <Loader2 size={13} className="animate-spin" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                        </span>
                        <span className={`font-medium ${isActive ? "text-[var(--primary)]" : isDone ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}>{stage.label}</span>
                        {isActive && <span className="ml-auto text-xs font-semibold text-[var(--primary)]">đang xử lý</span>}
                        {isDone && view === "done" && <span className="ml-auto text-xs font-semibold text-[var(--mint)]">hoàn tất</span>}
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              {view === "processing" && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-[var(--text-muted)] ring-1 ring-[var(--surface-border)]">
                  <Clock3 size={15} className="text-violet-500" /> Đã chạy {elapsed}s
                  {mode === "generate" && <span>— đang soạn câu hỏi, có thể mất 1-2 phút</span>}
                </div>
              )}

              {view === "error" && error && (
                <div className="mt-4 rounded-xl border border-[var(--danger-light)] bg-[var(--danger-light)] px-4 py-3 text-sm font-medium text-[var(--danger)]">{error}</div>
              )}

              {view === "error" && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void start(file)}
                    className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                    <RotateCcw size={15} /> Thử lại
                  </button>
                  <button type="button" onClick={reset}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-bg)]">
                    <UploadCloud size={15} /> Chọn lại
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
