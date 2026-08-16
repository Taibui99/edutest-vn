"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Search, ShieldCheck, RotateCcw, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { exportCsv } from "@/lib/csv";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isBlocked: boolean;
  school: string | null;
  grade: string | null;
  streak: number;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  _count: { submissions: number; exams: number };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const load = useCallback(async (query = q, r = role, s = status, p = page) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (r) params.set("role", r);
    if (s) params.set("status", s);
    params.set("page", String(p));
    try {
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Forbidden");
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setError("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [q, role, status, page]);

  useEffect(() => { load(q, role, status, page); }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Lỗi");
        return;
      }
      load(q, role, status, page);
    } finally {
      setBusyId("");
    }
  };

  const remove = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Lỗi");
        return;
      }
      load(q, role, status, page);
    } finally {
      setBusyId("");
      setDeleting(null);
    }
  };

  const exportRows = () =>
    exportCsv(
      "nguoi-dung.csv",
      ["Tên", "Email", "Vai trò", "Trạng thái", "Trường", "Khối", "Streak", "Bài nộp", "Đề tạo", "Đăng nhập cuối", "Ngày tạo"],
      users.map((u) => [
        u.name,
        u.email,
        u.role,
        u.deletedAt ? "đã xóa" : u.isBlocked ? "đã khóa" : "hoạt động",
        u.school ?? "",
        u.grade ?? "",
        u.streak,
        u._count.submissions,
        u._count.exams,
        u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("vi-VN") : "",
        new Date(u.createdAt).toLocaleString("vi-VN"),
      ]),
    );

  const roleBadge = (r: string) =>
    r === "admin"
      ? "bg-[#EEEFFE] text-[#6C63FF]"
      : r === "teacher"
        ? "bg-[#E8F4FD] text-[#4EA8DE]"
        : "bg-[#E1F5EE] text-[#06D6A0]";

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <Users size={20} className="text-[#6C63FF]" /> Quản lý người dùng
        <span className="text-xs font-bold text-[var(--text-muted)]">({total} tài khoản)</span>
      </h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên / email..."
            className="w-full rounded-lg border border-[var(--surface-border)] pl-9 pr-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
          />
        </div>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
        >
          <option value="">Tất cả vai trò</option>
          <option value="student">Học sinh</option>
          <option value="teacher">Giáo viên</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="blocked">Đã khóa</option>
          <option value="deleted">Đã xóa</option>
        </select>
        <button
          onClick={exportRows}
          disabled={users.length === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-100)] disabled:opacity-40"
        >
          <Download size={13} /> CSV
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-10 text-center text-sm text-[var(--text-muted)]">
          Không tìm thấy người dùng nào
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-left text-xs text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-semibold">Người dùng</th>
                  <th className="px-4 py-3 font-semibold">Vai trò</th>
                  <th className="px-4 py-3 font-semibold">Hoạt động</th>
                  <th className="px-4 py-3 font-semibold">Đăng nhập cuối</th>
                  <th className="px-4 py-3 font-semibold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {users.map((u) => (
                  <tr key={u.id} className={u.isBlocked ? "bg-red-50/40" : u.deletedAt ? "bg-[var(--gray-100)] opacity-70" : ""}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {u.name}
                        {u.isBlocked && <span className="ml-1 text-[10px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">ĐÃ KHÓA</span>}
                        {u.deletedAt && <span className="ml-1 text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--gray-200)] px-1.5 py-0.5 rounded">ĐÃ XÓA</span>}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{u.email}{u.school ? ` · ${u.school}${u.grade ? ` ${u.grade}` : ""}` : ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${roleBadge(u.role)}`}>
                        {u.role === "admin" ? "Admin" : u.role === "teacher" ? "Giáo viên" : "Học sinh"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                      {u._count.submissions} bài nộp · {u._count.exams} đề
                      {u.streak > 0 && <span className="ml-1 text-[#D4A017] font-bold">🔥{u.streak}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.deletedAt ? (
                          <button
                            disabled={busyId === u.id}
                            onClick={() => patch(u.id, { restore: true })}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                          >
                            <RotateCcw size={11} /> Khôi phục
                          </button>
                        ) : (
                          <>
                            <select
                              value={u.role}
                              disabled={busyId === u.id}
                              onChange={(e) => patch(u.id, { role: e.target.value })}
                              className="rounded-lg border border-[var(--surface-border)] px-2 py-1 text-xs disabled:opacity-50"
                            >
                              <option value="student">HS</option>
                              <option value="teacher">GV</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              disabled={busyId === u.id}
                              onClick={() => patch(u.id, { isBlocked: !u.isBlocked })}
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold disabled:opacity-50 ${u.isBlocked ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}
                            >
                              {u.isBlocked ? "Mở khóa" : "Khóa"}
                            </button>
                            <button
                              disabled={busyId === u.id}
                              onClick={() => setDeleting(u)}
                              className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-200 disabled:opacity-50"
                            >
                              Xóa
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
      <p className="mt-3 text-[11px] text-[var(--text-muted)] flex items-center gap-1">
        <ShieldCheck size={12} /> Chỉ admin được thao tác. Xóa tài khoản là soft-delete (có thể khôi phục), vẫn cần gõ DELETE để xác nhận.
      </p>

      <ConfirmDialog
        open={deleting !== null}
        title="Xóa tài khoản"
        message={deleting ? `Xóa tài khoản ${deleting.name} (${deleting.email})? Soft-delete, có thể khôi phục sau.` : ""}
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