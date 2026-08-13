"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, FileText, Plus, Save, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { SUBJECTS } from "@/lib/subject";
import { ImportExamModal } from "@/components/exams/import-exam-modal";

type QuestionType = "mcq" | "true_false" | "short_answer" | "essay";
type Statement = { text: string; answer: boolean };
interface Question { type: QuestionType; question: string; options: string[]; answer: string; grading?: { statements?: Statement[]; acceptedAnswers?: string[] }; points: number }

type ImportedQuestion = { type?: QuestionType; question?: unknown; questionText?: unknown; options?: unknown; answer?: unknown; grading?: unknown; points?: unknown };
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
  return q;
}

export default function TaoDeThiPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("45");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [allowGuest, setAllowGuest] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [showAnswers, setShowAnswers] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([blankQuestion()]);
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

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

  const handleImport = async (file: File) => {
    const form = new FormData(); form.append("file", file);
    const res = await fetch("/api/gemini", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Không thể import đề");
    let parsed: { title?: unknown; questions?: unknown[] };
    try { parsed = JSON.parse(String(data.result).replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); } catch { throw new Error("AI trả về dữ liệu không hợp lệ"); }
    if (parsed.title) setTitle(String(parsed.title));
    if (Array.isArray(parsed.questions)) setQuestions(parsed.questions.map(importedToQuestion));
  };

  const publishExam = async (status: "published" | "draft" = "published") => {
    setError("");
    if (!stats.valid) { setError("Hãy hoàn thiện tên đề, môn học và các câu hỏi trước khi xuất bản."); return; }
    setPublishing(true);
    try {
      const res = await fetch("/api/exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), subject, description: description.trim() || undefined, durationMinutes: Number(duration), shuffleQuestions, shuffleAnswers, allowGuestAttempts: allowGuest, maxAttempts: Number(maxAttempts), showAnswers, status, questions }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể xuất bản đề");
      if (status === "draft") {
        router.push("/bang-dieu-khien/de-thi");
      } else {
        router.push(`/bang-dieu-khien?created=${data.exam.joinCode}`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể xuất bản đề"); setPublishing(false); }
  };

  return (
    <div className="min-h-full bg-[var(--surface-page)] px-4 py-5 lg:px-7 lg:py-7">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Link href="/bang-dieu-khien/de-thi"><button className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)]"><ArrowLeft size={17}/></button></Link><div><h1 className="text-xl font-black text-[var(--text-primary)]">Tạo đề thi</h1><p className="text-xs text-[var(--text-muted)]">Soạn, import, cấu hình và xuất bản trên một màn hình</p></div></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setImportOpen(true)}>Import PDF/Word</Button><Button variant="outline" onClick={() => setQuestions([blankQuestion()])}>Đề mới</Button><Button variant="outline" onClick={() => setPreview(true)} icon={<Eye size={15}/>}>Xem trước</Button><Button variant="outline" onClick={() => publishExam("draft")} loading={publishing} disabled={!stats.valid} icon={<Save size={15}/>}>Lưu nháp</Button><Button onClick={() => publishExam("published")} loading={publishing} disabled={!stats.valid} icon={<Send size={15}/>}>Xuất bản</Button></div>
        </div>
        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-4"><div className="flex items-center gap-2"><FileText size={17} className="text-[var(--primary)]"/><div><h2 className="text-sm font-black text-[var(--text-primary)]">Câu hỏi</h2><p className="text-xs text-[var(--text-muted)]">{stats.total} câu · {stats.errors ? `${stats.errors} lỗi cần sửa` : "Đã kiểm tra"}</p></div></div><Button size="sm" variant="outline" onClick={() => addQuestion() } icon={<Plus size={14}/>}>Thêm câu</Button></div>
            <div className="flex flex-col gap-4 p-5">
              {questions.map((q, i) => (
                <div key={i} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--primary-light)] text-xs font-black text-[var(--primary)]">{i+1}</span><Select value={q.type} onChange={(e) => changeType(i, e.target.value as QuestionType)} options={TYPE_OPTIONS}/></div><button onClick={() => removeQuestion(i)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={15}/></button></div>
                  <textarea value={q.question} onChange={(e) => updateQuestion(i,{question:e.target.value})} rows={3} placeholder="Nhập nội dung câu hỏi..." className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-3 text-sm outline-none"/>

                  {q.type === "mcq" && <div className="mt-3 grid gap-2 md:grid-cols-2">{q.options.map((opt, oi) => { const letter=String.fromCharCode(65+oi); const selected=q.answer===letter; return <div key={letter} className={cn("flex items-center gap-2 rounded-xl border p-2.5", selected ? "border-emerald-300 bg-emerald-50" : "border-[var(--surface-border)] bg-[var(--surface-card)]")}><button onClick={()=>updateQuestion(i,{answer:letter})} className={cn("grid h-7 w-7 place-items-center rounded-full text-xs font-black",selected?"bg-emerald-500 text-white":"bg-slate-100 text-slate-500")}>{letter}</button><input value={opt} onChange={(e)=>{const options=[...q.options]; options[oi]=e.target.value; updateQuestion(i,{options});}} placeholder={`Đáp án ${letter}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></div>;})}</div>}

                  {q.type === "true_false" && <div className="mt-3 flex flex-col gap-2">{(q.grading?.statements || [{text:"",answer:true}]).map((s,si)=><div key={si} className="flex gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-2.5"><input value={s.text} onChange={(e)=>{const statements=[...(q.grading?.statements||[])]; statements[si]={...statements[si],text:e.target.value}; updateQuestion(i,{grading:{...q.grading,statements}})}} placeholder={`Mệnh đề ${si+1}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none"/><select value={String(s.answer)} onChange={(e)=>{const statements=[...(q.grading?.statements||[])]; statements[si]={...statements[si],answer:e.target.value==="true"}; updateQuestion(i,{grading:{...q.grading,statements}})}} className="rounded-lg border px-2 text-sm"><option value="true">Đúng</option><option value="false">Sai</option></select></div>)}<Button size="sm" variant="outline" onClick={()=>updateQuestion(i,{grading:{...q.grading,statements:[...(q.grading?.statements||[]),{text:"",answer:true}]}})}>+ Thêm mệnh đề</Button></div>}

                  {q.type === "short_answer" && <div className="mt-3"><p className="mb-2 text-xs font-semibold text-slate-500">Đáp án chấp nhận</p>{(q.grading?.acceptedAnswers||[""]).map((a,ai)=><div key={ai} className="mb-2 flex gap-2"><input value={a} onChange={(e)=>{const arr=[...(q.grading?.acceptedAnswers||[])]; arr[ai]=e.target.value; updateQuestion(i,{grading:{...q.grading,acceptedAnswers:arr}})}} placeholder="Ví dụ: 42 hoặc 42.0" className="flex-1 rounded-xl border p-2.5 text-sm"/></div>)}<Button size="sm" variant="outline" onClick={()=>updateQuestion(i,{grading:{...q.grading,acceptedAnswers:[...(q.grading?.acceptedAnswers||[]),""]}})}>+ Thêm đáp án</Button></div>}

                  {q.type === "essay" && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Câu tự luận sẽ được giáo viên chấm thủ công.</div>}
                </div>
              ))}
            </div>
          </section>

          <aside className="flex flex-col gap-5 xl:sticky xl:top-5 xl:self-start">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-5 shadow-sm"><h3 className="mb-4 text-sm font-black">Thông tin đề</h3><div className="flex flex-col gap-4"><Input label="Tên đề thi" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="VD: Kiểm tra chương 1"/><Select label="Môn học" value={subject} onChange={(e)=>setSubject(e.target.value)} options={SUBJECTS.map((s)=>({value:s,label:s}))} placeholder="Chọn môn học"/><Input label="Mô tả / hướng dẫn" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Hướng dẫn ngắn cho học sinh"/><Select label="Thời gian" value={duration} onChange={(e)=>setDuration(e.target.value)} options={DURATION_OPTIONS}/><Input label="Số lần làm tối đa" type="number" min={1} value={maxAttempts} onChange={(e)=>setMaxAttempts(e.target.value)}/></div></div>
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-5 shadow-sm"><h3 className="mb-4 text-sm font-black">Cấu hình bài thi</h3><div className="flex flex-col gap-3 text-sm">{[[shuffleQuestions,"Trộn câu hỏi",setShuffleQuestions],[shuffleAnswers,"Trộn đáp án",setShuffleAnswers],[allowGuest,"Cho phép khách làm bài",setAllowGuest],[showAnswers,"Cho xem đáp án sau khi nộp",setShowAnswers]].map(([value,label,setter])=>label && setter ? <label key={String(label)} className="flex items-center justify-between gap-3"><span className="text-slate-600">{String(label)}</span><input type="checkbox" checked={Boolean(value)} onChange={(e)=>(setter as (v: boolean) => void)(e.target.checked)}/></label> : null)}</div><div className="mt-4 border-t pt-4 text-xs text-slate-500"><div className="flex justify-between py-1"><span>Số câu</span><strong>{stats.total}</strong></div><div className="flex justify-between py-1"><span>Lỗi cần sửa</span><strong className={stats.errors?"text-red-500":"text-emerald-600"}>{stats.errors}</strong></div></div></div>
          </aside>
        </div>
      </div>

      <ImportExamModal open={importOpen} onClose={()=>setImportOpen(false)} onImport={handleImport}/>
      {preview && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"><div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs text-slate-500">Xem trước</p><h2 className="text-xl font-black">{title || "Đề thi mới"}</h2></div><button onClick={()=>setPreview(false)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100"><X size={17}/></button></div><div className="flex flex-col gap-4">{questions.map((q,i)=><div key={i} className="rounded-xl border p-4"><p className="mb-3 font-semibold">Câu {i+1}. {q.question}</p>{q.type==="mcq"&&q.options.map((o,oi)=><div key={oi} className="mb-1 rounded-lg border p-2 text-sm">{String.fromCharCode(65+oi)}. {o}</div>)}{q.type==="true_false"&&(q.grading?.statements||[]).map((s,si)=><div key={si} className="mb-1 flex justify-between rounded-lg border p-2 text-sm"><span>{String.fromCharCode(97+si)}) {s.text}</span><strong>{s.answer?"Đúng":"Sai"}</strong></div>)}{q.type==="short_answer"&&<div className="rounded-lg border bg-slate-50 p-3 text-sm">Ô trả lời ngắn</div>}{q.type==="essay"&&<div className="min-h-28 rounded-lg border bg-slate-50 p-3 text-sm">Ô trả lời tự luận</div>}</div>)}</div></div></div>}
    </div>
  );
}
