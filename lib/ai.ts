export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite"];

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