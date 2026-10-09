"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { importExamFile, type ImportMode, type ImportStage } from "@/lib/import-exam";
import {
  isCompleteQuestion,
  parseImportResult,
  toReviewItem,
} from "@/components/exams/import-exam-modal";
import { cn } from "@/lib/cn";

/* AI-6b — Soạn đề từ tài liệu ngay trong chat (chỉ giáo viên).
 *
 * Tái dùng đúng pipeline của modal import (`importExamFile`) và đúng logic
 * parse (`parseImportResult`/`toReviewItem`), khác mỗi bước cuối: thay vì đổ
 * vào editor, tạo BẢN NHÁP qua POST /api/exams rồi đưa link
 * `tao-de-thi?edit=<id>` để giáo viên duyệt/xuất bản. Giữ nguyên tắc AI-4:
 * không auto-publish; câu AI chưa chắc (needsReview) phải báo rõ số lượng.
 */

const STAGE_LABEL: Record<ImportStage, string> = {
  upload: "Đang tải tài liệu lên",
  extract: "Đang đọc nội dung tài liệu",
  analyze: "AI đang dựng đề và nhận diện đáp án",
  solve: "AI đang tự làm các câu thiếu đáp án",
  check: "Đang đối chiếu và kiểm tra",
  done: "Hoàn tất",
};

const ALL_TYPES = [
  { value: "mcq", label: "Trắc nghiệm" },
  { value: "true_false", label: "Đúng/Sai" },
  { value: "short_answer", label: "Trả lời ngắn" },
  { value: "essay", label: "Tự luận" },
];

type Done = { examId: string; title: string; total: number; needsReview: number };

export function ExamBuilder({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<ImportMode>("smart");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<string[]>(["mcq"]);
  const [duration, setDuration] = useState(45);
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleType = (v: string) =>
    setTypes((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]));

  const start = async () => {
    setError(null);
    setDone(null);
    if (mode === "smart" && !file && !text.trim()) {
      setError("Hãy đính kèm file tài liệu hoặc dán nội dung vào ô bên dưới.");
      return;
    }
    if (!subject.trim()) {
      setError("Nhập môn học để AI đặt tên đề và phân loại cho đúng.");
      return;
    }
    const n = Math.min(50, Math.max(1, Math.floor(count) || 10));
    setRunning(true);
    try {
      const { result, meta } = await importExamFile(
        mode === "smart" ? file : null,
        (s, p) =>
          setStage(
            p?.total ? `${STAGE_LABEL[s]} (${p.done ?? 0}/${p.total})` : STAGE_LABEL[s],
          ),
        {
          mode,
          text: text.trim() || undefined,
          options: {
            subject: subject.trim(),
            count: n,
            types: types.length ? types : ["mcq"],
            customNote: note.trim() || undefined,
          },
        },
      );
      const parsed = parseImportResult(result);
      const usable = (parsed.questions ?? []).map(toReviewItem).filter(isCompleteQuestion);
      if (!usable.length) throw new Error("AI không dựng được câu nào hoàn chỉnh. Thử rút gọn tài liệu hoặc đổi yêu cầu.");
      const needsReview = usable.filter((q) => q.needsReview).length;

      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: parsed.title ? String(parsed.title) : `Đề AI soạn — ${subject.trim()}`,
          subject: subject.trim(),
          durationMinutes: Math.min(300, Math.max(5, Math.floor(duration) || 45)),
          questions: usable,
          status: "draft",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.exam?.id) {
        throw new Error(typeof data?.error === "string" ? data.error : "Không lưu được bản nháp");
      }
      setDone({
        examId: String(data.exam.id),
        title: String(data.exam.title ?? "Đề AI soạn"),
        total: usable.length,
        needsReview,
      });
      void meta;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Soạn đề thất bại. Thử lại sau nhé!");
    } finally {
      setRunning(false);
      setStage("");
    }
  };

  return (
    <div className="mx-4 mb-3 rounded-3xl border border-[var(--primary)]/25 bg-[var(--surface-card)] shadow-[0_16px_40px_-20px_rgba(15,76,129,0.4)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--surface-border)] px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-black tracking-tight text-[var(--text-primary)]">
          <Sparkles size={15} className="text-[var(--primary)]" />
          Soạn đề từ tài liệu
        </p>
        <button
          onClick={onClose}
          disabled={running}
          className="grid h-9 w-9 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--gray-100)] disabled:opacity-40"
          aria-label="Đóng panel soạn đề"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--gray-100)] p-1">
          {(
            [
              { v: "smart", label: "Dựng từ tài liệu" },
              { v: "generate", label: "Soạn mới theo yêu cầu" },
            ] as const
          ).map((m) => (
            <button
              key={m.v}
              onClick={() => setMode(m.v)}
              disabled={running}
              className={cn(
                "rounded-xl px-3 py-2 text-[13px] font-bold transition",
                mode === m.v
                  ? "bg-[var(--surface-card)] text-[var(--primary)] shadow-sm"
                  : "text-[var(--text-muted)]",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "smart" && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={running}
              className="flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[var(--surface-border-strong)] px-4 py-3.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
            >
              <FileUp size={16} />
              {file ? file.name : "Đính kèm Word / PDF / TXT"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".docx,.pdf,.txt,.md"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={running}
              rows={3}
              placeholder="Hoặc dán nội dung lý thuyết vào đây…"
              className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-input)] p-3 text-sm outline-none focus:border-[var(--primary)]"
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Môn học *</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={running}
              placeholder="VD: Vật lý 12"
              className="h-11 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 text-sm outline-none focus:border-[var(--primary)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Số câu</span>
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={running}
                className="h-11 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 text-sm outline-none focus:border-[var(--primary)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">Phút</span>
              <input
                type="number"
                min={5}
                max={300}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={running}
                className="h-11 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 text-sm outline-none focus:border-[var(--primary)]"
              />
            </label>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-bold text-[var(--text-secondary)]">Loại câu</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => toggleType(t.value)}
                disabled={running}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-bold transition",
                  types.includes(t.value)
                    ? "bg-[var(--primary)] text-white"
                    : "border border-[var(--surface-border)] text-[var(--text-secondary)]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
            Yêu cầu riêng {mode === "generate" ? "" : "(không bắt buộc)"}
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={running}
            placeholder="VD: 40% nhận biết, 40% thông hiểu, 20% vận dụng"
            className="h-11 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 text-sm outline-none focus:border-[var(--primary)]"
          />
        </label>

        {error && (
          <p className="flex items-start gap-2 rounded-xl bg-[var(--danger-light)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--danger)]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        {done ? (
          <div className="rounded-2xl bg-[var(--success-light)] p-4">
            <p className="flex items-center gap-2 text-sm font-black text-[var(--success-dark)]">
              <CheckCircle2 size={16} /> Đã soạn xong bản nháp
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {done.title} — {done.total} câu
              {done.needsReview > 0 && (
                <> · <strong className="text-[var(--warning)]">{done.needsReview} câu AI chưa chắc</strong>, nhớ duyệt trước khi xuất bản</>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/bang-dieu-khien/tao-de-thi?edit=${done.examId}`}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white transition-all hover:bg-[var(--primary-hover)] active:scale-[0.98]"
              >
                Mở trình soạn để duyệt <ArrowRight size={15} />
              </Link>
              <button
                onClick={() => { setDone(null); setFile(null); setText(""); }}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--surface-border)] px-3.5 text-sm font-bold text-[var(--text-secondary)]"
              >
                <RotateCcw size={14} /> Đề khác
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={start}
            disabled={running}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgba(15,76,129,0.55)] transition-all hover:bg-[var(--primary-hover)] active:scale-[0.98] disabled:opacity-60"
          >
            {running ? (
              <>
                <Loader2 size={16} className="animate-spin" /> {stage || "Đang bắt đầu…"}
              </>
            ) : (
              <>
                <Sparkles size={16} /> {mode === "smart" ? "AI dựng đề" : "AI soạn đề"}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
