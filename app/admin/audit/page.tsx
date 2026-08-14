"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/audit${filter ? `?type=${filter}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Forbidden"))))
      .then((d) => { setLogs(d.logs); setTypes(d.types); })
      .catch(() => setError("Không tải được dữ liệu"))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <ScrollText size={20} className="text-[#6C63FF]" /> Nhật ký quản trị
      </h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter("")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === "" ? "bg-[#6C63FF] text-white" : "bg-white border border-slate-200 text-slate-500"}`}
        >
          Tất cả
        </button>
        {types.map((t) => (
          <button
            key={t.type}
            onClick={() => setFilter(t.type)}
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
      )}
    </div>
  );
}