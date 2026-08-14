"use client";

import { useEffect, useState, useCallback } from "react";
import { Flag } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Report {
  id: string;
  type: string;
  description: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { name: string; email: string } | null;
  exam: { title: string; subject: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xử lý",
  investigating: "Đang xem xét",
  resolved: "Đã xử lý",
  rejected: "Từ chối",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  investigating: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-slate-100 text-slate-500",
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
    const res = await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
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
      <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <Flag size={20} className="text-[#6C63FF]" /> Báo cáo từ người dùng
      </h1>

      <div className="flex gap-2 mb-4">
        {["", "pending", "investigating", "resolved", "rejected"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${status === s ? "bg-[#6C63FF] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-[#6C63FF]/40"}`}
          >
            {s === "" ? "Tất cả" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-400">
          Không có báo cáo nào
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500">{r.type}</span>
                  {r.exam && <span className="text-xs text-slate-500">{r.exam.title}</span>}
                </div>
                <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <p className="text-sm text-slate-700 mb-3">{r.description}</p>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-slate-400">
                  Báo cáo bởi: {r.reporter ? `${r.reporter.name} (${r.reporter.email})` : "Ẩn danh"}
                  {r.resolvedAt && <> · Xử lý lúc {new Date(r.resolvedAt).toLocaleString("vi-VN", { dateStyle: "short" })}</>}
                </p>
                <div className="flex gap-1.5">
                  {r.status !== "investigating" && (
                    <button onClick={() => update(r.id, "investigating")} className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-200">
                      Xem xét
                    </button>
                  )}
                  {r.status !== "resolved" && (
                    <button onClick={() => update(r.id, "resolved")} className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-200">
                      Đã xử lý
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button onClick={() => update(r.id, "rejected")} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 hover:bg-slate-200">
                      Từ chối
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}