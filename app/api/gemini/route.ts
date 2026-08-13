import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

const geminiModel = process.env.EXAM_IMPORT_MODEL || "gemini-3.5-flash-lite";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const INLINE_PDF_BYTES = 20 * 1024 * 1024;

const extractionPrompt = `Bạn là bộ máy nhập đề thi của EduTest.
Trích xuất CÁC CÂU HỎI ĐÃ CÓ SẴN trong tài liệu và tự nhận diện loại câu hỏi.

Loại hợp lệ: mcq, true_false, short_answer, essay.
- mcq: trắc nghiệm 1 đáp án đúng, options A-D, answer là A/B/C/D.
- true_false: câu Đúng/Sai; grading.statements là danh sách mệnh đề, mỗi mệnh đề có text và answer boolean.
- short_answer: trả lời ngắn; grading.acceptedAnswers là danh sách các đáp án được chấp nhận.
- essay: tự luận; không cần đáp án tự động.

QUY TẮC:
- Không tự tạo câu hỏi mới.
- Giữ nguyên nội dung và đáp án có trong tài liệu.
- Nếu không xác định được đáp án, để answer là chuỗi rỗng.
- title lấy tên đề nếu có, nếu không là "Đề thi mới".
- Không giải bài, không giải thích, không thêm nội dung ngoài tài liệu.
- Chỉ trả về JSON đúng response schema.
`;

const responseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["mcq", "true_false", "short_answer", "essay"] },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          points: { type: "number" },
          grading: {
            type: "object",
            properties: {
              statements: {
                type: "array",
                items: {
                  type: "object",
                  properties: { text: { type: "string" }, answer: { type: "boolean" } },
                  required: ["text", "answer"],
                },
              },
              acceptedAnswers: { type: "array", items: { type: "string" } },
            },
          },
        },
        required: ["type", "question", "options", "answer"],
      },
    },
  },
  required: ["title", "questions"],
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const generationConfig = () => ({ responseMimeType: "application/json", responseSchema, maxOutputTokens: 32768 });

function mimeTypeFor(file: File) {
  if (file.name.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (file.name.toLowerCase().endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return file.type || "application/octet-stream";
}

async function generateFromPdf(buffer: Buffer, mimeType: string, fileName: string) {
  if (buffer.byteLength <= INLINE_PDF_BYTES) {
    const result = await ai.models.generateContent({ model: geminiModel, contents: [extractionPrompt, { inlineData: { data: buffer.toString("base64"), mimeType } }], config: generationConfig() });
    return result.text;
  }
  const safeBytes = new Uint8Array(buffer.byteLength);
  safeBytes.set(buffer);
  const uploaded = await ai.files.upload({ file: new Blob([safeBytes.buffer], { type: mimeType }), config: { displayName: fileName, mimeType } });
  let processed = uploaded;
  while (processed.state === "PROCESSING") { await new Promise((resolve) => setTimeout(resolve, 500)); processed = await ai.files.get({ name: uploaded.name! }); }
  if (processed.state === "FAILED") throw new Error("Gemini không xử lý được file PDF");
  try {
    const result = await ai.models.generateContent({ model: geminiModel, contents: [extractionPrompt, { fileData: { fileUri: processed.uri!, mimeType: processed.mimeType || mimeType } }], config: generationConfig() });
    return result.text;
  } finally {
    try { if (processed.name) await ai.files.delete({ name: processed.name }); } catch { /* ignore cleanup */ }
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Thiếu GEMINI_API_KEY" }, { status: 500 });
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const prompt = (formData.get("prompt") as string | null)?.trim();
    if (!file && !prompt) return NextResponse.json({ error: "Thiếu file hoặc nội dung cần xử lý" }, { status: 400 });

    let resultText: string;
    let source: "docx" | "pdf-inline" | "pdf-file-api" | "text" = "text";

    if (file) {
      if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "File quá lớn. Vui lòng chọn file dưới 50 MB." }, { status: 413 });
      const buffer = Buffer.from(await file.arrayBuffer());
      const lowerName = file.name.toLowerCase();
      const isDocx = lowerName.endsWith(".docx");
      const isPdf = lowerName.endsWith(".pdf");
      const mimeType = mimeTypeFor(file);
      if (!isDocx && !isPdf) return NextResponse.json({ error: "Chỉ hỗ trợ file PDF hoặc Word (.docx)" }, { status: 400 });

      if (isDocx) {
        const docx = await mammoth.extractRawText({ buffer });
        const content = docx.value.trim();
        if (!content) return NextResponse.json({ error: "Không đọc được nội dung trong file Word" }, { status: 400 });
        console.info(`[exam-import] docx extracted ${content.length} chars; model=${geminiModel}`);
        const result = await ai.models.generateContent({ model: geminiModel, contents: `${extractionPrompt}\n\nNỘI DUNG ĐỀ:\n${content}`, config: generationConfig() });
        resultText = result.text;
        source = "docx";
      } else {
        source = buffer.byteLength <= INLINE_PDF_BYTES ? "pdf-inline" : "pdf-file-api";
        console.info(`[exam-import] pdf ${Math.round(buffer.byteLength / 1024 / 1024)}MB; source=${source}; model=${geminiModel}`);
        resultText = await generateFromPdf(buffer, mimeType, file.name);
      }
    } else {
      const result = await ai.models.generateContent({ model: geminiModel, contents: `${extractionPrompt}\n\nNỘI DUNG:\n${prompt!}`, config: generationConfig() });
      resultText = result.text;
    }

    if (!resultText?.trim()) return NextResponse.json({ error: "AI không trả về dữ liệu câu hỏi" }, { status: 422 });
    const elapsedMs = Date.now() - startedAt;
    console.info(`[exam-import] completed in ${elapsedMs}ms; model=${geminiModel}; source=${source}`);
    return NextResponse.json({ result: resultText, meta: { model: geminiModel, source, elapsedMs } });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    console.error(`[exam-import] failed after ${elapsedMs}ms`, error);
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    if (/429|rate.?limit|quota/i.test(message)) return NextResponse.json({ error: "Gemini đang quá tải hoặc hết quota. Vui lòng thử lại sau ít phút." }, { status: 429 });
    if (/timeout|timed out|deadline/i.test(message)) return NextResponse.json({ error: "Gemini xử lý tài liệu quá lâu. Hãy thử file ngắn hơn hoặc PDF dưới 20 MB." }, { status: 504 });
    return NextResponse.json({ error: `Không thể import đề: ${message.slice(0, 300)}` }, { status: 500 });
  }
}
