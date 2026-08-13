"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, FileUp, Loader2, UploadCloud, X } from "lucide-react";

type Stage = "select" | "processing" | "done" | "error";

export function ImportExamModal({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (file: File) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("select");
  const [file, setFile] = useState<File | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStage("select"); setFile(null); setElapsed(0); setError("");
  }, [open]);

  useEffect(() => {
    if (!open || stage !== "processing") return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [open, stage]);

  if (!open) return null;

  const choose = async (next: File | undefined) => {
    if (!next) return;
    if (!/\.(pdf|docx)$/i.test(next.name)) { setError("Chỉ hỗ trợ PDF hoặc Word (.docx)."); setStage("error"); return; }
    setFile(next); setError(""); setStage("processing"); setElapsed(0);
    try { await onImport(next); setStage("done"); window.setTimeout(onClose, 900); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể import đề."); setStage("error"); }
  };

  const step = stage === "select" ? 0 : stage === "processing" ? 1 : 2;
  const labels = ["Chọn file", "AI phân tích đề", "Hoàn tất"];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[3px]">
      <div role="dialog" aria-modal="true" className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
          <div><div className="mb-1 flex items-center gap-2 text-sm font-semibold text-violet-600"><FileUp size={17}/> Import đề thi</div><h2 className="text-xl font-bold text-slate-900">Tải đề PDF / Word lên</h2><p className="mt-1 text-sm text-slate-500">File sẽ được gửi trực tiếp tới bộ xử lý đề.</p></div>
          <button type="button" onClick={onClose} disabled={stage === "processing"} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={20}/></button>
        </div>
        <div className="p-5 sm:p-7">
          {stage === "select" ? (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void choose(e.dataTransfer.files?.[0]); }}
                className="group flex min-h-[250px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 px-5 text-center hover:border-violet-400 hover:bg-violet-50"
              >
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm"><UploadCloud size={31} /></span>
                <span className="text-base font-bold text-slate-800">Kéo thả đề vào đây</span>
                <span className="mt-1 text-sm text-slate-500">hoặc nhấn để chọn file từ thiết bị</span>
                <span className="mt-4 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white">Chọn file PDF / Word</span>
                <span className="mt-3 text-xs text-slate-400">Hỗ trợ .pdf và .docx</span>
              </button>
              <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; void choose(f); }} />
            </>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                  {stage === "done" ? <CheckCircle2 size={25} /> : stage === "error" ? <X size={24} /> : <Loader2 size={25} className="animate-spin" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">{stage === "processing" ? "AI đang phân tích đề..." : stage === "done" ? "Import đề hoàn tất" : "Import đề thất bại"}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{file?.name}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2">
                {labels.map((label, i) => {
                  const done = stage === "done" || i < step;
                  const active = stage === "processing" && i === 1;
                  return (
                    <div key={label} className="flex flex-col items-center gap-2 text-center">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-100 text-emerald-600" : active ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-400"}`}>
                        {done ? <CheckCircle2 size={17} /> : i + 1}
                      </div>
                      <span className={`text-xs font-semibold ${active ? "text-violet-700" : "text-slate-500"}`}>{label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-100">
                <Clock3 size={15} className="text-violet-500" /> Đã xử lý {elapsed} giây
              </div>
              {error && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
