"use client";

import { useEffect, useState, useCallback } from "react";
import { Flag, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Report {
  id: string;
  type: string;
  description: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  handledAt: string | null;
  resolvedAt: string | null;
  reporter: { name: string; email: string } | null;
  handledBy: { name: string; email: string } | null;
  exam: { title: string; subject: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xử lý",
  reviewing: "Đang xem xét",
  resolved: "Đã xử lý",
  rejected: "Từ chối",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  reviewing: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-[var(--gray-100)] text-[var(--text-secondary)]",
};

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (s = status) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports${s ? `?status=${s}` : ""}`);
      if (!res.ok) throw new Error("Forbidden");
      const data = await res.json();
      setReports(data.reports);
    } catch {
      setError("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(status); }, [load]);

  const update = async (id: string, next: string) => {
    const body: Record<string, string> = { id, status: next };
    if (next === "resolved" || next === "rejected") {
      const note = prompt(`Ghi kết quả xử lý (để trống nếu không cần):`);
      if (note === null) return;
      if (note.trim()) body.resolution = note.trim();
    }
    const res = await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Lỗi");
      return;
    }
    load(status);
  };

  const remove = async (r: Report) => {
    if (!confirm(`Xóa báo cáo này? Hành động là soft-delete.`)) return;
    const res = await fetch("/api/admin/reports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Lỗi");
      return;
    }
    load(status);
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <Flag size={20} className="text-[#6C63FF]" /> Báo cáo từ người dùng
      </h1>

      <div className="flex gap-2 mb-4">
        {["", "pending", "reviewing", "resolved", "rejected"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${status === s ? "bg-[#6C63FF] text-white" : "bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[#6C63FF]/40"}`}
          >
            {s === "" ? "Tất cả" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-10 text-center text-sm text-[var(--text-muted)]">
          Không có báo cáo nào
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[var(--gray-100)] text-[var(--text-secondary)]">{r.type}</span>
                  {r.exam && <span className="text-xs text-[var(--text-secondary)]">{r.exam.title}</span>}
                </div>
                <span className="text-xs text-[var(--text-muted)]">{new Date(r.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">{r.description}</p>
              {r.resolution && (
                <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-2">
                  Kết quả xử lý: {r.resolution}
                </p>
              )}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-[var(--text-muted)]">
                  Báo cáo bởi: {r.reporter ? `${r.reporter.name} (${r.reporter.email})` : "Ẩn danh"}
                  {r.handledBy && r.handledAt && (
                    <> · Xử lý bởi {r.handledBy.email} lúc {new Date(r.handledAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</>
                  )}
                </p>
                <div className="flex gap-1.5">
                  {r.status !== "reviewing" && (
                    <button onClick={() => update(r.id, "reviewing")} className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-200">
                      Xem xét
                    </button>
                  )}
                  {r.status !== "resolved" && (
                    <button onClick={() => update(r.id, "resolved")} className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-200">
                      Đã xử lý
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button onClick={() => update(r.id, "rejected")} className="rounded-lg bg-[var(--gray-100)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-200)]">
                      Từ chối
                    </button>
                  )}
                  <button onClick={() => remove(r)} className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-500 hover:bg-red-100">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}