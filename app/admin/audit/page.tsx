"use client";

import { useEffect, useState, useCallback } from "react";
import { ScrollText, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface AuditLog {
  id: string;
  type: string;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
}

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [types, setTypes] = useState<{ type: string; _count: { _all: number } }[]>([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (f = filter, query = q, p = page) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (f) params.set("type", f);
    if (query) params.set("q", query);
    params.set("page", String(p));
    fetch(`/api/admin/audit?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Forbidden"))))
      .then((d) => { setLogs(d.logs); setTypes(d.types); setTotalPages(d.totalPages); })
      .catch(() => setError("Không tải được dữ liệu"))
      .finally(() => setLoading(false));
  }, [filter, q, page]);

  useEffect(() => { load(filter, q, page); }, [load]);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <ScrollText size={20} className="text-[#6C63FF]" /> Nhật ký quản trị
      </h1>

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Tìm theo nội dung nhật ký..."
          className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
        />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => { setFilter(""); setPage(1); }}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === "" ? "bg-[#6C63FF] text-white" : "bg-white border border-slate-200 text-slate-500"}`}
        >
          Tất cả
        </button>
        {types.map((t) => (
          <button
            key={t.type}
            onClick={() => { setFilter(t.type); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === t.type ? "bg-[#6C63FF] text-white" : "bg-white border border-slate-200 text-slate-500"}`}
          >
            {t.type} ({t._count._all})
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-400">Chưa có nhật ký nào</div>
      ) : (
        <>
          <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-50">
            {logs.map((l) => (
              <div key={l.id} className="px-5 py-3.5 flex items-start gap-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#EEEFFE] text-[#6C63FF] shrink-0 mt-0.5">
                  {l.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{l.message}</p>
                  <p className="text-[11px] text-slate-400">
                    {l.actor ? `${l.actor.name} (${l.actor.email})` : "Hệ thống"} ·{" "}
                    {new Date(l.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                    {l.meta ? <> · {JSON.stringify(l.meta).slice(0, 120)}</> : null}
                  </p>
                </div>
              </div>
            ))}
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