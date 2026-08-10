"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus, Users, BookOpen, ArrowRight, Copy, Check,
  GraduationCap, LogIn
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";

interface Classroom {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  grade?: string;
  joinCode: string;
  archived: boolean;
  teacher?: { name: string };
  _count: { members: number; assignments: number };
}

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSubject, setCreateSubject] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/classrooms")
      .then((r) => r.json())
      .then((data) => {
        setClassrooms(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Get role from session
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => { if (s?.user?.role) setRole(s.user.role); })
      .catch(() => {});
  }, []);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async () => {
    if (!createName.trim()) { setError("Nhập tên lớp"); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/classrooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: createName, subject: createSubject, description: createDesc }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Lỗi"); setSubmitting(false); return; }
    setClassrooms((prev) => [{ ...data, _count: { members: 0, assignments: 0 } }, ...prev]);
    setShowCreate(false); setCreateName(""); setCreateSubject(""); setCreateDesc("");
    setSubmitting(false);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { setError("Nhập mã lớp"); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/classrooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Lỗi"); setSubmitting(false); return; }
    const cls = data.classroom;
    setClassrooms((prev) => [{ ...cls, _count: cls._count || { members: 0, assignments: 0 } }, ...prev]);
    setShowJoin(false); setJoinCode("");
    setSubmitting(false);
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">Lớp học</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {classrooms.length} lớp học
          </p>
        </div>
        {role === "teacher" ? (
          <Button onClick={() => { setShowCreate(true); setError(""); }} icon={<Plus size={16} />}>
            Tạo lớp mới
          </Button>
        ) : (
          <Button onClick={() => { setShowJoin(true); setError(""); }} icon={<LogIn size={16} />}>
            Tham gia lớp
          </Button>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-black text-[var(--text-primary)] mb-4">Tạo lớp học mới</h2>
            <div className="flex flex-col gap-3">
              <Input
                label="Tên lớp *"
                placeholder="VD: Toán 12A1"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
              <Input
                label="Môn học"
                placeholder="VD: Toán học"
                value={createSubject}
                onChange={(e) => setCreateSubject(e.target.value)}
              />
              <Input
                label="Mô tả"
                placeholder="Mô tả ngắn về lớp học"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
              />
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                  Hủy
                </Button>
                <Button className="flex-1" onClick={handleCreate} disabled={submitting}>
                  {submitting ? <Spinner size="sm" /> : "Tạo lớp"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--surface-card)] rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-black text-[var(--text-primary)] mb-1">Tham gia lớp học</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">Nhập mã lớp từ giáo viên</p>
            <div className="flex flex-col gap-3">
              <Input
                label="Mã lớp"
                placeholder="VD: AB12CD"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="font-mono tracking-widest text-center text-lg"
              />
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowJoin(false)}>
                  Hủy
                </Button>
                <Button className="flex-1" onClick={handleJoin} disabled={submitting}>
                  {submitting ? <Spinner size="sm" /> : "Tham gia"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner />
        </div>
      ) : classrooms.length === 0 ? (
        <Card className="py-16">
          <EmptyState
            icon={<GraduationCap />}
            title={role === "teacher" ? "Chưa có lớp học nào" : "Bạn chưa tham gia lớp nào"}
            description={
              role === "teacher"
                ? "Tạo lớp học để quản lý học sinh và giao đề thi"
                : "Nhập mã lớp từ giáo viên để tham gia"
            }
            action={
              role === "teacher" ? (
                <Button onClick={() => setShowCreate(true)} icon={<Plus size={16} />}>
                  Tạo lớp đầu tiên
                </Button>
              ) : (
                <Button onClick={() => setShowJoin(true)} icon={<LogIn size={16} />}>
                  Nhập mã lớp
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((cls) => (
            <Link key={cls.id} href={`/bang-dieu-khien/lop-hoc/${cls.id}`}>
              <Card hover className="h-full p-0 overflow-hidden group">
                <div className="h-2 bg-gradient-to-r from-[var(--primary)] to-[#a78bfa]" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-black text-[var(--text-primary)] truncate group-hover:text-[var(--primary)] transition-colors">
                        {cls.name}
                      </h3>
                      {cls.subject && (
                        <span className="text-xs text-[var(--text-muted)]">{cls.subject}</span>
                      )}
                      {cls.teacher && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          GV: {cls.teacher.name}
                        </p>
                      )}
                    </div>
                    {role === "teacher" && (
                      <button
                        onClick={(e) => { e.preventDefault(); copyCode(cls.joinCode, cls.id); }}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] text-xs font-mono font-black hover:bg-[var(--primary-muted)] transition-colors"
                      >
                        {copiedId === cls.id ? <Check size={11} /> : <Copy size={11} />}
                        {cls.joinCode}
                      </button>
                    )}
                  </div>

                  {cls.description && (
                    <p className="text-xs text-[var(--text-muted)] mb-3 line-clamp-2">
                      {cls.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {cls._count.members} HS
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} /> {cls._count.assignments} đề
                      </span>
                    </div>
                    <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
