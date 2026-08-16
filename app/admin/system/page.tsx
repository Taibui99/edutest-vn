"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface SystemData {
  checks: Record<string, { ok: boolean; detail?: string }>;
  counts: { exams: number; users: number; notifications: number; settings: number };
  lastAiImport: { status: string; model: string | null; createdAt: string } | null;
  env: { nextAuthSecretSet: boolean; geminiKeySet: boolean; nodeEnv: string };
  now: string;
}

export default function AdminSystem() {
  const [data, setData] = useState<SystemData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!refreshing) setLoading(true);
    try {
      const res = await fetch("/api/admin/system");
      if (!res.ok) throw new Error("Forbidden");
      setData(await res.json());
    } catch {
      setError("Không tải được dữ liệu");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps

  const checkItems = [
    { key: "db", label: "Kết nối database (Prisma/PostgreSQL)" },
    { key: "gemini", label: "Kết nối Google Gemini API" },
    { key: "auth", label: "Xác thực (NextAuth session)" },
    { key: "api", label: "API server" },
    { key: "storage", label: "Storage" },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
          <Activity size={20} className="text-[#6C63FF]" /> Kiểm tra hệ thống
        </h1>
        <button
          onClick={() => { setRefreshing(true); load(); }}
          className="rounded-lg bg-[#6C63FF] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
        >
          Chạy lại kiểm tra
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : data ? (
        <>
          <div className="flex flex-col gap-3 mb-6">
            {checkItems.map((c) => {
              const check = data.checks[c.key];
              return (
                <div key={c.key} className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5 flex items-center gap-3">
                  {check?.ok ? (
                    <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle size={22} className="text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{c.label}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{check?.ok ? "Hoạt động bình thường" : (check?.detail ?? "Không có phản hồi")}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${check?.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                    {check?.ok ? "OK" : "LỖI"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5 mb-6">
            <h2 className="text-sm font-black text-[var(--text-primary)] mb-3">Dữ liệu</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Người dùng", value: data.counts.users },
                { label: "Đề thi", value: data.counts.exams },
                { label: "Thông báo", value: data.counts.notifications },
                { label: "Cài đặt", value: data.counts.settings },
              ].map((c) => (
                <div key={c.label} className="rounded-xl bg-[var(--gray-100)] p-3">
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">{c.label}</p>
                  <p className="text-xl font-black text-[var(--text-primary)]">{c.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5 mb-6">
            <h2 className="text-sm font-black text-[var(--text-primary)] mb-3">AI import gần nhất</h2>
            {data.lastAiImport ? (
              <div className="flex items-center gap-2 text-sm">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${data.lastAiImport.status === "success" ? "bg-emerald-100 text-emerald-700" : data.lastAiImport.status === "running" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-600"}`}>
                  {data.lastAiImport.status === "success" ? "Thành công" : data.lastAiImport.status === "running" ? "Đang chạy" : "Thất bại"}
                </span>
                <span className="font-bold text-[var(--text-secondary)]">{data.lastAiImport.model ?? "gemini"}</span>
                <span className="text-[var(--text-muted)] text-xs">{new Date(data.lastAiImport.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Chưa có lượt import nào</p>
            )}
          </div>

          <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-5">
            <h2 className="text-sm font-black text-[var(--text-primary)] mb-3">Cấu hình môi trường</h2>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">AUTH_SECRET</span>
                <span className={`font-bold ${data.env.nextAuthSecretSet ? "text-emerald-600" : "text-red-500"}`}>{data.env.nextAuthSecretSet ? "Đã đặt" : "CHƯA ĐẶT"}</span>
              </div>
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">GEMINI_API_KEY</span>
                <span className={`font-bold ${data.env.geminiKeySet ? "text-emerald-600" : "text-red-500"}`}>{data.env.geminiKeySet ? "Đã đặt" : "CHƯA ĐẶT"}</span>
              </div>
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">NODE_ENV</span>
                <span className="font-bold text-[var(--text-secondary)]">{data.env.nodeEnv}</span>
              </div>
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Thời gian server</span>
                <span className="font-bold text-[var(--text-secondary)]">{new Date(data.now).toLocaleString("vi-VN")}</span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}