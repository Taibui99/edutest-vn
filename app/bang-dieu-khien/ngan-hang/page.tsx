"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, BookOpen, Filter, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { getSubjectColor, SUBJECTS } from "@/lib/subject";

interface Question {
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

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (subject) params.set("subject", subject);
    const res = await fetch(`/api/questions?${params}`);
    const data = await res.json();
    setQuestions(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [search, subject]);

  useEffect(() => {
    const t = setTimeout(fetchQuestions, 300);
    return () => clearTimeout(t);
  }, [fetchQuestions]);

  const grouped = questions.reduce<Record<string, Question[]>>((acc, q) => {
    const subj = q.exam.subject;
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(q);
    return acc;
  }, {});

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
          <BookOpen size={20} className="text-[var(--primary)]" />
          Ngân hàng câu hỏi
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          {questions.length} câu hỏi từ {Object.keys(grouped).length} môn
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
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

      {loading ? (
        <div className="flex items-center justify-center py-24"><Spinner /></div>
      ) : questions.length === 0 ? (
        <Card className="py-16">
          <EmptyState
            icon={<BookOpen />}
            title="Không tìm thấy câu hỏi nào"
            description="Câu hỏi sẽ xuất hiện sau khi bạn tạo đề thi."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([subj, qs]) => {
            const c = getSubjectColor(subj);
            return (
              <Card key={subj} padding="none">
                {/* Subject header */}
                <div
                  className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-[var(--gray-100)] transition-colors rounded-t-2xl"
                  onClick={() => setExpanded(expanded === subj ? null : subj)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
                      <BookOpen size={14} style={{ color: c.text }} />
                    </div>
                    <div>
                      <span className="font-black text-[var(--text-primary)]">{subj}</span>
                      <span className="ml-2 text-xs text-[var(--text-muted)]">{qs.length} câu</span>
                    </div>
                  </div>
                  {expanded === subj
                    ? <ChevronUp size={16} className="text-[var(--text-muted)]" />
                    : <ChevronDown size={16} className="text-[var(--text-muted)]" />
                  }
                </div>

                {/* Questions list */}
                {expanded === subj && (
                  <div className="divide-y divide-[var(--surface-border)] border-t border-[var(--surface-border)]">
                    {qs.map((q, i) => (
                      <div key={q.id} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span
                            className="shrink-0 w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center mt-0.5"
                            style={{ background: c.bg, color: c.text }}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                              {q.text}
                            </p>

                            {/* Options */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5">
                              {q.options.map((opt, idx) => {
                                const letter = String.fromCharCode(65 + idx);
                                const isCorrect = q.answer === letter;
                                return (
                                  <div
                                    key={letter}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                                      isCorrect
                                        ? "bg-[#E1F5EE] text-[#064E3B] font-semibold"
                                        : "bg-[var(--gray-100)] text-[var(--text-secondary)]"
                                    }`}
                                  >
                                    <span className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                                      isCorrect ? "bg-[#06D6A0] text-white" : "bg-[var(--gray-200)] text-[var(--text-muted)]"
                                    }`}>
                                      {letter}
                                    </span>
                                    {opt}
                                  </div>
                                );
                              })}
                            </div>

                            {q.explanation && (
                              <div className="mt-2 flex gap-2 p-2.5 bg-[var(--primary-light)] rounded-lg">
                                <span className="text-[var(--primary)] text-xs shrink-0 font-bold">💡</span>
                                <p className="text-xs text-[var(--text-secondary)]">{q.explanation}</p>
                              </div>
                            )}

                            {/* Source exam */}
                            <div className="mt-2 flex items-center gap-1.5">
                              <FileText size={11} className="text-[var(--text-muted)]" />
                              <span className="text-xs text-[var(--text-muted)]">
                                Từ đề: <span className="font-semibold">{q.exam.title}</span>
                              </span>
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
      )}
    </div>
  );
}
