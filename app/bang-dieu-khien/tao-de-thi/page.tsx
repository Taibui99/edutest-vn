"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Eye,
  FileText,
  GripVertical,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { SUBJECTS } from "@/lib/subject";

interface Question {
  question: string;
  options: string[];
  answer: string;
}

type ImportedQuestion = {
  question?: unknown;
  questionText?: unknown;
  options?: unknown;
  answer?: unknown;
};

const DURATION_OPTIONS = [
  { value: "10", label: "10 phút" },
  { value: "15", label: "15 phút" },
  { value: "30", label: "30 phút" },
  { value: "45", label: "45 phút" },
  { value: "60", label: "60 phút" },
  { value: "90", label: "90 phút" },
  { value: "120", label: "120 phút" },
];

function parseGeminiJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function createBlankQuestion(): Question {
  return {
    question: "",
    options: ["", "", "", ""],
    answer: "A",
  };
}

export default function TaoDeThiPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("45");
  const [questions, setQuestions] = useState<Question[]>([createBlankQuestion()]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const missingQuestion = questions.filter((q) => !q.question.trim()).length;
    const missingAnswer = questions.filter((q) => {
      const index = q.answer.charCodeAt(0) - 65;
      return !q.options[index]?.trim();
    }).length;
    const invalidOptions = questions.filter((q) => {
      const options = q.options.map((x) => x.trim()).filter(Boolean);
      return options.length < 2 || new Set(options.map((x) => x.toLowerCase())).size !== options.length;
    }).length;
    return {
      total: questions.length,
      missingQuestion,
      missingAnswer,
      invalidOptions,
      valid: questions.length > 0 && missingQuestion === 0 && missingAnswer === 0 && invalidOptions === 0 && !!title.trim() && !!subject,
    };
  }, [questions, title, subject]);

  const addQuestion = () => {
    setQuestions((current) => [...current, createBlankQuestion()]);
  };

  const updateQuestionText = (index: number, value: string) => {
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, question: value } : q)));
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions((current) =>
      current.map((q, i) => {
        if (i !== questionIndex) return q;
        const options = [...q.options];
        options[optionIndex] = value;
        return { ...q, options };
      }),
    );
  };

  const updateAnswer = (index: number, answer: string) => {
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, answer } : q)));
  };

  const removeQuestion = (index: number) => {
    setQuestions((current) => {
      if (current.length === 1) return [createBlankQuestion()];
      return current.filter((_, i) => i !== index);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/gemini", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể đọc file");

      const parsed = parseGeminiJson(data.result);
      if (parsed.title) setTitle(String(parsed.title));
      if (parsed.questions && Array.isArray(parsed.questions)) {
        const imported: Question[] = parsed.questions.map((raw: ImportedQuestion) => ({
          question: String(raw.question ?? raw.questionText ?? ""),
          options: Array.isArray(raw.options)
            ? raw.options.slice(0, 4).map((option) => String(option).replace(/^[A-D]\.\s*/i, ""))
            : ["", "", "", ""],
          answer: String(raw.answer ?? "A").trim().charAt(0).toUpperCase() || "A",
        }));
        setQuestions(imported.length ? imported : [createBlankQuestion()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đọc file");
    } finally {
      setUploading(false);
    }
  };

  const publishExam = async () => {
    setError("");
    if (!stats.valid) {
      setError("Hãy hoàn thiện tên đề, môn học và toàn bộ câu hỏi trước khi xuất bản.");
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          subject,
          durationMinutes: Number(duration),
          questions: questions.map((q) => ({
            question: q.question.trim(),
            options: q.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option.trim()}`),
            answer: q.answer,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể xuất bản đề");
      router.push(`/bang-dieu-khien?created=${data.exam.joinCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xuất bản đề");
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-full bg-[var(--surface-page)] px-4 py-5 lg:px-7 lg:py-7">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/bang-dieu-khien/de-thi" className="shrink-0">
              <button className="w-9 h-9 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--gray-100)] transition-colors">
                <ArrowLeft size={17} />
              </button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-[var(--text-primary)] truncate">Tạo đề thi</h1>
              <p className="text-xs text-[var(--text-muted)]">Soạn, import và chỉnh sửa ngay trên một màn hình</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className={cn(
              "inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--gray-100)] transition-colors",
              uploading && "opacity-50 pointer-events-none",
            )}>
              {uploading ? <Spinner size="sm" /> : <Upload size={14} />}
              {uploading ? "Đang đọc..." : "Import PDF/Word"}
              <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} className="hidden" disabled={uploading} />
            </label>
            <Button variant="outline" onClick={() => setPreview(true)} icon={<Eye size={15} />}>
              Xem trước
            </Button>
            <Button onClick={publishExam} loading={publishing} disabled={!stats.valid} icon={<Send size={15} />}>
              Xuất bản
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626]">
            <X size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <section className="min-w-0">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] flex items-center justify-center">
                      <FileText size={16} className="text-[var(--primary)]" />
                    </div>
                    <h2 className="text-sm font-black text-[var(--text-primary)]">Khu vực tạo đề thi</h2>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1 ml-10">Nhập câu hỏi, đáp án và chỉnh sửa trực tiếp</p>
                </div>
                <div className="text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">
                  {stats.total} câu
                </div>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {questions.map((q, qi) => (
                  <div key={qi} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--surface-border)] bg-[var(--surface-card)]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <GripVertical size={16} className="text-[var(--text-muted)]" />
                        <span className="w-7 h-7 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center text-xs font-black">
                          {qi + 1}
                        </span>
                        <span className="text-xs font-semibold text-[var(--text-muted)]">Câu hỏi trắc nghiệm</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qi)}
                        className="w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[#EF4444] hover:bg-[#FEF2F2] flex items-center justify-center transition-colors"
                        aria-label={`Xóa câu ${qi + 1}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="p-4">
                      <textarea
                        value={q.question}
                        onChange={(e) => updateQuestionText(qi, e.target.value)}
                        placeholder="Nhập nội dung câu hỏi..."
                        rows={3}
                        className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] resize-y transition-colors"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3">
                        {q.options.map((option, oi) => {
                          const letter = String.fromCharCode(65 + oi);
                          const selected = q.answer === letter;
                          return (
                            <div key={letter} className={cn(
                              "flex items-center gap-2 rounded-xl border p-2.5 transition-colors",
                              selected ? "border-[#22C55E]/50 bg-[#F0FDF4]" : "border-[var(--surface-border)] bg-[var(--surface-card)]",
                            )}>
                              <button
                                type="button"
                                onClick={() => updateAnswer(qi, letter)}
                                className={cn(
                                  "w-7 h-7 rounded-full text-xs font-black shrink-0 transition-colors",
                                  selected ? "bg-[#22C55E] text-white" : "bg-[var(--gray-100)] text-[var(--text-muted)] hover:bg-[var(--gray-200)]",
                                )}
                                aria-label={`Chọn đáp án ${letter}`}
                              >
                                {letter}
                              </button>
                              <input
                                value={option}
                                onChange={(e) => updateOption(qi, oi, e.target.value)}
                                placeholder={`Đáp án ${letter}`}
                                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                              />
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-[var(--text-muted)]">Đáp án đúng: <strong className="text-[#16A34A]">{q.answer}</strong></span>
                        {!q.question.trim() || q.options.filter((x) => x.trim()).length < 2 ? (
                          <span className="text-[11px] font-semibold text-[#F59E0B]">Chưa hoàn thiện</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]"><Check size={12} /> Hợp lệ</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addQuestion}
                  className="w-full rounded-2xl border-2 border-dashed border-[var(--surface-border)] bg-transparent hover:bg-[var(--primary-light)] hover:border-[var(--primary)]/40 p-5 text-sm font-bold text-[var(--primary)] transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={17} /> Thêm câu hỏi
                </button>
              </div>
            </div>
          </section>

          <aside className="xl:sticky xl:top-5 flex flex-col gap-5">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] flex items-center justify-center">
                  <FileText size={16} className="text-[var(--primary)]" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[var(--text-primary)]">Thông tin đề</h2>
                  <p className="text-[11px] text-[var(--text-muted)]">Cấu hình nhanh</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <Input
                  label="Tên đề thi"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Kiểm tra Toán 12"
                />
                <Select
                  label="Môn học"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  options={SUBJECTS.map((s) => ({ value: s, label: s }))}
                  placeholder="Chọn môn học"
                />
                <Select
                  label="Thời gian làm bài"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  options={DURATION_OPTIONS}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-sm p-5">
              <h3 className="text-sm font-black text-[var(--text-primary)] mb-4">Tổng quan</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-[var(--surface-page)] border border-[var(--surface-border)] p-3">
                  <p className="text-[11px] text-[var(--text-muted)]">Số câu</p>
                  <p className="text-lg font-black text-[var(--text-primary)] mt-1">{stats.total}</p>
                </div>
                <div className="rounded-xl bg-[var(--surface-page)] border border-[var(--surface-border)] p-3">
                  <p className="text-[11px] text-[var(--text-muted)]">Thời gian</p>
                  <p className="text-lg font-black text-[var(--text-primary)] mt-1">{duration}p</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between"><span className="text-[var(--text-muted)]">Tên đề</span><span className={title.trim() ? "text-[#16A34A] font-semibold" : "text-[#F59E0B] font-semibold"}>{title.trim() ? "Đã nhập" : "Chưa nhập"}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--text-muted)]">Môn học</span><span className={subject ? "text-[#16A34A] font-semibold" : "text-[#F59E0B] font-semibold"}>{subject || "Chưa chọn"}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--text-muted)]">Câu hoàn chỉnh</span><span className={stats.missingQuestion === 0 && stats.invalidOptions === 0 && stats.missingAnswer === 0 ? "text-[#16A34A] font-semibold" : "text-[#F59E0B] font-semibold"}>{stats.total - stats.missingQuestion - stats.missingAnswer - stats.invalidOptions}/{stats.total}</span></div>
              </div>

              <Button
                className="w-full mt-5"
                onClick={publishExam}
                loading={publishing}
                disabled={!stats.valid}
                icon={<Send size={15} />}
              >
                Xuất bản đề thi
              </Button>
            </div>
          </aside>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between gap-4 sticky top-0 bg-[var(--surface-card)] z-10">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Xem trước như học sinh</p>
                <h2 className="text-lg font-black text-[var(--text-primary)]">{title || "Đề thi chưa đặt tên"}</h2>
              </div>
              <button type="button" onClick={() => setPreview(false)} className="w-9 h-9 rounded-xl bg-[var(--gray-100)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center">
                <X size={17} />
              </button>
            </div>

            <div className="p-5 lg:p-7">
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-5 mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Môn học</p>
                  <p className="font-bold text-[var(--text-primary)]">{subject || "Chưa chọn"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">Thời gian</p>
                  <p className="font-bold text-[var(--text-primary)]">{duration} phút</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {questions.map((q, qi) => (
                  <div key={qi} className="rounded-2xl border border-[var(--surface-border)] p-4">
                    <p className="text-sm font-bold text-[var(--text-primary)] mb-3">
                      <span className="text-[var(--primary)] mr-1.5">Câu {qi + 1}.</span>
                      {q.question || "(Chưa nhập câu hỏi)"}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.options.map((option, oi) => (
                        <div key={oi} className="p-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-page)] text-sm text-[var(--text-secondary)]">
                          <span className="font-black mr-2">{String.fromCharCode(65 + oi)}.</span>
                          {option || "Chưa nhập đáp án"}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
