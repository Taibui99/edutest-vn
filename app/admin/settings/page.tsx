"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings, AlertTriangle, KeyRound, FileText, Sparkles, Users, Wrench } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Setting {
  key: string;
  value: string;
  updatedAt: string;
}

type TabKey = "general" | "auth" | "exams" | "ai" | "maintenance";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "general", label: "General", icon: <Settings size={14} /> },
  { key: "auth", label: "Authentication", icon: <KeyRound size={14} /> },
  { key: "exams", label: "Exams", icon: <FileText size={14} /> },
  { key: "ai", label: "AI", icon: <Sparkles size={14} /> },
  { key: "maintenance", label: "Maintenance", icon: <Wrench size={14} /> },
];

interface TextField {
  key: string;
  label: string;
  hint: string;
  type: "text";
}
interface ToggleField {
  key: string;
  label: string;
  hint: string;
  type: "toggle";
}

type Field = TextField | ToggleField;

const FIELDS: Record<TabKey, Field[]> = {
  general: [
    { key: "siteName", label: "Tên trang web", hint: "Hiển thị trên tiêu đề & trang chủ", type: "text" },
    { key: "siteDescription", label: "Mô tả trang", hint: "Mô tả ngắn hiển thị ở trang chủ", type: "text" },
  ],
  auth: [
    { key: "allowRegistration", label: "Cho phép đăng ký tài khoản mới", hint: "Bật để người dùng mới có thể tự đăng ký", type: "toggle" },
    { key: "exposeResetLink", label: "Hiện liên kết đặt lại mật khẩu (demo)", hint: "Chỉ bật khi demo không có email; KHÔNG bật ở production", type: "toggle" },
  ],
  exams: [
    { key: "allowGuestAttempts", label: "Cho phép khách làm bài (mặc định)", hint: "Giá trị mặc định cho đề mới; giáo viên có thể đổi từng đề", type: "toggle" },
  ],
  ai: [
    { key: "enableAiImport", label: "Cho phép AI import đề thi", hint: "Tắt để tạm khóa tính năng nhập đề bằng AI (Gemini)", type: "toggle" },
  ],
  maintenance: [
    { key: "maintenanceMode", label: "Chế độ bảo trì", hint: "Khi bật, toàn bộ website hiện trang bảo trì — admin vẫn truy cập được /admin", type: "toggle" },
  ],
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabKey>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Forbidden");
      const data = await res.json();
      const map: Record<string, string> = {};
      for (const s of data.settings as Setting[]) map[s.key] = s.value;
      setSettings(map);
    } catch {
      setError("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (key: string, value: string) => {
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Lỗi lưu");
        return;
      }
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSaved(`Đã lưu "${key}"`);
    } finally {
      setSaving(false);
    }
  };

  const boolValue = (key: string) => settings[key] === "true";

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <Settings size={20} className="text-[#6C63FF]" /> Cài đặt hệ thống
      </h1>

      <div className="flex gap-1.5 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${tab === t.key ? "bg-[#6C63FF] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-[#6C63FF]/40"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {settings.maintenanceMode === "true" && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-700">
          <AlertTriangle size={16} /> Website đang ở chế độ bảo trì — người dùng thường thấy trang bảo trì.
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {saved && <p className="mb-3 text-sm text-emerald-600">{saved}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-4">
          {FIELDS[tab].map((f) => (
            <div key={f.key} className="rounded-2xl bg-white border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">{f.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{f.hint}</p>
                </div>
                {f.type === "toggle" ? (
                  <button
                    onClick={() => save(f.key, boolValue(f.key) ? "false" : "true")}
                    disabled={saving}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${boolValue(f.key) ? "bg-[#6C63FF]" : "bg-slate-200"}`}
                    aria-label={f.label}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${boolValue(f.key) ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                ) : (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input
                      value={settings[f.key] ?? ""}
                      onChange={(e) => setSettings((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#6C63FF] focus:outline-none"
                    />
                    <button
                      onClick={() => save(f.key, settings[f.key] ?? "")}
                      disabled={saving}
                      className="rounded-lg bg-[#6C63FF] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Lưu
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                <Users size={11} /> Giá trị hiện tại: <span className="font-bold text-slate-600">{f.type === "toggle" ? (boolValue(f.key) ? "Bật" : "Tắt") : (settings[f.key] || "(trống)")}</span>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-400">
            Các giá trị được lưu trong bảng SystemSetting (database). Mọi thay đổi đều được ghi vào nhật ký quản trị.
          </p>
        </div>
      )}
    </div>
  );
}
