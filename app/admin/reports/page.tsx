"use client";

import { useEffect, useState, useCallback } from "react";
import { Flag, Trash2, Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { exportCsv } from "@/lib/csv";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

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
  pending: "bg-[#FCF3E2] text-[#B97F10]",
  reviewing: "bg-[#EAF3FC] text-[#2F80D8]",
  resolved: "bg-[#E8F7F1] text-[#189A6C]",
  rejected: "bg-[var(--gray-100)] text-[var(--text-secondary)]",
};

export default function AdminReports() {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [pendingAction, setPendingAction] = useState<{ id: string; next: string } | null>(null);
  const [deleting, setDeleting] = useState<Report | null>(null);
  const [resolution, setResolution] = useState("");

  const load = useCallback(async (s = status, query = q, p = page) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (query) params.set("q", query);
    params.set("page", String(p));
    try {
      const res = await fetch(`/api/admin/reports?${params}`);
      if (!res.ok) throw new Error("Forbidden");
      const data = await res.json();
      setReports(data.reports);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setError("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [status, q, page]);

  useEffect(() => { load(status, q, page); }, [load, status, q, page]); // eslint-disable-line react-hooks/set-state-in-effect

  const update = async (id: string, next: string) => {
    setBusyId(id);
    const body: Record<string, string> = { id, status: next };
    if (next === "resolved" || next === "rejected") {
      const note = resolution.trim();
      if (note) body.resolution = note;
    }
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        toast("error", "Không thể cập nhật", d.error || "Lỗi");
        return;
      }
      toast("success", "Đã cập nhật báo cáo");
      load(status, q, page);
    } finally {
      setBusyId("");
      setPendingAction(null);
      setResolution("");
    }
  };

  const remove = async (r: Report) => {
    setBusyId(r.id);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast("error", "Không thể xóa", d.error || "Lỗi");
        return;
      }
      toast("success", "Đã xóa báo cáo");
      load(status, q, page);
    } finally {
      setBusyId("");
      setDeleting(null);
    }
  };

  const exportRows = () =>
    exportCsv(
      "bao-cao.csv",
      ["Loại", "Trạng thái", "Nội dung", "Kết quả", "Người báo cáo", "Đề thi", "Ngày tạo"],
      reports.map((r) => [
        r.type,
        STATUS_LABEL[r.status] ?? r.status,
        r.description,
        r.resolution ?? "",
        r.reporter?.name ?? "Ẩn danh",
        r.exam?.title ?? "",
        new Date(r.createdAt).toLocaleString("vi-VN"),
      ]),
    );

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
        <Flag size={20} className="text-[#6C4CF1]" /> Báo cáo từ người dùng
        <span className="text-xs font-bold text-[var(--text-muted)]">({total} báo cáo)</span>
      </h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {["", "pending", "reviewing", "resolved", "rejected"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${status === s ? "bg-[#6C4CF1] text-white" : "bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[#6C4CF1]/40"}`}
          >
            {s === "" ? "Tất cả" : STATUS_LABEL[s]}
          </button>
        ))}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Tìm theo loại / nội dung / người báo cáo / đề..."
            className="w-full rounded-lg border border-[var(--surface-border)] pl-9 pr-3 py-2 text-sm focus:border-[#6C4CF1] focus:outline-none"
          />
        </div>
        <button
          onClick={exportRows}
          disabled={reports.length === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-100)] disabled:opacity-40"
        >
          <Download size={13} /> CSV
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-[#E14D4D]">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <EmptyState icon={<Flag />} title="Không có báo cáo nào" description="Báo cáo từ người dùng sẽ hiện tại đây." />
        </div>
      ) : (
        <>
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
                  <p className="text-xs text-[#189A6C] bg-[#E8F7F1] rounded-lg px-3 py-2 mb-2">
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
                      <button onClick={() => update(r.id, "reviewing")} disabled={busyId === r.id} className="rounded-lg bg-[#EAF3FC] px-2.5 py-1 text-xs font-bold text-[#2F80D8] hover:bg-[#DCEBFC] disabled:opacity-50">
                        Xem xét
                      </button>
                    )}
                    {(r.status === "resolved" || r.status === "rejected") ? (
                      <button
                        onClick={() => { setPendingAction({ id: r.id, next: "pending" }); setResolution(""); }}
                        disabled={busyId === r.id}
                        className="rounded-lg bg-[#FCF3E2] px-2.5 py-1 text-xs font-bold text-[#B97F10] hover:bg-[#F5E5BC] disabled:opacity-50"
                      >
                        Mở lại
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => { setPendingAction({ id: r.id, next: "resolved" }); setResolution(""); }}
                          disabled={busyId === r.id}
                          className="rounded-lg bg-[#E8F7F1] px-2.5 py-1 text-xs font-bold text-[#189A6C] hover:bg-[#D3EFE5] disabled:opacity-50"
                        >
                          Đã xử lý
                        </button>
                        <button
                          onClick={() => { setPendingAction({ id: r.id, next: "rejected" }); setResolution(""); }}
                          disabled={busyId === r.id}
                          className="rounded-lg bg-[var(--gray-100)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-200)] disabled:opacity-50"
                        >
                          Từ chối
                        </button>
                      </>
                    )}
                    <button onClick={() => setDeleting(r)} disabled={busyId === r.id} className="rounded-lg bg-[#FFECEC] px-2.5 py-1 text-xs font-bold text-[#E14D4D] hover:bg-[#FFECEC] disabled:opacity-50">
                      <Trash2 size={12} />
                    </button>
                  </div>
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

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.next === "resolved" ? "Đánh dấu đã xử lý" : pendingAction?.next === "rejected" ? "Từ chối báo cáo" : "Mở lại báo cáo"}
        message="Ghi kết quả xử lý (không bắt buộc)."
        confirmLabel={pendingAction?.next === "resolved" ? "Xác nhận" : pendingAction?.next === "rejected" ? "Từ chối" : "Mở lại"}
        onConfirm={() => pendingAction && update(pendingAction.id, pendingAction.next)}
        onCancel={() => { setPendingAction(null); setResolution(""); }}
        busy={busyId === (pendingAction?.id ?? "")}
      >
        <textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="Kết quả xử lý (tùy chọn)..."
          rows={3}
          className="mb-4 w-full rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm focus:border-[#6C4CF1] focus:outline-none"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Xóa báo cáo"
        message={`Xóa báo cáo này? Hành động là soft-delete, vẫn cần gõ DELETE để xác nhận.`}
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