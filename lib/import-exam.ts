export type ImportStage = "upload" | "extract" | "analyze" | "solve" | "check" | "done";

export type ImportMode = "smart" | "generate";

/* AI-6f — hai đường upload:
 * - ≤4MB: gửi thẳng File qua Vercel như cũ (nhanh, ít bước).
 * - 4–25MB: Vercel chặn body trên ~4.5MB nên up thẳng lên Supabase qua signed
 *   URL (`/api/uploads/sign`), rồi gọi API bằng storagePath (body nhỏ).
 * - Trên 25MB: báo lỗi rõ + hướng xử lý (nén/chia/dán text). */
export const MAX_DIRECT_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export function uploadTooLarge(file: File | null): boolean {
  return !!file && file.size > MAX_UPLOAD_BYTES;
}

function mb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Up file lớn thẳng lên Supabase, trả về storagePath để gọi API. */
async function uploadViaStorage(file: File, onStage: (stage: ImportStage) => void): Promise<string> {
  onStage("upload");
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size }),
  });
  const sign = (await signRes.json().catch(() => ({}))) as { path?: string; signedUrl?: string; error?: string };
  if (!signRes.ok || !sign.path || !sign.signedUrl) {
    throw new Error(typeof sign.error === "string" ? sign.error : "Không xin được link tải file lên");
  }
  const put = await fetch(sign.signedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!put.ok) throw new Error("Tải file lên kho thất bại. Thử lại sau nhé!");
  return sign.path;
}

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
  opts: { mode?: ImportMode; options?: GenerateOptions; text?: string; forceProvider?: "groq" } = {},
): Promise<{ result: string; meta?: Record<string, unknown> }> {
  const mode = opts.mode ?? "smart";
  const timeout = mode === "generate" ? GENERATE_TIMEOUT_MS : SMART_TIMEOUT_MS;
  if (file && file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File nặng ${mb(file.size)}, vượt quá 25 MB cho phép. Hãy chia nhỏ tài liệu, hoặc copy đoạn cần thiết dán vào ô văn bản.`,
    );
  }

  // File lớn đi đường storage để không vỡ tường 4.5MB của Vercel.
  let storagePath: string | null = null;
  if (file && file.size > MAX_DIRECT_BYTES) {
    storagePath = await uploadViaStorage(file, onStage);
  } else {
    onStage(mode === "generate" && file ? "upload" : "extract");
  }

  // AI-8 test hook: ép engine để A/B (chỉ GV gọi được API này).
  const force = opts.forceProvider === "groq" ? "groq" : undefined;
  const body: BodyInit =
    storagePath !== null
      ? JSON.stringify({
          storagePath,
          mode,
          options: mode === "generate" ? (opts.options ?? {}) : undefined,
          prompt: opts.text?.trim() || undefined,
          ...(force ? { forceProvider: force } : {}),
        })
      : (() => {
          const form = new FormData();
          if (file) form.append("file", file);
          if (opts.text?.trim()) form.append("prompt", opts.text.trim());
          form.append("mode", mode);
          if (mode === "generate") form.append("options", JSON.stringify(opts.options ?? {}));
          if (force) form.append("forceProvider", force);
          return form;
        })();

  const res = await withTimeout(
    fetch("/api/gemini", {
      method: "POST",
      body,
      ...(storagePath !== null ? { headers: { "Content-Type": "application/json" } } : {}),
    }),
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
