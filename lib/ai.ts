export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
/* Google đang khai tử dần dòng lite cũ: 2.0-flash-lite chết hẳn, 2.5-flash-lite
 * báo "no longer available to new users" với key này (log prod 2026-10-11).
 * Chỉ giữ model Google còn khuyến nghị; khi cả chuỗi fail sẽ lọt lỗi THẬT
 * (quota/quá tải) ra mapError thay vì 404 đánh lạc hướng. */
/* Ứng viên duy nhất có cơ sở: gemini-3.1-flash-lite đang chạy tốt qua
 * Interactions API ở agent ai-coach — sẽ kiểm chứng 1 lần qua generateContent,
 * 404 thì gỡ. */
export const FALLBACK_MODELS: string[] = ["gemini-3.1-flash-lite"];

export function modelChain(): string[] {
  const configured = process.env.EXAM_IMPORT_MODEL?.trim();
  const chain = configured
    ? [configured, ...FALLBACK_MODELS.filter((m) => m !== configured)]
    : [DEFAULT_MODEL, ...FALLBACK_MODELS];
  return chain;
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export async function generateWithRetry<T>(
  runner: (model: string) => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs = 800, timeoutMs = 45_000 } = opts;
  const models = modelChain();
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    for (const model of models) {
      try {
        const result = await withTimeout(runner(model), timeoutMs, `AI phản hồi quá lâu (${model})`);
        return result;
      } catch (err) {
        lastErr = err;
        if (attempt < attempts - 1) {
          await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
        }
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("AI không phản hồi");
}