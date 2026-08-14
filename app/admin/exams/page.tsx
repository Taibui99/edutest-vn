"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FileText, Search, Eye, EyeOff, RotateCcw, Flag, ChevronLeft, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { getSubjectColor } from "@/lib/subject";

interface AdminExam {
  id: string;
  title: string;
  subject: string;
  status: string;
  hidden: boolean;
  deletedAt: string | null;
  joinCode: string;
  createdAt: string;
  teacher: { name: string; email: string };
  _count: { questions: number; submissions: number; reports: number };
}

export default function AdminExams() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async (query = q, s = status, d = deleted, p = page) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (s) params.set("status", s);
    if (d) params.set("deleted", "true");
    params.set("page", String(p));
    try {
      const res = await fetch(`/api/admin/exams?${params}`);
      if (!res.ok) throw new Error("Forbidden");
      const data = await res.json();
      setExams(data.exams);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setError("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [q, status, deleted, page]);

  useEffect(() => { load(q, status, deleted, page); }, [load]);

  const patch = async (e: AdminExam, body: Record<string, unknown>) => {
    setBusyId(e.id);
    try {
      const res = await fetch("/api/admin/exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id, ...body }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Lỗi");
        return;
      }
      load(q, status, deleted, page);
    } finally {
      setBusyId("");
    }
  };

  const remove = async (e: AdminExam) => {
    if (!confirm(`Xóa đề "${e.title}"? Hành động là soft-delete và có thể khôi phục.`)) return;
    setBusyId(e.id);
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
    load(q, status, deleted, page);
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <FileText size={20} className="text-[#6C63FF]" /> Đề thi toàn hệ thống
        <span className="text-xs font-bold text-slate-400">({total} đề)</span>
      </h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên đề..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="published">Đang mở</option>
          <option value="draft">Bản nháp</option>
        </select>
        <button
          onClick={() => { setDeleted(!deleted); setPage(1); }}
          className={`rounded-lg px-3 py-2 text-xs font-bold border ${deleted ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-200 text-slate-500"}`}
        >
          {deleted ? "Đã xóa" : "Đã xóa"}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : exams.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-400">
          Chưa có đề thi nào
        </div>
      ) : (
        <>
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
                    <tr key={e.id} className={e.deletedAt ? "bg-slate-50 opacity-70" : ""}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.bg }}>
                            <FileText size={12} style={{ color: c.text }} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">
                              {e.title}
                              {e.hidden && !e.deletedAt && <span className="ml-1 text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">ẨN</span>}
                              {e.deletedAt && <span className="ml-1 text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">ĐÃ XÓA</span>}
                            </p>
                            <p className="text-[11px] text-slate-400">Mã: {e.joinCode} · {e.subject}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{e.teacher.name}<br /><span className="text-slate-400">{e.teacher.email}</span></td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${e.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {e.status === "published" ? "Đang mở" : "Bản nháp"}
                        </span>
                        {e._count.reports > 0 && (
                          <Link href={`/admin/reports`} className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                            <Flag size={10} /> {e._count.reports}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{e._count.questions} câu · {e._count.submissions} bài</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(e.createdAt).toLocaleString("vi-VN", { dateStyle: "short" })}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {e.deletedAt ? (
                            <button
                              disabled={busyId === e.id}
                              onClick={() => patch(e, { restore: true })}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                            >
                              <RotateCcw size={11} /> Khôi phục
                            </button>
                          ) : (
                            <>
                              <Link
                                href={`/bang-dieu-khien/de-thi/${e.id}`}
                                className="rounded-lg bg-[#EEEFFE] px-2.5 py-1 text-xs font-bold text-[#6C63FF] hover:bg-[#E2E3FD]"
                              >
                                Xem
                              </Link>
                              <button
                                disabled={busyId === e.id}
                                onClick={() => patch(e, { hidden: !e.hidden })}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold disabled:opacity-50 ${e.hidden ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                              >
                                {e.hidden ? <><Eye size={11} /> Hiện</> : <><EyeOff size={11} /> Ẩn</>}
                              </button>
                              <button
                                disabled={busyId === e.id}
                                onClick={() => remove(e)}
                                className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-200 disabled:opacity-50"
                              >
                                Xóa
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">Trang {page} / {totalPages}</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}