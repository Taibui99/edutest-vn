export type ImportStage = "upload" | "extract" | "analyze" | "solve" | "check" | "done";

export type ImportMode = "smart" | "generate";

export type GenerateOptions = {
  subject?: string;
  grade?: string;
  count?: number;
  types?: string[];
  withExplanation?: boolean;
  customNote?: string;
  focus?: string;
};

const GENERATE_TIMEOUT_MS = 240_000;
// Smart import chạy nhiều lượt Gemini (đọc tài liệu → 2 lượt giải → phá thế hoản) nên cần thời gian dài hơn.
const SMART_TIMEOUT_MS = 420_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export type SmartProgress = { stage: ImportStage; done?: number; total?: number };

type StreamEvent = {
  type?: string;
  stage?: ImportStage;
  error?: string;
  result?: string;
  meta?: Record<string, unknown>;
};

export async function importExamFile(
  file: File | null,
  onStage: (stage: ImportStage, progress?: { done?: number; total?: number }) => void,
  opts: { mode?: ImportMode; options?: GenerateOptions; text?: string } = {},
): Promise<{ result: string; meta?: Record<string, unknown> }> {
  const mode = opts.mode ?? "smart";
  const timeout = mode === "generate" ? GENERATE_TIMEOUT_MS : SMART_TIMEOUT_MS;
  onStage(mode === "generate" && file ? "upload" : "extract");

  const form = new FormData();
  if (file) form.append("file", file);
  if (opts.text?.trim()) form.append("prompt", opts.text.trim());
  form.append("mode", mode);
  if (mode === "generate") form.append("options", JSON.stringify(opts.options ?? {}));

  const res = await withTimeout(
    fetch("/api/gemini", { method: "POST", body: form }),
    timeout,
    mode === "generate"
      ? "AI soạn đề quá lâu. Thử giảm số câu hoặc rút gọn tài liệu."
      : "AI đọc tài liệu quá lâu. Tài liệu càng dài càng mất nhiều thời gian, thử chia nhỏ tài liệu.",
  );

  if (!res.ok || !res.body) {
    let msg = mode === "generate" ? "Không thể soạn đề" : "Không thể đọc tài liệu";
    try {
      const data = await res.json();
      if (data?.error) msg = String(data.error);
    } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: string | null = null;
  let meta: Record<string, unknown> | undefined;

  while (true) {
    const { done, value } = await withTimeout(
      reader.read(),
      timeout,
      "Yêu cầu quá lâu, vui lòng thử lại.",
    );
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let evt: StreamEvent;
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }
      if (evt.type === "stage" && evt.stage) {
        const meta = (evt.meta ?? {}) as { done?: number; total?: number };
        onStage(evt.stage, { done: meta.done, total: meta.total });
      } else if (evt.type === "error") throw new Error(evt.error || "Tạo đề thất bại");
      else if (evt.type === "result") {
        result = evt.result ?? null;
        meta = evt.meta;
      }
    }
  }

  if (!result) throw new Error("AI không trả về dữ liệu câu hỏi");
  return { result, meta };
}
