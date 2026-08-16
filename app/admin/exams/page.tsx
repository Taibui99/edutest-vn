"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FileText, Search, Eye, EyeOff, RotateCcw, Flag, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { exportCsv } from "@/lib/csv";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
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
  const { toast } = useToast();
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
  const [deleting, setDeleting] = useState<AdminExam | null>(null);

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

  useEffect(() => { load(q, status, deleted, page); }, [load, q, status, deleted, page]); // eslint-disable-line react-hooks/set-state-in-effect

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
        toast("error", "Không thể cập nhật", d.error || "Lỗi");
        return;
      }
      toast("success", "Đã cập nhật đề thi");
      load(q, status, deleted, page);
    } finally {
      setBusyId("");
    }
  };

  const remove = async (e: AdminExam) => {
    setBusyId(e.id);
    const res = await fetch("/api/admin/exams", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: e.id }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast("error", "Không thể xóa", d.error || "Lỗi");
      return;
    }
    toast("success", "Đã xóa đề thi", e.title);
    load(q, status, deleted, page);
    setDeleting(null);
  };

  const exportRows = () =>
    exportCsv(
      "de-thi.csv",
      ["Tiêu đề", "Môn", "Trạng thái", "Ẩn", "Mã", "Giáo viên", "Email", "Câu hỏi", "Bài nộp", "Báo cáo", "Ngày tạo"],
      exams.map((e) => [
        e.title,
        e.subject,
        e.status === "published" ? "đang mở" : "bản nháp",
        e.hidden ? "có" : "không",
        e.joinCode,
        e.teacher.name,
        e.teacher.email,
        e._count.questions,
        e._count.submissions,
        e._count.reports,
        new Date(e.createdAt).toLocaleString("vi-VN"),
      ]),
    );

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <FileText size={20} className="text-[#6C63FF]" /> Đề thi toàn hệ thống
        <span className="text-xs font-bold text-[var(--text-muted)]">({total} đề)</span>
      </h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên đề..."
            className="w-full rounded-lg border border-[var(--surface-border)] pl-9 pr-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="published">Đang mở</option>
          <option value="draft">Bản nháp</option>
        </select>
        <button
          onClick={() => { setDeleted(!deleted); setPage(1); }}
          className={`rounded-lg px-3 py-2 text-xs font-bold border ${deleted ? "bg-[var(--gray-800)] text-white border-[var(--gray-800)]" : "bg-[var(--surface-card)] border-[var(--surface-border)] text-[var(--text-secondary)]"}`}
        >
          {deleted ? "Đã xóa" : "Đã xóa"}
        </button>
        <button
          onClick={exportRows}
          disabled={exams.length === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-100)] disabled:opacity-40"
        >
          <Download size={13} /> CSV
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : exams.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <EmptyState icon={<FileText />} title="Chưa có đề thi nào" description="Điều chỉnh bộ lọc hoặc từ khóa tìm kiếm." />
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-left text-xs text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-semibold">Đề thi</th>
                  <th className="px-4 py-3 font-semibold">Giáo viên</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Câu / Bài nộp</th>
                  <th className="px-4 py-3 font-semibold">Tạo lúc</th>
                  <th className="px-4 py-3 font-semibold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {exams.map((e) => {
                  const c = getSubjectColor(e.subject);
                  return (
                    <tr key={e.id} className={e.deletedAt ? "bg-[var(--gray-100)] opacity-70" : ""}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.bg }}>
                            <FileText size={12} style={{ color: c.text }} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--text-primary)] truncate">
                              {e.title}
                              {e.hidden && !e.deletedAt && <span className="ml-1 text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--gray-200)] px-1.5 py-0.5 rounded">ẨN</span>}
                              {e.deletedAt && <span className="ml-1 text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--gray-200)] px-1.5 py-0.5 rounded">ĐÃ XÓA</span>}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)]">Mã: {e.joinCode} · {e.subject}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{e.teacher.name}<br /><span className="text-[var(--text-muted)]">{e.teacher.email}</span></td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${e.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-[var(--gray-100)] text-[var(--text-secondary)]"}`}>
                          {e.status === "published" ? "Đang mở" : "Bản nháp"}
                        </span>
                        {e._count.reports > 0 && (
                          <Link href={`/admin/reports`} className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                            <Flag size={10} /> {e._count.reports}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{e._count.questions} câu · {e._count.submissions} bài</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{new Date(e.createdAt).toLocaleString("vi-VN", { dateStyle: "short" })}</td>
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
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold disabled:opacity-50 ${e.hidden ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-[var(--gray-100)] text-[var(--text-secondary)] hover:bg-[var(--gray-200)]"}`}
                              >
                                {e.hidden ? <><Eye size={11} /> Hiện</> : <><EyeOff size={11} /> Ẩn</>}
                              </button>
                              <button
                                disabled={busyId === e.id}
                                onClick={() => setDeleting(e)}
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
            <p className="text-xs text-[var(--text-muted)]">Trang {page} / {totalPages}</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-100)] disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-100)] disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Xóa đề thi"
        message={deleting ? `Xóa đề "${deleting.title}"? Hành động là soft-delete và có thể khôi phục.` : ""}
        danger
        requireText="DELETE"
        confirmLabel="Xóa"
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)}
        busy={busyId === (deleting?.id ?? "")}
      />
    </div>
  );
}