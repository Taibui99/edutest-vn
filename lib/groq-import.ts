/**
 * AI-8 — Groq dự phòng cho đường import đề khi Gemini sập/quota (503/429).
 *
 * Chỉ dùng cho prompt CHỮ thuần (không vision, không Files API — Groq không có).
 * Model lấy cùng `GROQ_MODEL` với chat (mặc định openai/gpt-oss-120b).
 * Thử JSON mode trước, 400 thì thử lại không ép mode + tự bóc markdown.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TIMEOUT_MS = 60_000;

function cleanJson(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function groqOnce(prompt: string, jsonMode: boolean, timeoutMs: number): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Thiếu GROQ_API_KEY");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "Bạn chỉ trả về đúng 1 object JSON hợp lệ, không thêm chữ nào khác, không bọc markdown.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 24_576,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = cleanJson(data?.choices?.[0]?.message?.content?.trim() || "");
    if (!text) throw new Error("Groq trả về rỗng");
    // JSON mode hỏng mà vẫn 200 thì JSON.parse sẽ ném ở caller.
    JSON.parse(text);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Trả về chuỗi JSON (đã clean). Ném lỗi để caller rơi về mapError như cũ. */
export async function groqChatJson(prompt: string, timeoutMs = GROQ_TIMEOUT_MS): Promise<string> {
  try {
    return await groqOnce(prompt, true, timeoutMs);
  } catch {
    return await groqOnce(prompt, false, timeoutMs);
  }
}
