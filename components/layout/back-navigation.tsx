"use client";

import { ArrowLeft, CheckCircle2, Clock3, FileUp, Loader2, UploadCloud, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const IMPORT_TRIGGER_TEXT = "import pdf/word";
const IMPORT_ENDPOINT = "/api/gemini";

function formatEta(seconds: number) {
  if (seconds <= 0) return "Sắp hoàn tất...";
  return `Còn khoảng ${Math.max(1, Math.ceil(seconds))} giây`;
}

export function BackNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [importOpen, setImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [eta, setEta] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importStartedRef = useRef(false);

  // Dashboard root is already the top-level destination, so don't show a back control.
  // The import modal is still mounted on dashboard pages so it can intercept the existing
  // "Import PDF/Word" action without forcing every page to implement its own modal.
  const showBack = !!pathname && pathname !== "/bang-dieu-khien";

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/bang-dieu-khien");
  };

  const openImport = () => {
    setImportOpen(true);
    setSelectedFile(null);
    setProgress(0);
    setImporting(false);
    setDone(false);
    setError("");
    setEta("");
    setElapsed(0);
    importStartedRef.current = false;
  };

  const closeImport = () => {
    if (importing) return;
    setImportOpen(false);
    setSelectedFile(null);
    setError("");
  };

  const triggerExistingImporter = (file: File) => {
    const existingInput = document.querySelector<HTMLInputElement>(
      'input[type="file"][accept*=".pdf"], input[type="file"][accept*=".docx"], input[type="file"]'
    );

    if (!existingInput) {
      setError("Không tìm thấy trình nhập đề hiện tại. Vui lòng tải lại trang rồi thử lại.");
      setImporting(false);
      return;
    }

    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      existingInput.value = "";
      existingInput.files = transfer.files;
      existingInput.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {
      setError("Không thể gửi file vào trình nhập đề. Vui lòng thử lại.");
      setImporting(false);
    }
  };

  const startImport = (file: File) => {
    const valid = /\.(pdf|docx)$/i.test(file.name);
    if (!valid) {
      setError("Chỉ hỗ trợ file PDF hoặc Word (.docx).");
      return;
    }

    setSelectedFile(file);
    setError("");
    setDone(false);
    setImporting(true);
    setProgress(12);
    setElapsed(0);
    setEta("Đang chuẩn bị file...");
    importStartedRef.current = true;
    triggerExistingImporter(file);
  };

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest("button, a, label, [role='button']") as HTMLElement | null;
      if (!trigger) return;

      const text = (trigger.textContent || "").trim().toLowerCase();
      if (!text.includes(IMPORT_TRIGGER_TEXT)) return;

      event.preventDefault();
      event.stopPropagation();
      openImport();
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  // Observe the existing import request so the modal reflects the real end-to-end operation.
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const input = args[0];
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
      const isImportRequest = importStartedRef.current && url.includes(IMPORT_ENDPOINT);

      if (!isImportRequest) return originalFetch(...args);

      setProgress(28);
      setEta("AI đang bắt đầu đọc đề...");

      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          setError("Không thể xử lý đề. Hãy kiểm tra file rồi thử lại.");
          setImporting(false);
          importStartedRef.current = false;
          return response;
        }

        setProgress(96);
        setEta("Đang hoàn tất và đưa câu hỏi vào đề...");
        return response;
      } catch (fetchError) {
        setError("Mất kết nối trong lúc import. Vui lòng thử lại.");
        setImporting(false);
        importStartedRef.current = false;
        throw fetchError;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (!importing) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(Math.floor(seconds));

      // This is an estimated processing progress, not a fake network-byte counter.
      // It deliberately eases toward 92% while AI processing is running and waits for
      // the real API response before showing 100%.
      setProgress((current) => {
        if (current >= 92 || done) return current;
        const next = current + Math.max(0.4, (92 - current) * 0.035);
        return Math.min(92, next);
      });

      const estimatedSeconds = selectedFile
        ? Math.min(35, Math.max(8, 8 + selectedFile.size / 180000))
        : 12;
      setEta(formatEta(estimatedSeconds - seconds));
    }, 250);

    return () => window.clearInterval(timer);
  }, [importing, selectedFile, done]);

  useEffect(() => {
    if (!importing || progress < 96 || error) return;

    const finishTimer = window.setTimeout(() => {
      setProgress(100);
      setDone(true);
      setImporting(false);
      setEta("Đã xử lý xong");
      importStartedRef.current = false;

      window.setTimeout(() => {
        setImportOpen(false);
        setSelectedFile(null);
      }, 900);
    }, 250);

    return () => window.clearTimeout(finishTimer);
  }, [importing, progress, error]);

  if (!showBack && !importOpen) return null;

  return (
    <>
      {showBack && (
        <div className="px-5 lg:px-8 pt-4 pb-1">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] px-3 text-xs font-bold text-[var(--text-secondary)] shadow-sm transition hover:bg-[var(--gray-100)] hover:text-[var(--text-primary)] active:scale-[0.98]"
            aria-label="Quay lại trang trước"
            title="Quay lại"
          >
            <ArrowLeft size={15} />
            <span>Quay lại</span>
          </button>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[3px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-exam-title"
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-violet-600">
                  <FileUp size={17} /> Import đề thi
                </div>
                <h2 id="import-exam-title" className="text-xl font-bold text-slate-900">
                  Tải đề PDF / Word lên
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  AI sẽ đọc file và tự đưa câu hỏi vào trình tạo đề.
                </p>
              </div>
              <button
                type="button"
                onClick={closeImport}
                disabled={importing}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-7">
              {!importing && !done && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const file = event.dataTransfer.files?.[0];
                      if (file) startImport(file);
                    }}
                    className="group flex min-h-[250px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 px-5 text-center transition hover:border-violet-400 hover:bg-violet-50"
                  >
                    <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm ring-1 ring-violet-100 transition group-hover:scale-105">
                      <UploadCloud size={31} />
                    </span>
                    <span className="text-base font-bold text-slate-800">Kéo thả đề vào đây</span>
                    <span className="mt-1 text-sm text-slate-500">hoặc nhấn để chọn file từ thiết bị</span>
                    <span className="mt-4 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
                      Chọn file PDF / Word
                    </span>
                    <span className="mt-3 text-xs text-slate-400">Hỗ trợ .pdf và .docx</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) startImport(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </>
              )}

              {(importing || done) && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                      {done ? <CheckCircle2 size={25} /> : <Loader2 size={25} className="animate-spin" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">
                        {done ? "Import đề hoàn tất" : "Đang xử lý đề thi..."}
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-500">{selectedFile?.name}</p>
                    </div>
                    <span className="text-lg font-extrabold text-violet-600">{Math.round(progress)}%</span>
                  </div>

                  <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-[width] duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">
                      {done ? "Đã đưa câu hỏi vào trình tạo đề." : "AI đang đọc và phân tích câu hỏi..."}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-slate-500">
                      <Clock3 size={14} /> {done ? `${elapsed}s` : eta}
                    </span>
                  </div>

                  {!done && (
                    <p className="mt-3 text-xs leading-5 text-slate-400">
                      Thời gian còn lại là ước tính và có thể thay đổi tùy kích thước đề và tốc độ xử lý AI.
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
