"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface Setting {
  key: string;
  value: string;
  updatedAt: string;
}

const FIELDS: { key: string; label: string; hint: string; type?: "text" }[] = [
  { key: "siteName", label: "Tên trang web", hint: "Hiển thị trên tiêu đề & trang chủ" },
  { key: "siteDescription", label: "Mô tả trang", hint: "Mô tả ngắn hiển thị ở trang chủ" },
  { key: "allowGuestAttempts", label: "Cho phép khách làm bài", hint: "true / false — mặc định cho khách làm bài không cần đăng nhập" },
  { key: "maintenanceMode", label: "Chế độ bảo trì", hint: "true / false — dùng để đóng hệ thống tạm thời" },
  { key: "exposeResetLink", label: "Hiện liên kết đặt lại mật khẩu (demo)", hint: "true / false — chỉ nên bật khi demo không có email; KHÔNG bật ở production" },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
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

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
        <Settings size={20} className="text-[#6C63FF]" /> Cài đặt hệ thống
      </h1>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {saved && <p className="mb-3 text-sm text-emerald-600">{saved}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-32"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="rounded-2xl bg-white border border-slate-200 p-5">
              <p className="text-sm font-bold text-slate-800">{f.label}</p>
              <p className="text-xs text-slate-400 mb-2">{f.hint}</p>
              <div className="flex gap-2">
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
            </div>
          ))}
          <p className="text-[11px] text-slate-400">
            Lưu ý: các giá trị được lưu trong bảng SystemSetting (database). maintenanceMode hiện chỉ hiển thị ở trang quản trị.
          </p>
        </div>
      )}
    </div>
  );
}