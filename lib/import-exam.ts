export type ImportStage = "upload" | "extract" | "analyze" | "check" | "done";

const CLIENT_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

type StreamEvent = {
  type?: string;
  stage?: ImportStage;
  error?: string;
  result?: string;
  meta?: Record<string, unknown>;
};

export async function importExamFile(
  file: File,
  onStage: (stage: ImportStage) => void,
): Promise<{ result: string; meta?: Record<string, unknown> }> {
  onStage("upload");

  const form = new FormData();
  form.append("file", file);
  const res = await withTimeout(
    fetch("/api/gemini", { method: "POST", body: form }),
    CLIENT_TIMEOUT_MS,
    "Import mất quá nhiều thời gian, vui lòng thử lại.",
  );

  if (!res.ok || !res.body) {
    let msg = "Không thể import đề";
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
      CLIENT_TIMEOUT_MS,
      "Import mất quá nhiều thời gian, vui lòng thử lại.",
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
      if (evt.type === "stage" && evt.stage) onStage(evt.stage);
      else if (evt.type === "error") throw new Error(evt.error || "Import đề thất bại");
      else if (evt.type === "result") {
        result = evt.result ?? null;
        meta = evt.meta;
      }
    }
  }

  if (!result) throw new Error("AI không trả về dữ liệu câu hỏi");
  return { result, meta };
}
