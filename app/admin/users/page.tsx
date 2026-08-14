"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Search, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

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
  _count: { submissions: number; exams: number };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async (query = q, r = role) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (r) params.set("role", r);
    try {
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Forbidden");
      const data = await res.json();
      setUsers(data.users);
    } catch {
      setError("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [q, role]);

  useEffect(() => { load(q, role); }, [load]);

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
      load(q, role);
    } finally {
      setBusyId("");
    }
  };

  const remove = async (u: AdminUser) => {
    if (!confirm(`Xóa tài khoản ${u.name} (${u.email})? Hành động không thể hoàn tác.`)) return;
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
      load(q, role);
    } finally {
      setBusyId("");
    }
  };

  const roleBadge = (r: string) =>
    r === "admin"
      ? "bg-[#EEEFFE] text-[#6C63FF]"
      : r === "teacher"
        ? "bg-[#E8F4FD] text-[#4EA8DE]"
        : "bg-[#E1F5EE] text-[#06D6A0]";

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <Users size={20} className="text-[#6C63FF]" /> Quản lý người dùng
      </h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên / email..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
        >
          <option value="">Tất cả vai trò</option>
          <option value="student">Học sinh</option>
          <option value="teacher">Giáo viên</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-400">
          Không tìm thấy người dùng nào
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-4 py-3 font-semibold">Người dùng</th>
                <th className="px-4 py-3 font-semibold">Vai trò</th>
                <th className="px-4 py-3 font-semibold">Hoạt động</th>
                <th className="px-4 py-3 font-semibold">Đăng nhập cuối</th>
                <th className="px-4 py-3 font-semibold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u) => (
                <tr key={u.id} className={u.isBlocked ? "bg-red-50/40" : ""}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{u.name} {u.isBlocked && <span className="ml-1 text-[10px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">ĐÃ KHÓA</span>}</p>
                    <p className="text-xs text-slate-400">{u.email}{u.school ? ` · ${u.school}${u.grade ? ` ${u.grade}` : ""}` : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${roleBadge(u.role)}`}>
                      {u.role === "admin" ? "Admin" : u.role === "teacher" ? "Giáo viên" : "Học sinh"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u._count.submissions} bài nộp · {u._count.exams} đề
                    {u.streak > 0 && <span className="ml-1 text-[#D4A017] font-bold">🔥{u.streak}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <select
                        value={u.role}
                        disabled={busyId === u.id}
                        onChange={(e) => patch(u.id, { role: e.target.value })}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:opacity-50"
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
                        onClick={() => remove(u)}
                        className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-200 disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-400 flex items-center gap-1">
        <ShieldCheck size={12} /> Chỉ admin được thao tác. Khóa tài khoản sẽ chặn đăng nhập ngay lập tức.
      </p>
    </div>
  );
}