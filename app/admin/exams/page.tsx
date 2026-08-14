"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { getSubjectColor } from "@/lib/subject";

interface AdminExam {
  id: string;
  title: string;
  subject: string;
  status: string;
  joinCode: string;
  createdAt: string;
  teacher: { name: string; email: string };
  _count: { questions: number; submissions: number };
}

export default function AdminExams() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/exams");
      if (!res.ok) throw new Error("Forbidden");
      const data = await res.json();
      setExams(data.exams);
    } catch {
      setError("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (e: AdminExam) => {
    if (!confirm(`Xóa đề "${e.title}"? Các bài nộp liên quan cũng bị xóa.`)) return;
    const res = await fetch("/api/admin/exams", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: e.id }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Lỗi");
      return;
    }
    load();
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <FileText size={20} className="text-[#6C63FF]" /> Đề thi toàn hệ thống
      </h1>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : exams.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-400">
          Chưa có đề thi nào
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-4 py-3 font-semibold">Đề thi</th>
                <th className="px-4 py-3 font-semibold">Giáo viên</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Câu / Bài nộp</th>
                <th className="px-4 py-3 font-semibold">Tạo lúc</th>
                <th className="px-4 py-3 font-semibold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {exams.map((e) => {
                const c = getSubjectColor(e.subject);
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.bg }}>
                          <FileText size={12} style={{ color: c.text }} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{e.title}</p>
                          <p className="text-[11px] text-slate-400">Mã: {e.joinCode} · {e.subject}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{e.teacher.name}<br /><span className="text-slate-400">{e.teacher.email}</span></td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${e.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {e.status === "published" ? "Đang mở" : "Bản nháp"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{e._count.questions} câu · {e._count.submissions} bài</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(e.createdAt).toLocaleString("vi-VN", { dateStyle: "short" })}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => remove(e)}
                        className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-200"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}