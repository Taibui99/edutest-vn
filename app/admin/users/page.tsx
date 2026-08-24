"use client";

import { useEffect, useState } from "react";
import { Users, Search, ShieldCheck, RotateCcw, ChevronLeft, ChevronRight, Download, Flame } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { exportCsv } from "@/lib/csv";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

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
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ac = new AbortController();
    const run = async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      params.set("page", String(page));
      try {
        const res = await fetch(`/api/admin/users?${params}`, { signal: ac.signal });
        if (!res.ok) throw new Error("Forbidden");
        const data = await res.json();
        setUsers(data.users);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Không tải được dữ liệu");
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ac.abort();
  }, [q, role, status, page, refreshTick]);

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
        toast("error", "Không thể cập nhật", d.error || "Lỗi");
        return;
      }
      toast("success", "Đã cập nhật tài khoản");
      setRefreshTick((t) => t + 1);
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
        toast("error", "Không thể xóa", d.error || "Lỗi");
        return;
      }
      toast("success", "Đã xóa tài khoản", u.email);
      setRefreshTick((t) => t + 1);
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
      ? "bg-[#F1EDFD] text-[#6C4CF1]"
      : r === "teacher"
        ? "bg-[#EAF3FC] text-[#2F80D8]"
        : "bg-[#E8F7F1] text-[#189A6C]";

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <Users size={20} className="text-[#6C4CF1]" /> Quản lý người dùng
        <span className="text-xs font-bold text-[var(--text-muted)]">({total} tài khoản)</span>
      </h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên / email..."
            className="w-full rounded-lg border border-[var(--surface-border)] pl-9 pr-3 py-2 text-sm focus:border-[#6C4CF1] focus:outline-none"
          />
        </div>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm focus:border-[#6C4CF1] focus:outline-none"
        >
          <option value="">Tất cả vai trò</option>
          <option value="student">Học sinh</option>
          <option value="teacher">Giáo viên</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm focus:border-[#6C4CF1] focus:outline-none"
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

      {error && <p className="mb-3 text-sm text-[#E14D4D]">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <EmptyState icon={<Users />} title="Không tìm thấy người dùng nào" description="Thử đổi từ khóa tìm kiếm hoặc bộ lọc." />
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
                  <tr key={u.id} className={u.isBlocked ? "bg-[#FFECEC]/40" : u.deletedAt ? "bg-[var(--gray-100)] opacity-70" : ""}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {u.name}
                        {u.isBlocked && <span className="ml-1 text-[10px] font-bold text-[#E14D4D] bg-[#FFECEC] px-1.5 py-0.5 rounded">ĐÃ KHÓA</span>}
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
                      {u.streak > 0 && <span className="ml-1 text-[#B97F10] font-bold inline-flex items-center gap-0.5"><Flame size={11} className="inline" />{u.streak}</span>}
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
                            className="inline-flex items-center gap-1 rounded-lg bg-[#E8F7F1] px-2.5 py-1 text-xs font-bold text-[#189A6C] hover:bg-[#D3EFE5] disabled:opacity-50"
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
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold disabled:opacity-50 ${u.isBlocked ? "bg-[#E8F7F1] text-[#189A6C] hover:bg-[#D3EFE5]" : "bg-[#FCF3E2] text-[#B97F10] hover:bg-[#F5E5BC]"}`}
                            >
                              {u.isBlocked ? "Mở khóa" : "Khóa"}
                            </button>
                            <button
                              disabled={busyId === u.id}
                              onClick={() => setDeleting(u)}
                              className="rounded-lg bg-[#FFECEC] px-2.5 py-1 text-xs font-bold text-[#E14D4D] hover:bg-[#FFDDDD] disabled:opacity-50"
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