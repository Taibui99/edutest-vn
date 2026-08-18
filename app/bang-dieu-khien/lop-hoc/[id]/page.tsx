"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Users, BookOpen, ArrowLeft, Copy, Check, Trash2,
  UserMinus, FileText, Clock, ChevronRight, GraduationCap, Plus, X
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { getSubjectColor } from "@/lib/subject";

interface TeacherExam {
  id: string;
  title: string;
  subject: string;
  joinCode: string;
  _count: { questions: number };
}

interface Member {
  studentId: string;
  joinedAt: string;
  student: { id: string; name: string; email: string };
}

interface Assignment {
  id: string;
  dueDate?: string;
  assignedAt: string;
  exam: {
    id: string; title: string; subject: string;
    durationMinutes: number; joinCode: string;
    _count: { questions: number; submissions: number };
  };
}

interface Classroom {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  grade?: string;
  joinCode: string;
  teacher: { id: string; name: string; email: string };
  members: Member[];
  assignments: Assignment[];
}

type Tab = "members" | "exams";

export default function ClassroomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("members");
  const [isTeacher, setIsTeacher] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [teacherExams, setTeacherExams] = useState<TeacherExam[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/classrooms/${id}`).then((r) => r.json()),
      fetch("/api/auth/session").then((r) => r.json()),
    ])
      .then(([cls, session]) => {
        setClassroom(cls);
        if (session?.user) setIsTeacher(session.user.mode !== "student");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const loadTeacherExams = async () => {
    const res = await fetch("/api/exams");
    const data = await res.json();
    setTeacherExams(Array.isArray(data) ? data : data?.exams ?? []);
  };

  const assignExam = async (examId: string) => {
    setAssigning(examId);
    const res = await fetch(`/api/classrooms/${id}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId }),
    });
    const data = await res.json();
    if (res.ok && data.exam) {
      setClassroom((prev) =>
        prev
          ? {
              ...prev,
              assignments: [
                { id: data.assignment.id, assignedAt: new Date().toISOString(), exam: data.exam },
                ...prev.assignments,
              ],
            }
          : prev
      );
    }
    setAssigning(null);
    setShowAssign(false);
  };

  const unassignExam = async (examId: string) => {
    if (!confirm("Gỡ đề thi này khỏi lớp?")) return;
    await fetch(`/api/classrooms/${id}/assignments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId }),
    });
    setClassroom((prev) =>
      prev
        ? { ...prev, assignments: prev.assignments.filter((a) => a.exam.id !== examId) }
        : prev
    );
  };

  const copyCode = () => {
    if (!classroom) return;
    navigator.clipboard.writeText(classroom.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const removeMember = async (studentId: string) => {
    if (!confirm("Xóa học sinh này khỏi lớp?")) return;
    setRemoving(studentId);
    await fetch(`/api/classrooms/${id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    setClassroom((prev) =>
      prev ? { ...prev, members: prev.members.filter((m) => m.studentId !== studentId) } : prev
    );
    setRemoving(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Spinner />
    </div>
  );

  if (!classroom) return (
    <div className="p-8 text-center text-[var(--text-muted)]">Không tìm thấy lớp học.</div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <Link
        href="/bang-dieu-khien/lop-hoc"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> Lớp học
      </Link>

      <div className="rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[#5EEAD4] p-5 mb-6 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-white">{classroom.name}</h1>
            {classroom.subject && <p className="text-white/70 text-sm mt-0.5">{classroom.subject}</p>}
            {classroom.description && <p className="text-white/60 text-xs mt-1">{classroom.description}</p>}
            <p className="text-white/60 text-xs mt-2">GV: {classroom.teacher.name}</p>
          </div>
          {isTeacher && (
            <button onClick={copyCode} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-mono font-black transition-colors">
              {copied ? <Check size={13} /> : <Copy size={13} />}{classroom.joinCode}
            </button>
          )}
        </div>
        <div className="flex gap-4 mt-4">
          <div className="text-center"><p className="text-white font-black text-lg">{classroom.members.length}</p><p className="text-white/60 text-xs">Học sinh</p></div>
          <div className="w-px bg-white/20" />
          <div className="text-center"><p className="text-white font-black text-lg">{classroom.assignments.length}</p><p className="text-white/60 text-xs">Đề thi</p></div>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-[var(--gray-100)] rounded-xl mb-5 w-fit">
        {(["members", "exams"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === t ? "bg-white text-[var(--text-primary)] shadow-sm dark:bg-[#134E4A]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
            {t === "members" ? <Users size={14} /> : <BookOpen size={14} />}
            {t === "members" ? "Học sinh" : "Đề thi"}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <Card padding="none">
          {classroom.members.length === 0 ? (
            <EmptyState icon={<GraduationCap />} title="Chưa có học sinh nào" description={isTeacher ? `Chia sẻ mã lớp: ${classroom.joinCode}` : ""} className="py-12" />
          ) : (
            <div className="divide-y divide-[var(--surface-border)]">
              {classroom.members.map((m) => (
                <div key={m.studentId} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-[var(--primary-light)] flex items-center justify-center shrink-0"><span className="text-sm font-black text-[var(--primary)]">{m.student.name.charAt(0).toUpperCase()}</span></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[var(--text-primary)] truncate">{m.student.name}</p><p className="text-xs text-[var(--text-muted)]">{m.student.email}</p></div>
                  <p className="text-xs text-[var(--text-muted)] shrink-0">{new Date(m.joinedAt).toLocaleDateString("vi-VN")}</p>
                  {isTeacher && <button onClick={() => removeMember(m.studentId)} disabled={removing === m.studentId} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] transition-colors disabled:opacity-50">{removing === m.studentId ? <Spinner size="sm" /> : <UserMinus size={14} />}</button>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "exams" && (
        <div className="flex flex-col gap-3">
          {isTeacher && <div className="flex justify-end"><Button icon={<Plus size={15} />} onClick={() => { setShowAssign(true); loadTeacherExams(); }}>Giao đề thi</Button></div>}

          {showAssign && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-[var(--surface-card)] rounded-2xl p-5 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-4"><h2 className="font-black text-[var(--text-primary)]">Chọn đề thi để giao</h2><button onClick={() => setShowAssign(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button></div>
                {teacherExams.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-6">Bạn chưa có đề thi nào.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                    {teacherExams.map((exam) => {
                      const alreadyAssigned = classroom.assignments.some((a) => a.exam.id === exam.id);
                      const c = getSubjectColor(exam.subject);
                      return <button key={exam.id} disabled={alreadyAssigned || assigning === exam.id} onClick={() => assignExam(exam.id)} className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${alreadyAssigned ? "border-[var(--surface-border)] bg-[var(--gray-100)] opacity-60 cursor-not-allowed" : "border-[var(--surface-border)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)]"}`}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.bg }}><FileText size={13} style={{ color: c.text }} /></div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[var(--text-primary)] truncate">{exam.title}</p><p className="text-xs text-[var(--text-muted)]">{exam.subject} · {exam._count.questions} câu · {exam.joinCode}</p></div>
                        {alreadyAssigned && <span className="text-xs text-[var(--primary)] font-bold shrink-0">Đã giao</span>}
                        {assigning === exam.id && <Spinner size="sm" />}
                      </button>;
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {classroom.assignments.length === 0 ? (
            <Card className="py-12"><EmptyState icon={<FileText />} title="Chưa có đề thi nào" description={isTeacher ? "Nhấn 'Giao đề thi' để giao đề cho lớp này" : "Giáo viên chưa giao đề thi"} className="" /></Card>
          ) : (
            classroom.assignments.map((a) => {
              const c = getSubjectColor(a.exam.subject);
              return <Card key={a.id} hover padding="none">
                <div className="flex items-center gap-0">
                  <div className="w-1.5 self-stretch rounded-l-xl" style={{ background: c.text }} />
                  <div className="flex-1 flex items-center gap-3 p-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.bg }}><FileText size={15} style={{ color: c.text }} /></div>
                    <div className="flex-1 min-w-0"><p className="font-semibold text-[var(--text-primary)] truncate">{a.exam.title}</p><div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]"><span>{a.exam.subject}</span><span className="flex items-center gap-1"><FileText size={10} /> {a.exam._count.questions} câu</span><span className="flex items-center gap-1"><Clock size={10} /> {a.exam.durationMinutes} phút</span><span className="flex items-center gap-1"><Users size={10} /> {a.exam._count.submissions} nộp</span></div>{a.dueDate && <p className="text-xs text-[var(--warning)] mt-0.5">Hạn: {new Date(a.dueDate).toLocaleDateString("vi-VN")}</p>}</div>
                    <div className="flex items-center gap-2 shrink-0"><Link href={`/bang-dieu-khien/de-thi/${a.exam.id}`} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)]"><ChevronRight size={16} /></Link>{isTeacher && <button onClick={() => unassignExam(a.exam.id)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)]"><Trash2 size={15} /></button>}</div>
                  </div>
                </div>
              </Card>;
            })
          )}
        </div>
      )}
    </div>
  );
}
