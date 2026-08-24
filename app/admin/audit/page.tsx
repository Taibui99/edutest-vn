"use client";

import { useEffect, useState, useCallback } from "react";
import { ScrollText, Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { exportCsv } from "@/lib/csv";

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

  useEffect(() => { load(filter, q, page); }, [load, filter, q, page]); // eslint-disable-line react-hooks/set-state-in-effect

  const exportRows = () =>
    exportCsv(
      "nhat-ky.csv",
      ["Loại", "Nội dung", "Người thực hiện", "Email", "Metadata", "Thời gian"],
      logs.map((l) => [
        l.type,
        l.message,
        l.actor?.name ?? "Hệ thống",
        l.actor?.email ?? "",
        l.meta ? JSON.stringify(l.meta) : "",
        new Date(l.createdAt).toLocaleString("vi-VN"),
      ]),
    );

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <ScrollText size={20} className="text-[#6C4CF1]" /> Nhật ký quản trị
      </h1>

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Tìm theo nội dung nhật ký..."
          className="w-full rounded-lg border border-[var(--surface-border)] pl-9 pr-3 py-2 text-sm focus:border-[#6C4CF1] focus:outline-none"
        />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => { setFilter(""); setPage(1); }}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === "" ? "bg-[#6C4CF1] text-white" : "bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-secondary)]"}`}
        >
          Tất cả
        </button>
        {types.map((t) => (
          <button
            key={t.type}
            onClick={() => { setFilter(t.type); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === t.type ? "bg-[#6C4CF1] text-white" : "bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-secondary)]"}`}
          >
            {t.type} ({t._count._all})
          </button>
        ))}
        <button
          onClick={exportRows}
          disabled={logs.length === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-100)] disabled:opacity-40"
        >
          <Download size={13} /> CSV
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-[#E14D4D]">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <EmptyState icon={<ScrollText />} title="Chưa có nhật ký nào" description="Các thao tác quản trị sẽ được ghi lại tại đây." />
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] divide-y divide-[var(--surface-border)]">
            {logs.map((l) => (
              <div key={l.id} className="px-5 py-3.5 flex items-start gap-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#F1EDFD] text-[#6C4CF1] shrink-0 mt-0.5">
                  {l.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-secondary)]">{l.message}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {l.actor ? `${l.actor.name} (${l.actor.email})` : "Hệ thống"} ·{" "}
                    {new Date(l.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                    {l.meta ? <> · {JSON.stringify(l.meta).slice(0, 120)}</> : null}
                  </p>
                </div>
              </div>
            ))}
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
    </div>
  );
}