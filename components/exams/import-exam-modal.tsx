"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock3, FileUp, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";
import { importExamFile, type ImportStage } from "@/lib/import-exam";

type View = "select" | "processing" | "done" | "error";
type ImportedPayload = { title?: unknown; questions?: unknown[] };

const STAGES: { key: ImportStage; label: string }[] = [
  { key: "upload", label: "Tải file lên" },
  { key: "extract", label: "Đọc nội dung" },
  { key: "analyze", label: "AI đang phân tích" },
  { key: "check", label: "Kiểm tra câu hỏi" },
  { key: "done", label: "Hoàn tất" },
];

function parseResult(result: string): ImportedPayload {
  const cleaned = result.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as ImportedPayload;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.questions)) {
    throw new Error("AI trả về dữ liệu không hợp lệ");
  }
  return parsed;
}

export function ImportExamModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (parsed: ImportedPayload) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("select");
  const [file, setFile] = useState<File | null>(null);
  const [activeStage, setActiveStage] = useState<ImportStage | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const reset = () => {
    setView("select"); setFile(null); setActiveStage(null); setElapsed(0); setError("");
  };
  const close = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (!open || view !== "processing") return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [open, view]);

  if (!open) return null;

  const choose = async (next: File | undefined) => {
    if (!next) return;
    if (!/\.(pdf|docx)$/i.test(next.name)) { setError("Chỉ hỗ trợ PDF hoặc Word (.docx)."); setView("error"); return; }
    setFile(next); setError(""); setActiveStage("upload"); setElapsed(0); setView("processing");
    try {
      const { result } = await importExamFile(next, (s) => setActiveStage(s));
      const parsed = parseResult(result);
      setActiveStage("done");
      setView("done");
      window.setTimeout(() => {
        onSuccess(parsed);
        close();
      }, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể import đề.");
      setActiveStage(null);
      setView("error");
    }
  };

  const stageIndex = (key: ImportStage) => STAGES.findIndex((s) => s.key === key);
  const activeIndex = activeStage ? stageIndex(activeStage) : -1;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[3px]">
      <div role="dialog" aria-modal="true" className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
          <div><div className="mb-1 flex items-center gap-2 text-sm font-semibold text-violet-600"><FileUp size={17}/> Import đề thi</div><h2 className="text-xl font-bold text-slate-900">Tải đề PDF / Word lên</h2><p className="mt-1 text-sm text-slate-500">File được xử lý theo từng bước, không cần làm gì thêm.</p></div>
          <button type="button" onClick={close} disabled={view === "processing"} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={20}/></button>
        </div>
        <div className="p-5 sm:p-7">
          {view === "select" ? (
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
                  {view === "done" ? <Check size={25} /> : view === "error" ? <X size={24} /> : <Loader2 size={25} className="animate-spin" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">{view === "processing" ? "Đang xử lý đề..." : view === "done" ? "Import đề hoàn tất" : "Import đề thất bại"}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{file?.name}</p>
                </div>
              </div>

              {view === "processing" || view === "done" ? (
                <ol className="mt-6 flex flex-col gap-2.5">
                  {STAGES.map((stage, i) => {
                    const isDone = view === "done" || i < activeIndex;
                    const isActive = view !== "done" && i === activeIndex;
                    return (
                      <li key={stage.key} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-100">
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${isDone ? "bg-emerald-100 text-emerald-600" : isActive ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-400"}`}>
                          {isDone ? <Check size={13} /> : isActive ? <Loader2 size={13} className="animate-spin" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                        </span>
                        <span className={`font-medium ${isActive ? "text-violet-700" : isDone ? "text-slate-700" : "text-slate-400"}`}>{stage.label}</span>
                        {isActive && <span className="ml-auto text-xs font-semibold text-violet-600">đang xử lý</span>}
                        {isDone && view === "done" && <span className="ml-auto text-xs font-semibold text-emerald-600">hoàn tất</span>}
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              {view === "processing" && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-100">
                  <Clock3 size={15} className="text-violet-500" /> Đã chạy {elapsed}s
                </div>
              )}

              {view === "error" && error && (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
              )}

              {view === "error" && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void choose(file ?? undefined)}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    <RotateCcw size={15}/> Thử lại
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <UploadCloud size={15}/> Chọn file khác
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}