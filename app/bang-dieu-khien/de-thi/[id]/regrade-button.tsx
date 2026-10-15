"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface RegradeButtonProps {
  examId: string;
}

export function RegradeButton({ examId }: RegradeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    if (!confirm("Chấm lại toàn bộ bài nộp theo công thức điểm hiện tại? Điểm cũ sẽ được tính lại.")) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/exams/${examId}/regrade`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Đã chấm lại ${data.regraded ?? 0} bài.`);
        router.refresh();
      } else {
        setMsg(data.error || "Không chấm lại được.");
      }
    } catch {
      setMsg("Lỗi kết nối. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--primary-light)] hover:text-[var(--primary)] disabled:opacity-50"
      >
        {loading ? <Spinner size="sm" /> : <RefreshCw size={13} />}
        Chấm lại toàn bộ
      </button>
      {msg && <span className="text-xs text-[var(--text-muted)]">{msg}</span>}
    </div>
  );
}
