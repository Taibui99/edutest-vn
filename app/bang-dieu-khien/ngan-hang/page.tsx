"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, BookOpen, Filter, FileText, Plus, ChevronDown, ChevronUp, Pencil, Trash2, X, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { getSubjectColor, SUBJECTS } from "@/lib/subject";

type QuestionType = "mcq" | "true_false" | "short_answer" | "essay";
type Statement = { text: string; answer: boolean };

interface BankItem {
  id: string;
  subject: string;
  type: QuestionType;
  text: string;
  options: string[];
  answer: string;
  grading?: { statements?: Statement[]; acceptedAnswers?: string[] } | null;
  explanation?: string | null;
  points: number;
  createdAt: string;
}

interface ExamQuestion {
  id: string;
  text: string;
  options: string[];
  answer: string;
  explanation?: string;
  points: number;
  order: number;
  createdAt: string;
  exam: { id: string; title: string; subject: string };
}

type FormQ = {
  subject: string;
  type: QuestionType;
  question: string;
  options: string[];
  answer: string;
  statements: Statement[];
  accepted: string[];
  explanation: string;
};

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Trắc nghiệm",
  true_false: "Đúng / Sai",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
};
const TYPE_OPTIONS = (Object.keys(TYPE_LABELS) as QuestionType[]).map((value) => ({ value, label: TYPE_LABELS[value] }));

function blankForm(type: QuestionType): FormQ {
  return {
    subject: "",
    type,
    question: "",
    options: type === "mcq" ? ["", "", "", ""] : [],
    answer: type === "mcq" ? "A" : "",
    statements: type === "true_false" ? [{ text: "", answer: true }] : [],
    accepted: type === "short_answer" ? [""] : [],
    explanation: "",
  };
}

function itemToForm(item: BankItem): FormQ {
  return {
    subject: item.subject,
    type: item.type,
    question: item.text,
    options: item.options.length ? [...item.options] : ["", "", "", ""],
    answer: item.answer || "A",
    statements: item.grading?.statements?.length ? item.grading.statements.map((s) => ({ ...s })) : [{ text: "", answer: true }],
    accepted: item.grading?.acceptedAnswers?.length ? item.grading.acceptedAnswers.map(String) : [""],
    explanation: item.explanation || "",
  };
}

export default function QuestionBankPage() {
  const [tab, setTab] = useState<"mine" | "exams">("mine");
  const [bank, setBank] = useState<BankItem[]>([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<BankItem | null>(null);
  const [form, setForm] = useState<FormQ>(blankForm("mcq"));

  const fetchBank = useCallback(async () => {
    setBankLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (subject) params.set("subject", subject);
    const res = await fetch(`/api/question-bank?${params}`);
    const data = await res.json();
    setBank(Array.isArray(data) ? data : []);
    setBankLoading(false);
  }, [search, subject]);

  const fetchExamQuestions = useCallback(async () => {
    setQLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (subject) params.set("subject", subject);
    const res = await fetch(`/api/questions?${params}`);
    const data = await res.json();
    setQuestions(Array.isArray(data) ? data : []);
    setQLoading(false);
  }, [search, subject]);

  useEffect(() => {
    const t = setTimeout(fetchBank, 300);
    return () => clearTimeout(t);
  }, [fetchBank]);

  useEffect(() => {
    const t = setTimeout(fetchExamQuestions, 300);
    return () => clearTimeout(t);
  }, [fetchExamQuestions]);

  const grouped = useMemo(() => questions.reduce<Record<string, ExamQuestion[]>>((acc, q) => {
    if (!acc[q.exam.subject]) acc[q.exam.subject] = [];
    acc[q.exam.subject].push(q);
    return acc;
  }, {}), [questions]);

  const openCreate = (type: QuestionType = "mcq") => {
    setEditing(null);
    setForm(blankForm(type));
    setFormError("");
    setModal(true);
  };

  const openEdit = (item: BankItem) => {
    setEditing(item);
    setForm(itemToForm(item));
    setFormError("");
    setModal(true);
  };

  const save = async () => {
    setFormError("");
    if (!form.subject.trim()) return setFormError("Chọn môn học");
    if (!form.question.trim()) return setFormError("Nhập nội dung câu hỏi");
    if (form.type === "mcq" && form.options.filter((o) => o.trim()).length < 2) return setFormError("Trắc nghiệm cần ít nhất 2 đáp án");
    if (form.type === "mcq" && !form.options[form.answer.charCodeAt(0) - 65]?.trim()) return setFormError("Đáp án đúng chưa có nội dung");
    if (form.type === "true_false" && form.statements.some((s) => !s.text.trim())) return setFormError("Mỗi mệnh đề cần nội dung");
    if (form.type === "short_answer" && !form.accepted.some((a) => a.trim())) return setFormError("Cần ít nhất một đáp án chấp nhận");

    setSaving(true);
    const questionPayload = {
      type: form.type,
      question: form.question.trim(),
      options: form.type === "mcq" ? form.options.map((o) => o.trim()) : [],
      answer: form.type === "mcq" ? form.answer : "",
      grading: form.type === "true_false"
        ? { statements: form.statements }
        : form.type === "short_answer"
          ? { acceptedAnswers: form.accepted.filter((a) => a.trim()) }
          : undefined,
    };
    try {
      let res;
      if (editing) {
        res = await fetch(`/api/question-bank/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: form.subject.trim(), explanation: form.explanation || undefined, questions: [questionPayload] }),
        });
      } else {
        res = await fetch("/api/question-bank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: form.subject.trim(), explanation: form.explanation || undefined, questions: [questionPayload] }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu câu hỏi");
      setModal(false);
      await fetchBank();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Không thể lưu câu hỏi");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: BankItem) => {
    if (!window.confirm("Xoá câu hỏi này khỏi kho?")) return;
    const res = await fetch(`/api/question-bank/${item.id}`, { method: "DELETE" });
    if (res.ok) await fetchBank();
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <BookOpen size={20} className="text-[var(--primary)]" />
            Ngân hàng câu hỏi
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {tab === "mine" ? `${bank.length} câu hỏi trong kho` : `${questions.length} câu hỏi từ ${Object.keys(grouped).length} đề thi`}
          </p>
        </div>
        <Button onClick={() => openCreate()} icon={<Plus size={16} />}>Thêm câu hỏi</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Tìm kiếm câu hỏi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search size={15} />}
          />
        </div>
        <div className="relative">
          <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] appearance-none min-w-[160px]"
          >
            <option value="">Tất cả môn</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1.5 mb-6 rounded-xl bg-[var(--gray-100)] p-1 w-fit">
        {([["mine", "Kho của tôi"], ["exams", "Trong đề thi"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === key ? "bg-white text-[var(--primary)] shadow-sm dark:bg-[#46309F] dark:text-white" : "text-[var(--text-muted)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        bankLoading ? (
          <div className="flex items-center justify-center py-24"><Spinner /></div>
        ) : bank.length === 0 ? (
          <Card className="py-16">
            <EmptyState
              icon={<BookOpen />}
              title="Kho câu hỏi còn trống"
              description="Tạo câu hỏi riêng để dùng lại cho nhiều đề thi"
              action={<Button onClick={() => openCreate()} icon={<Plus size={16} />}>Thêm câu hỏi</Button>}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {bank.map((item) => {
              const c = getSubjectColor(item.subject);
              return (
                <Card key={item.id} padding="none">
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center mt-0.5" style={{ background: c.bg, color: c.text }}>
                        <BookOpen size={13} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: c.bg, color: c.text }}>{item.subject}</span>
                          <span className="text-[11px] font-semibold text-[var(--text-muted)]">{TYPE_LABELS[item.type]}</span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)] leading-relaxed">{item.text}</p>

                        {item.type === "mcq" && item.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5">
                            {item.options.map((opt, idx) => {
                              const letter = String.fromCharCode(65 + idx);
                              const isCorrect = item.answer === letter;
                              return (
                                <div key={letter} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${isCorrect ? "bg-[#E8F7F1] text-[#064E3B] font-semibold" : "bg-[var(--gray-100)] text-[var(--text-secondary)]"}`}>
                                  <span className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${isCorrect ? "bg-[#189A6C] text-white" : "bg-[var(--gray-200)] text-[var(--text-muted)]"}`}>{letter}</span>
                                  {opt}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {item.type === "true_false" && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {(item.grading?.statements || []).map((s, i) => (
                              <span key={i} className={`rounded-md px-2 py-0.5 text-xs ${s.answer ? "bg-[#E8F7F1] text-[#064E3B]" : "bg-[#FFECEC] text-[#9B1C1C]"}`}>
                                {String.fromCharCode(97 + i)}) {s.text} — {s.answer ? "Đúng" : "Sai"}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.type === "short_answer" && (
                          <div className="mt-2 text-xs text-[var(--text-muted)]">
                            Đáp án: <span className="font-semibold text-[var(--text-secondary)]">{(item.grading?.acceptedAnswers || []).join(", ") || "—"}</span>
                          </div>
                        )}
                        {item.type === "essay" && <div className="mt-2 text-xs text-amber-600 font-semibold">Tự luận — chấm thủ công</div>}
                        {item.explanation && (
                          <div className="mt-2 flex gap-2 p-2.5 bg-[var(--primary-light)] rounded-lg">
                            <Lightbulb size={13} className="text-[var(--primary)] shrink-0" />
                            <p className="text-xs text-[var(--text-secondary)]">{item.explanation}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1 ml-2">
                        <button onClick={() => openEdit(item)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-[var(--gray-100)] hover:text-[var(--primary)]"><Pencil size={14} /></button>
                        <button onClick={() => remove(item)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        qLoading ? (
          <div className="flex items-center justify-center py-24"><Spinner /></div>
        ) : questions.length === 0 ? (
          <Card className="py-16">
            <EmptyState icon={<BookOpen />} title="Không tìm thấy câu hỏi nào" description="Câu hỏi sẽ xuất hiện sau khi bạn tạo đề thi." />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([subj, qs]) => {
              const c = getSubjectColor(subj);
              return (
                <Card key={subj} padding="none">
                  <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-[var(--gray-100)] transition-colors rounded-t-2xl" onClick={() => setExpanded(expanded === subj ? null : subj)}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: c.bg }}><BookOpen size={14} style={{ color: c.text }} /></div>
                      <div>
                        <span className="font-black text-[var(--text-primary)]">{subj}</span>
                        <span className="ml-2 text-xs text-[var(--text-muted)]">{qs.length} câu</span>
                      </div>
                    </div>
                    {expanded === subj ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
                  </div>
                  {expanded === subj && (
                    <div className="divide-y divide-[var(--surface-border)] border-t border-[var(--surface-border)]">
                      {qs.map((q) => (
                        <div key={q.id} className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center mt-0.5" style={{ background: c.bg, color: c.text }}><FileText size={12} /></span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">{q.text}</p>
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <FileText size={11} className="text-[var(--text-muted)]" />
                                <span className="text-xs text-[var(--text-muted)]">Từ đề: <span className="font-semibold">{q.exam.title}</span></span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}

      {modal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{editing ? "Chỉnh sửa" : "Câu hỏi mới"}</p>
                <h2 className="text-xl font-black">{editing ? "Sửa câu hỏi" : "Thêm vào ngân hàng"}</h2>
              </div>
              <button onClick={() => setModal(false)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100"><X size={17} /></button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">Môn học</span>
                  <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-xl border border-[var(--surface-border)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)]">
                    <option value="">Chọn môn</option>
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">Loại câu hỏi</span>
                  <select value={form.type} onChange={(e) => { const t = e.target.value as QuestionType; setForm((f) => ({ ...blankForm(t), subject: f.subject, explanation: f.explanation })); }} className="w-full rounded-xl border border-[var(--surface-border)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)]">
                    {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Nội dung câu hỏi</span>
                <textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows={3} placeholder="Nhập nội dung câu hỏi..." className="w-full rounded-xl border border-[var(--surface-border)] p-3 text-sm outline-none focus:border-[var(--primary)]" />
              </label>

              {form.type === "mcq" && (
                <div className="grid gap-2 md:grid-cols-2">
                  {form.options.map((opt, oi) => {
                    const letter = String.fromCharCode(65 + oi);
                    const selected = form.answer === letter;
                    return (
                      <div key={letter} className={`flex items-center gap-2 rounded-xl border p-2.5 ${selected ? "border-emerald-300 bg-emerald-50" : "border-[var(--surface-border)]"}`}>
                        <button type="button" onClick={() => setForm({ ...form, answer: letter })} className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${selected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>{letter}</button>
                        <input value={opt} onChange={(e) => { const options = [...form.options]; options[oi] = e.target.value; setForm({ ...form, options }); }} placeholder={`Đáp án ${letter}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                      </div>
                    );
                  })}
                </div>
              )}

              {form.type === "true_false" && (
                <div className="flex flex-col gap-2">
                  {form.statements.map((s, si) => (
                    <div key={si} className="flex gap-2 rounded-xl border border-[var(--surface-border)] p-2.5">
                      <input value={s.text} onChange={(e) => { const statements = [...form.statements]; statements[si] = { ...statements[si], text: e.target.value }; setForm({ ...form, statements }); }} placeholder={`Mệnh đề ${si + 1}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                      <select value={String(s.answer)} onChange={(e) => { const statements = [...form.statements]; statements[si] = { ...statements[si], answer: e.target.value === "true" }; setForm({ ...form, statements }); }} className="rounded-lg border px-2 text-sm">
                        <option value="true">Đúng</option>
                        <option value="false">Sai</option>
                      </select>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setForm({ ...form, statements: [...form.statements, { text: "", answer: true }] })}>+ Thêm mệnh đề</Button>
                </div>
              )}

              {form.type === "short_answer" && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">Đáp án chấp nhận</p>
                  {form.accepted.map((a, ai) => (
                    <div key={ai} className="mb-2 flex gap-2">
                      <input value={a} onChange={(e) => { const arr = [...form.accepted]; arr[ai] = e.target.value; setForm({ ...form, accepted: arr }); }} placeholder="Ví dụ: 42 hoặc 42.0" className="flex-1 rounded-xl border p-2.5 text-sm" />
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setForm({ ...form, accepted: [...form.accepted, ""] })}>+ Thêm đáp án</Button>
                </div>
              )}

              {form.type === "essay" && <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Câu tự luận sẽ được giáo viên chấm thủ công.</div>}

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Giải thích (tùy chọn)</span>
                <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} placeholder="Giải thích đáp án..." className="w-full rounded-xl border border-[var(--surface-border)] p-3 text-sm outline-none focus:border-[var(--primary)]" />
              </label>

              {formError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{formError}</div>}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setModal(false)}>Hủy</Button>
                <Button onClick={save} loading={saving}>{editing ? "Lưu thay đổi" : "Thêm vào kho"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}