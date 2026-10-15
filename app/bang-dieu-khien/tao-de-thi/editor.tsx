"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, FileText, Image as ImageIcon, Plus, Save, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dropdown } from "@/components/ui/dropdown";
import { NumberInput } from "@/components/ui/number-input";
import { DateField } from "@/components/ui/date-field";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import { SUBJECTS } from "@/lib/subject";
import { PROCTOR_MODES, PROCTOR_MODE_DESCRIPTIONS, proctorModeLabel, type ProctorMode } from "@/lib/integrity";
import { ImportExamModal } from "@/components/exams/import-exam-modal";

type QuestionType = "mcq" | "true_false" | "short_answer" | "essay";
type Statement = { text: string; answer: boolean };
type Difficulty = "nhận biết" | "thông hiểu" | "vận dụng";
const DIFFICULTIES: Difficulty[] = ["nhận biết", "thông hiểu", "vận dụng"];
const DEFAULT_DIFFICULTY: Difficulty = "nhận biết";
/** Metadata AI sinh ra, lưu trong grading (không cần migration DB). */
type Grading = {
  statements?: Statement[];
  acceptedAnswers?: string[];
  difficulty?: Difficulty;
  rubricPoints?: string[];
  /** IMG-1 — URL ảnh minh hoạ cho câu hỏi (Supabase Storage công khai). */
  image?: string;
};
interface Question { type: QuestionType; question: string; options: string[]; answer: string; grading?: Grading; points: number }

type ImportedQuestion = {
  type?: QuestionType;
  question?: unknown;
  questionText?: unknown;
  options?: unknown;
  answer?: unknown;
  grading?: Grading;
  difficulty?: unknown;
  rubricPoints?: unknown;
  points?: unknown;
};
type DbQuestion = { type: string; text: string; options: string[]; answer: string; grading: unknown; points: number };

function normalizeDifficulty(value: unknown): Difficulty | null {
  const s = String(value ?? "").trim().toLowerCase();
  return DIFFICULTIES.find((d) => d === s) ?? null;
}

/** Giữ metadata độ khó/rubric do AI gợi ý khi nhập hoặc khi mở đề đã lưu. */
function withAiMetadata(q: Question, source: { grading?: Grading | null; difficulty?: unknown; rubricPoints?: unknown }): Question {
  const fromGrading = (source.grading ?? {}) as Grading;
  const rubric = Array.isArray(source.rubricPoints)
    ? source.rubricPoints.map(String).filter(Boolean)
    : Array.isArray(fromGrading.rubricPoints)
      ? fromGrading.rubricPoints.filter(Boolean)
      : [];
  const difficulty = normalizeDifficulty(source.difficulty) ?? normalizeDifficulty(fromGrading.difficulty);
  // IMG-1 — giữ ảnh minh hoạ khi mở lại đề đã lưu hoặc khi import.
  const image = typeof fromGrading.image === "string" && fromGrading.image ? fromGrading.image : undefined;
  if (!image && !difficulty && rubric.length === 0) return q;
  q.grading = {
    ...(q.grading ?? {}),
    ...(image ? { image } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(rubric.length ? { rubricPoints: rubric } : {}),
  };
  return q;
}

const TYPE_OPTIONS = [
  { value: "mcq", label: "Trắc nghiệm" },
  { value: "true_false", label: "Đúng / Sai" },
  { value: "short_answer", label: "Trả lời ngắn" },
  { value: "essay", label: "Tự luận" },
];
const DURATION_OPTIONS = ["10","15","30","45","60","90","120"].map((value) => ({ value, label: `${value} phút` }));

function blankQuestion(type: QuestionType = "mcq"): Question {
  if (type === "true_false") return { type, question: "", options: [], answer: "", grading: { statements: [{ text: "", answer: true }] }, points: 1 };
  if (type === "short_answer") return { type, question: "", options: [], answer: "", grading: { acceptedAnswers: [""] }, points: 1 };
  return { type, question: "", options: type === "mcq" ? ["","","",""] : [], answer: type === "mcq" ? "A" : "", points: 1 };
}

function importedToQuestion(raw: ImportedQuestion): Question {
  const type = ["mcq","true_false","short_answer","essay"].includes(raw.type || "") ? (raw.type as QuestionType) : "mcq";
  const q: Question = blankQuestion(type);
  q.question = String(raw.question ?? raw.questionText ?? "");
  q.points = Number(raw.points) > 0 ? Number(raw.points) : 1;
  if (type === "mcq") {
    q.options = Array.isArray(raw.options) ? raw.options.slice(0,4).map(String).map((x) => x.replace(/^[A-D]\.\s*/i, "")) : ["","","",""];
    q.answer = String(raw.answer ?? "A").trim().charAt(0).toUpperCase() || "A";
  } else if (type === "true_false") {
    const statements = (raw.grading as { statements?: Statement[] } | undefined)?.statements;
    q.grading = { statements: Array.isArray(statements) && statements.length ? statements : [{ text: "", answer: true }] };
  } else if (type === "short_answer") {
    const acceptedAnswers = (raw.grading as { acceptedAnswers?: string[] } | undefined)?.acceptedAnswers;
    q.grading = { acceptedAnswers: Array.isArray(acceptedAnswers) && acceptedAnswers.length ? acceptedAnswers.map(String) : [String(raw.answer ?? "")] };
  }
  return withAiMetadata(q, raw);
}

/** IMG-1 — thu nhỏ ảnh lớn trước khi tải lên (điện thoại hay chụp 3-6 MB).
 *  Ảnh ≤ 3.5 MB giữ nguyên; ảnh lớn hơn được vẽ lại tối đa 1600px cạnh dài,
 *  nén JPEG 0.85 để luôn nằm dưới ngưỡng 4 MB của API. */
async function downscaleImage(file: File): Promise<File> {
  if (file.size <= 3.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function dbToQuestion(raw: DbQuestion): Question {
  const type = ["mcq","true_false","short_answer","essay"].includes(raw.type) ? (raw.type as QuestionType) : "mcq";
  if (type === "true_false") {
    const statements = (raw.grading as { statements?: Statement[] } | null | undefined)?.statements;
    return withAiMetadata({ type, question: raw.text, options: [], answer: raw.answer || "", grading: { statements: Array.isArray(statements) && statements.length ? statements : [{ text: "", answer: true }] }, points: raw.points }, { grading: raw.grading as Grading | null });
  }
  if (type === "short_answer") {
    const acceptedAnswers = (raw.grading as { acceptedAnswers?: string[] } | null | undefined)?.acceptedAnswers;
    return withAiMetadata({ type, question: raw.text, options: [], answer: raw.answer || "", grading: { acceptedAnswers: Array.isArray(acceptedAnswers) && acceptedAnswers.length ? acceptedAnswers.map(String) : [raw.answer || ""] }, points: raw.points }, { grading: raw.grading as Grading | null });
  }
  if (type === "essay") {
    return withAiMetadata({ type, question: raw.text, options: [], answer: raw.answer || "", points: raw.points }, { grading: raw.grading as Grading | null });
  }
  return withAiMetadata({ type, question: raw.text, options: Array.isArray(raw.options) && raw.options.length ? raw.options : ["","","",""], answer: (raw.answer || "A").charAt(0).toUpperCase() || "A", points: raw.points }, { grading: raw.grading as Grading | null });
}

export interface InitialExam {
  title: string;
  subject: string;
  description: string | null;
  durationMinutes: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  allowGuestAttempts: boolean;
  maxAttempts: number;
  showAnswers: boolean;
  showScoreImmediately: boolean;
  proctorMode: string;
  openAt: string | null;
  closeAt: string | null;
  status: string;
  questions: DbQuestion[];
}

export function TaoDeThiEditor({ editId, initialExam }: { editId: string | null; initialExam: InitialExam | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialExam?.title ?? "");
  const [subject, setSubject] = useState(initialExam?.subject ?? "");
  const [description, setDescription] = useState(initialExam?.description ?? "");
  const [duration, setDuration] = useState(String(initialExam?.durationMinutes ?? 45));
  const [shuffleQuestions, setShuffleQuestions] = useState(initialExam?.shuffleQuestions ?? false);
  const [shuffleAnswers, setShuffleAnswers] = useState(initialExam?.shuffleAnswers ?? false);
  const [allowGuest, setAllowGuest] = useState(initialExam?.allowGuestAttempts ?? true);
  const [maxAttempts, setMaxAttempts] = useState(initialExam?.maxAttempts ?? 1);
  // EXAM-1b — nhớ giá trị hữu hạn gần nhất để bật/tắt "vô hạn" không mất số cũ.
  const lastFiniteAttempts = useRef(maxAttempts > 0 ? maxAttempts : 1);
  const handleMaxAttempts = (v: number) => { if (v > 0) lastFiniteAttempts.current = v; setMaxAttempts(v); };
  const [showAnswers, setShowAnswers] = useState(initialExam?.showAnswers ?? true);
  const [showScore, setShowScore] = useState(initialExam?.showScoreImmediately ?? true);
  const [proctorMode, setProctorMode] = useState<ProctorMode>(() => {
    const m = initialExam?.proctorMode ?? "";
    return (PROCTOR_MODES as readonly string[]).includes(m) ? (m as ProctorMode) : "off";
  });
  // ISO (UTC) -> giá trị `datetime-local` theo GIỜ ĐỊA PHƯƠNG của máy.
  // Trước đây cắt thẳng `iso.slice(0,16)` nên ô nhập hiện giờ UTC
  // (vd 07:25 VN -> "00:25" = 12:25 SA). Editor là client-only (ssr:false).
  const toInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const [openAt, setOpenAt] = useState(toInput(initialExam?.openAt ?? null));
  const [closeAt, setCloseAt] = useState(toInput(initialExam?.closeAt ?? null));
  const [questions, setQuestions] = useState<Question[]>(() => (initialExam?.questions.length ? initialExam.questions.map(dbToQuestion) : [blankQuestion()]));
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  // IMG-1 — câu đang tải ảnh lên (để hiện trạng thái "Đang tải ảnh…").
  const [uploadingImg, setUploadingImg] = useState<number | null>(null);
  const currentStatus = initialExam?.status === "draft" ? "draft" : "published";
  const backHref = editId ? `/bang-dieu-khien/de-thi/${editId}` : "/bang-dieu-khien/de-thi";

  const stats = useMemo(() => {
    const errors = questions.filter((q) => {
      if (!q.question.trim()) return true;
      if (q.type === "mcq") return q.options.filter((x) => x.trim()).length < 2 || !q.options["ABCD".indexOf(q.answer)]?.trim();
      if (q.type === "true_false") return !(q.grading?.statements?.length) || q.grading.statements.some((s) => !s.text.trim());
      if (q.type === "short_answer") return !(q.grading?.acceptedAnswers?.filter((x) => x.trim()).length);
      return false;
    }).length;
    return { total: questions.length, errors, valid: !!title.trim() && !!subject && errors === 0 };
  }, [questions, title, subject]);

  const updateQuestion = (index: number, patch: Partial<Question>) => setQuestions((all) => all.map((q, i) => i === index ? { ...q, ...patch } : q));
  const changeType = (index: number, type: QuestionType) => updateQuestion(index, blankQuestion(type));
  const addQuestion = (type: QuestionType = "mcq") => setQuestions((all) => [...all, blankQuestion(type)]);
  const removeQuestion = (index: number) => setQuestions((all) => all.length === 1 ? [blankQuestion()] : all.filter((_, i) => i !== index));

  const setQuestionImage = (index: number, image: string | undefined) =>
    setQuestions((all) => all.map((q, i) => (i === index ? { ...q, grading: { ...q.grading, image } } : q)));

  const handleImage = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setError("");
    setUploadingImg(index);
    try {
      const prepared = await downscaleImage(file);
      const fd = new FormData();
      fd.append("file", prepared);
      const res = await fetch("/api/uploads/question-image", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Không tải được ảnh");
      setQuestionImage(index, data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ảnh");
    } finally {
      setUploadingImg(null);
    }
  };

  const applyImported = (parsed: { title?: unknown; questions?: unknown[] }) => {
    if (parsed.title) setTitle(String(parsed.title));
    if (Array.isArray(parsed.questions)) setQuestions(parsed.questions.map(importedToQuestion));
  };

  const saveExam = async (requestedStatus?: "published" | "draft") => {
    setError("");
    if (!stats.valid) { setError("Hãy hoàn thiện tên đề, môn học và các câu hỏi trước khi lưu."); return; }
    setPublishing(true);
    const status = requestedStatus ?? currentStatus;
    const payload = { title: title.trim(), subject, description: description.trim() || undefined, durationMinutes: Number(duration), shuffleQuestions, shuffleAnswers, allowGuestAttempts: allowGuest, maxAttempts, showAnswers, showScoreImmediately: showScore, proctorMode, openAt: openAt ? new Date(openAt).toISOString() : null, closeAt: closeAt ? new Date(closeAt).toISOString() : null, status, questions };
    try {
      const res = editId
        ? await fetch(`/api/exams/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu đề");
      if (editId) {
        router.push(status === "draft" ? "/bang-dieu-khien/de-thi" : `/bang-dieu-khien/de-thi/${editId}`);
      } else {
        router.push(status === "draft" ? "/bang-dieu-khien/de-thi" : `/bang-dieu-khien?created=${data.exam.joinCode}`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể lưu đề"); setPublishing(false); }
  };

  return (
    <div className="min-h-full bg-[var(--surface-bg)] px-4 py-5 lg:px-7 lg:py-7">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Link href={backHref}><button className="grid h-10 sm:h-9 w-10 sm:w-9 place-items-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)]"><ArrowLeft size={17}/></button></Link><div><h1 className="text-[22px] font-black tracking-tight text-[var(--text-primary)]">{editId ? "Sửa đề thi" : "Tạo đề thi"}</h1><p className="text-xs text-[var(--text-muted)]">{editId ? "Chỉnh sửa nội dung và cấu hình, sau đó lưu thay đổi" : "Soạn, import, cấu hình và xuất bản trên một màn hình"}</p></div></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setImportOpen(true)}>Import PDF/Word</Button><Button variant="outline" onClick={() => setQuestions([blankQuestion()])}>Đề mới</Button><Button variant="outline" onClick={() => setPreview(true)} icon={<Eye size={15}/>}>Xem trước</Button>{editId ? <Button onClick={() => saveExam()} loading={publishing} disabled={!stats.valid} icon={<Save size={15}/>}>Lưu thay đổi</Button> : <><Button variant="outline" onClick={() => saveExam("draft")} loading={publishing} disabled={!stats.valid} icon={<Save size={15}/>}>Lưu nháp</Button><Button onClick={() => saveExam("published")} loading={publishing} disabled={!stats.valid} icon={<Send size={15}/>}>Xuất bản</Button></>}</div>
        </div>
        {error && <div className="mb-5 rounded-xl border border-[var(--danger-light)] bg-[var(--danger-light)] p-3 text-sm text-[var(--danger)]">{error}</div>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-4"><div className="flex items-center gap-2"><FileText size={17} className="text-[var(--primary)]"/><div><h2 className="text-sm font-black text-[var(--text-primary)]">Câu hỏi</h2><p className="text-xs text-[var(--text-muted)]">{stats.total} câu · {stats.errors ? `${stats.errors} lỗi cần sửa` : "Đã kiểm tra"}</p></div></div><Button size="sm" variant="outline" onClick={() => addQuestion() } icon={<Plus size={14}/>}>Thêm câu</Button></div>
            <div className="flex flex-col gap-4 p-5">
              {questions.map((q, i) => (
                <div key={i} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-bg)] p-4 transition-colors focus-within:border-[var(--primary)]/50 focus-within:shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--primary-light)] text-xs font-black text-[var(--primary)]">{i+1}</span><Select value={q.type} onChange={(v) => changeType(i, v as QuestionType)} options={TYPE_OPTIONS} ariaLabel="Loại câu hỏi"/></div><div className="flex shrink-0 items-center gap-2"><span className="text-[11px] font-bold text-[var(--text-muted)]">Điểm</span><NumberInput value={q.points} onChange={(v)=>updateQuestion(i,{points:v})} min={0.25} max={20} step={0.25} className="w-40"/><button title="Xóa câu" onClick={() => removeQuestion(i)} className="grid h-10 sm:h-8 w-10 sm:w-8 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--danger-light)] hover:text-[var(--danger)]"><Trash2 size={15}/></button></div></div>
                  <textarea value={q.question} onChange={(e) => updateQuestion(i,{question:e.target.value})} rows={3} placeholder="Nhập nội dung câu hỏi..." className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-3 text-sm outline-none"/>

                  <div className="mt-3">
                    {q.grading?.image ? (
                      <div className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={q.grading.image} alt="Ảnh minh hoạ câu hỏi" className="max-h-40 rounded-xl border border-[var(--surface-border)] bg-white" />
                        <button type="button" title="Xóa ảnh" onClick={() => setQuestionImage(i, undefined)} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-[var(--danger)] text-white shadow"><X size={13}/></button>
                      </div>
                    ) : (
                      <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--surface-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]", uploadingImg === i && "pointer-events-none opacity-60")}>
                        <ImageIcon size={14}/> {uploadingImg === i ? "Đang tải ảnh…" : "Thêm ảnh"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(i, e)} />
                      </label>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Độ khó</span>
                    <div className="flex flex-wrap gap-1.5">
                      {DIFFICULTIES.map((d) => (
                        <button key={d} type="button" onClick={() => updateQuestion(i,{grading:{...q.grading, difficulty: d}})}
                          aria-pressed={(q.grading?.difficulty ?? DEFAULT_DIFFICULTY) === d}
                          className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", (q.grading?.difficulty ?? DEFAULT_DIFFICULTY) === d ? "bg-[var(--primary)] text-white" : "border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--surface-border-strong)]")}>
                          {d}
                        </button>
                      ))}
                    </div>
                    {q.grading?.rubricPoints?.length ? <span className="rounded-lg bg-[var(--gray-100)] px-2.5 py-1.5 text-xs text-[var(--text-muted)]">{q.grading.rubricPoints.length} ý chấm gợi ý</span> : null}
                  </div>

                  {q.type === "mcq" && <div className="mt-3 grid gap-2 md:grid-cols-2">{q.options.map((opt, oi) => { const letter=String.fromCharCode(65+oi); const selected=q.answer===letter; return <div key={letter} className={cn("flex items-center gap-2 rounded-xl border p-3 sm:p-2.5", selected ? "border-[var(--success)] bg-[var(--success-light)]" : "border-[var(--surface-border)] bg-[var(--surface-card)]")}><button onClick={()=>updateQuestion(i,{answer:letter})} className={cn("grid h-10 sm:h-7 w-10 sm:w-7 place-items-center rounded-full text-xs font-black",selected?"bg-[var(--success)] text-white":"bg-[var(--gray-100)] text-[var(--text-secondary)]")}>{letter}</button><input value={opt} onChange={(e)=>{const options=[...q.options]; options[oi]=e.target.value; updateQuestion(i,{options});}} placeholder={`Đáp án ${letter}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></div>;})}</div>}

                  {q.type === "true_false" && <div className="mt-3 flex flex-col gap-2">{(q.grading?.statements || [{text:"",answer:true}]).map((s,si)=><div key={si} className="flex gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-2.5"><input value={s.text} onChange={(e)=>{const statements=[...(q.grading?.statements||[])]; statements[si]={...statements[si],text:e.target.value}; updateQuestion(i,{grading:{...q.grading,statements}})}} placeholder={`Mệnh đề ${si+1}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none"/><Dropdown value={String(s.answer)} onChange={(v)=>{const statements=[...(q.grading?.statements||[])]; statements[si]={...statements[si],answer:v==="true"}; updateQuestion(i,{grading:{...q.grading,statements}})}} options={[{value:"true",label:"Đúng"},{value:"false",label:"Sai"}]} size="sm" className="w-28 shrink-0" ariaLabel={`Đáp án mệnh đề ${si+1}`}/></div>)}<Button size="sm" variant="outline" onClick={()=>updateQuestion(i,{grading:{...q.grading,statements:[...(q.grading?.statements||[]),{text:"",answer:true}]}})}>+ Thêm mệnh đề</Button></div>}

                  {q.type === "short_answer" && <div className="mt-3"><p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Đáp án chấp nhận</p>{(q.grading?.acceptedAnswers||[""]).map((a,ai)=><div key={ai} className="mb-2 flex gap-2"><input value={a} onChange={(e)=>{const arr=[...(q.grading?.acceptedAnswers||[])]; arr[ai]=e.target.value; updateQuestion(i,{grading:{...q.grading,acceptedAnswers:arr}})}} placeholder="Ví dụ: 42 hoặc 42.0" className="flex-1 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-2.5 text-sm outline-none focus:border-[var(--primary)]"/></div>)}<Button size="sm" variant="outline" onClick={()=>updateQuestion(i,{grading:{...q.grading,acceptedAnswers:[...(q.grading?.acceptedAnswers||[]),""]}})}>+ Thêm đáp án</Button></div>}

                  {q.type === "essay" && <div className="mt-3 rounded-xl bg-[var(--warning-light)] p-3 text-xs text-[var(--warning)]">Câu tự luận sẽ được giáo viên chấm thủ công.</div>}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => addQuestion()} icon={<Plus size={14}/>} className="mt-3 w-full">Thêm câu hỏi mới</Button>
            </div>
          </section>

<aside className="flex flex-col gap-5 xl:sticky xl:top-5 xl:self-start">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-5 shadow-sm"><h3 className="mb-4 text-sm font-black">Thông tin đề</h3><div className="flex flex-col gap-4"><Input label="Tên đề thi" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="VD: Kiểm tra chương 1"/><Select label="Môn học" value={subject} onChange={(v)=>setSubject(v)} options={SUBJECTS.map((s)=>({value:s,label:s}))} placeholder="Chọn môn học"/><Input label="Mô tả / hướng dẫn" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Hướng dẫn ngắn cho học sinh"/><Select label="Thời gian" value={duration} onChange={(v)=>setDuration(v)} options={DURATION_OPTIONS}/>{maxAttempts > 0 ? <NumberInput label="Số lần làm tối đa" value={maxAttempts} onChange={handleMaxAttempts} min={1} max={20} hint="Học sinh có thể làm lại tối đa số lần này" /> : <div className="flex flex-col gap-1.5"><span className="text-sm font-medium text-[var(--text-secondary)]">Số lần làm tối đa</span><div className="h-11 sm:h-9 flex items-center rounded-lg border border-dashed border-[var(--surface-border)] bg-[var(--surface-input)] px-3 text-sm font-semibold text-[var(--primary)]">Không giới hạn</div><p className="text-xs text-[var(--text-muted)]">Học sinh được làm lại bao nhiêu lần cũng được</p></div>}<div className="flex items-center justify-between gap-3"><span className="text-sm text-[var(--text-secondary)]">Không giới hạn lượt làm</span><Checkbox checked={maxAttempts <= 0} onChange={(v) => setMaxAttempts(v ? 0 : (lastFiniteAttempts.current || 1))} /></div></div><div className="mt-4 border-t pt-4 flex flex-col gap-3"><p className="text-xs font-bold text-[var(--text-secondary)]">Lịch mở / đóng đề (bỏ trống = luôn mở)</p><DateField label="Mở đề" value={openAt} onChange={(e)=>setOpenAt(e.target.value)}/><DateField label="Đóng đề" value={closeAt} onChange={(e)=>setCloseAt(e.target.value)}/></div></div>
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-5 shadow-sm"><h3 className="mb-4 text-sm font-black">Cấu hình bài thi</h3><div className="mb-4"><Select label="Chống gian lận khi thi" value={proctorMode} onChange={(v)=>setProctorMode(v as typeof proctorMode)} options={PROCTOR_MODES.map((m)=>({value:m,label:proctorModeLabel(m)}))}/><p className="mt-2 text-xs text-[var(--text-muted)]">{PROCTOR_MODE_DESCRIPTIONS[proctorMode]}</p></div><div className="flex flex-col gap-3 text-sm">{[{ value: shuffleQuestions, label: "Trộn câu hỏi", setter: setShuffleQuestions },{ value: shuffleAnswers, label: "Trộn đáp án", setter: setShuffleAnswers },{ value: allowGuest, label: "Cho phép khách làm bài", setter: setAllowGuest },{ value: showAnswers, label: "Cho xem đáp án sau khi nộp", setter: setShowAnswers },{ value: showScore, label: "Hiển thị điểm ngay sau khi nộp", setter: setShowScore }].map((c) => <div key={c.label} className="flex items-center justify-between gap-3"><span className="text-[var(--text-secondary)]">{c.label}</span><Checkbox checked={c.value} onChange={c.setter}/></div>)}</div><div className="mt-4 border-t pt-4 text-xs text-[var(--text-muted)]"><div className="flex justify-between py-1"><span>Số câu</span><strong>{stats.total}</strong></div><div className="flex justify-between py-1"><span>Lỗi cần sửa</span><strong className={stats.errors?"text-[var(--danger)]":"text-[var(--success)]"}>{stats.errors}</strong></div></div></div>
          </aside>
        </div>
      </div>

      <ImportExamModal open={importOpen} onClose={()=>setImportOpen(false)} onSuccess={applyImported}/>
      {preview && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"><div className="mx-auto max-w-4xl rounded-2xl bg-[var(--surface-card)] p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs text-[var(--text-secondary)]">Xem trước</p><h2 className="text-xl font-black">{title || "Đề thi mới"}</h2></div><button onClick={()=>setPreview(false)} className="grid h-10 sm:h-9 w-10 sm:w-9 place-items-center rounded-lg bg-[var(--gray-100)]"><X size={17}/></button></div><div className="flex flex-col gap-4">{questions.map((q,i)=><div key={i} className="rounded-xl border p-4">{q.grading?.image&&(<>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={q.grading.image} alt="Ảnh minh hoạ" className="mb-3 max-h-64 rounded-lg border border-[var(--surface-border)]"/>
</>)}<p className="mb-3 font-semibold">Câu {i+1}. {q.question}</p>{q.type==="mcq"&&q.options.map((o,oi)=><div key={oi} className="mb-1 rounded-lg border p-2 text-sm">{String.fromCharCode(65+oi)}. {o}</div>)}{q.type==="true_false"&&(q.grading?.statements||[]).map((s,si)=><div key={si} className="mb-1 flex justify-between rounded-lg border p-2 text-sm"><span>{String.fromCharCode(97+si)}) {s.text}</span><strong>{s.answer?"Đúng":"Sai"}</strong></div>)}{q.type==="short_answer"&&<div className="rounded-lg border bg-[var(--gray-100)] p-3 text-sm">Ô trả lời ngắn</div>}{q.type==="essay"&&<div className="min-h-28 rounded-lg border bg-[var(--gray-100)] p-3 text-sm">Ô trả lời tự luận</div>}</div>)}</div></div></div>}
    </div>
  );
}
