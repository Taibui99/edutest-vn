"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, MonitorPlay, Power, RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface LiveState {
  enabled: boolean;
  liveUrl: string | null;
  qrUrl: string | null;
}

/* LIVE-1 — nút "Mở bảng điểm trực tiếp" ở trang chi tiết đề. Bật/tạo token,
 * xoay token (đóng link cũ) hoặc thu hồi. Link không cần đăng nhập nên giao
 * cho người chiếu (cô/chú) — chỉ nên gửi cho người tin tưởng. */
export function LiveBoardButton({ examId }: { examId: string }) {
  const [state, setState] = useState<LiveState>({ enabled: false, liveUrl: null, qrUrl: null });
  const [loading, setLoading] = useState<"load" | "enable" | "rotate" | "disable" | null>("load");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Không set state đồng bộ trong effect: trạng thái khởi tạo đã là "load".
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exams/${examId}/live`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setState({ enabled: !!data.enabled, liveUrl: data.liveUrl ?? null, qrUrl: data.qrUrl ?? null });
      else setError(data.error || "Không đọc được trạng thái bảng điểm.");
    } catch {
      setError("Lỗi kết nối. Thử lại sau.");
    } finally {
      setLoading(null);
    }
  }, [examId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const call = async (action: "enable" | "rotate" | "disable") => {
    if (action === "disable" && !confirm("Tắt bảng điểm? Link chiếu sẽ ngừng hoạt động ngay.")) return;
    if (action === "rotate" && !confirm("Đổi link mới? Link cũ (đang mở trên tivi) sẽ ngừng hoạt động.")) return;
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState({ enabled: !!data.enabled, liveUrl: data.liveUrl ?? null, qrUrl: data.qrUrl ?? null });
        setCopied(false);
      } else {
        setError(data.error || "Không thực hiện được.");
      }
    } catch {
      setError("Lỗi kết nối. Thử lại sau.");
    } finally {
      setLoading(null);
    }
  };

  const copy = async () => {
    if (!state.liveUrl) return;
    try {
      await navigator.clipboard.writeText(state.liveUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Trình duyệt chặn sao chép — hãy copy thủ công.");
    }
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-[0.98] disabled:opacity-50";

  return (
    <div className="p-4 sm:p-5" style={{ borderTop: "1px solid var(--surface-border)" }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
            <MonitorPlay size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
              Bảng điểm trực tiếp
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Link bí mật, không cần đăng nhập — mở trên tivi ở lớp, tự làm mới vài giây. Chỉ hiện bài đã nộp.
            </p>
            {error && <p className="mt-1.5 text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-2">
          {!state.enabled ? (
            <button type="button" onClick={() => void call("enable")} disabled={loading !== null} className={`${btn} text-white`} style={{ background: "var(--primary)" }}>
              {loading === "enable" ? <Spinner size="sm" /> : <MonitorPlay size={14} />}
              Bật bảng điểm
            </button>
          ) : (
            <>
              <button type="button" onClick={copy} disabled={loading !== null} className={btn} style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Đã copy" : "Copy link"}
              </button>
              <button type="button" onClick={() => void call("rotate")} disabled={loading !== null} className={btn} style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
                {loading === "rotate" ? <Spinner size="sm" /> : <RefreshCw size={14} />}
                Đổi link
              </button>
              <button type="button" onClick={() => void call("disable")} disabled={loading !== null} className={btn} style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                {loading === "disable" ? <Spinner size="sm" /> : <Power size={14} />}
                Tắt
              </button>
            </>
          )}
        </div>
      </div>

      {loading === "load" && !error && <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>Đang kiểm tra trạng thái…</p>}

      {state.enabled && state.liveUrl && (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl p-3" style={{ background: "var(--blue-light)", border: "1px solid var(--surface-border)" }}>
          {state.qrUrl && (
            <div className="rounded-xl bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.qrUrl} alt="QR bảng điểm trực tiếp" width={104} height={104} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              <Link2 size={12} className="inline mr-1" />
              Link chiếu
            </p>
            <p className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {state.liveUrl.replace(/^https?:\/\//, "")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={state.liveUrl} target="_blank" rel="noopener noreferrer" className={`${btn} text-white`} style={{ background: "var(--primary)" }}>
                <ExternalLink size={13} /> Mở thử
              </a>
              <span className="rounded-lg px-2 py-1 text-[11px] font-bold" style={{ background: "rgba(255,255,255,.7)", color: "var(--text-muted)" }}>
                Không đăng nhập · không index
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
