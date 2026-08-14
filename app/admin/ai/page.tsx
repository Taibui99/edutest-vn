"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface AiLog {
  id: string;
  action: string;
  provider: string;
  status: string;
  model: string | null;
  error: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export default function AdminAi() {
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/ai")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Forbidden"))))
      .then((d) => { setLogs(d.logs); setByStatus(d.byStatus); })
      .catch(() => setError("Không tải được dữ liệu"))
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) =>
    s === "success" ? "bg-emerald-100 text-emerald-700"
      : s === "failed" ? "bg-red-100 text-red-600"
        : s === "running" ? "bg-blue-100 text-blue-700"
          : "bg-slate-100 text-slate-500";

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <Sparkles size={20} className="text-[#6C63FF]" /> Nhật ký AI Import
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {["success", "failed", "running"].map((s) => (
          <div key={s} className="rounded-2xl bg-white border border-slate-200 p-4">
            <p className={`text-[11px] font-bold px-2 py-0.5 rounded-lg inline-block ${statusColor(s)}`}>{s === "success" ? "Thành công" : s === "failed" ? "Thất bại" : "Đang chạy"}</p>
            <p className="text-2xl font-black text-slate-800 mt-2">{byStatus[s] ?? 0}</p>
          </div>
        ))}
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-[11px] font-bold px-2 py-0.5 rounded-lg inline-block bg-slate-100 text-slate-500">Tổng (gần đây)</p>
          <p className="text-2xl font-black text-slate-800 mt-2">{logs.length}</p>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-400">Chưa có lượt import nào</div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold">Người dùng</th>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{l.user ? `${l.user.name} (${l.user.email})` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{l.model ?? l.provider}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${statusColor(l.status)}`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-[260px] truncate">{l.error ?? l.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}