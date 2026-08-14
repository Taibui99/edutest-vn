import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { generateWithRetry, withTimeout } from "@/lib/ai";

const geminiModel = process.env.EXAM_IMPORT_MODEL || "gemini-3.5-flash-lite";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TEXT_CHARS = 120_000;
const MAX_MODEL_OUTPUT = 16_384;
const AI_TIMEOUT_MS = 45_000;

const extractionPrompt = `Bạn là bộ máy nhập đề thi của EduTest.
Trích xuất CÁC CÂU HỎI ĐÃ CÓ SẴN trong tài liệu và tự nhận diện loại câu hỏi.

Loại hợp lệ: mcq, true_false, short_answer, essay.
- mcq: trắc nghiệm 1 đáp án đúng, options A-D, answer là A/B/C/D.
- true_false: Đúng/Sai; grading.statements gồm text + answer boolean.
- short_answer: trả lời ngắn; grading.acceptedAnswers là các đáp án chấp nhận.
- essay: tự luận; không cần đáp án tự động.

QUY TẮC:
- Không tự tạo câu hỏi mới.
- Giữ nguyên nội dung và đáp án có trong tài liệu.
- Không giải bài, không giải thích, không thêm nội dung.
- Trả về JSON đúng response schema.`;

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
const generationConfig = () => ({ responseMimeType: "application/json", responseSchema, maxOutputTokens: MAX_MODEL_OUTPUT });
const retryOpts = { attempts: 2 };

async function extractPdfText(buffer: Buffer) {
  try {
    const parsed = await pdfParse(buffer);
    const text = parsed.text.trim();
    return text.length >= 300 ? text.slice(0, MAX_TEXT_CHARS) : "";
  } catch {
    return "";
  }
}

async function generatePdfFallback(buffer: Buffer, mimeType: string, fileName: string) {
  const safeBytes = new Uint8Array(buffer.byteLength);
  safeBytes.set(buffer);
  const uploaded = await withTimeout(
    ai.files.upload({ file: new Blob([safeBytes.buffer], { type: mimeType }), config: { displayName: fileName, mimeType } }),
    AI_TIMEOUT_MS,
    "Gemini tải PDF quá lâu",
  );
  let processed = uploaded;
  const started = Date.now();
  while (processed.state === "PROCESSING") {
    if (Date.now() - started > AI_TIMEOUT_MS) throw new Error("Gemini xử lý PDF quá lâu");
    await new Promise((resolve) => setTimeout(resolve, 400));
    processed = await ai.files.get({ name: uploaded.name! });
  }
  if (processed.state === "FAILED") throw new Error("Gemini không xử lý được file PDF");
  try {
    const resultText = await generateWithRetry(
      (model) => ai.models.generateContent({
        model,
        contents: [extractionPrompt, { fileData: { fileUri: processed.uri!, mimeType: processed.mimeType || mimeType } }],
        config: generationConfig(),
      }).then((r) => r.text),
      retryOpts,
    );
    return resultText;
  } finally {
    try { if (processed.name) await ai.files.delete({ name: processed.name }); } catch {}
  }
}

function mimeTypeFor(file: File) {
  if (file.name.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (file.name.toLowerCase().endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return file.type || "application/octet-stream";
}

function mapError(message: string) {
  if (/429|rate.?limit|quota/i.test(message)) return "Gemini đang quá tải hoặc hết quota. Vui lòng thử lại sau ít phút.";
  if (/timeout|timed out|deadline|quá lâu/i.test(message)) return message.slice(0, 300);
  return `Không thể import đề: ${message.slice(0, 300)}`;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  if (session.user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên mới được import đề" }, { status: 403 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Thiếu GEMINI_API_KEY" }, { status: 500 });
  if ((await getSetting("enableAiImport", "true")) !== "true") {
    return NextResponse.json({ error: "Tính năng AI import đang tắt bởi quản trị viên" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const prompt = (formData.get("prompt") as string | null)?.trim();
  if (!file && !prompt) return NextResponse.json({ error: "Thiếu file hoặc nội dung cần xử lý" }, { status: 400 });
  if (file) {
    if (!file.size) return NextResponse.json({ error: "File tải lên rỗng hoặc không hợp lệ" }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "File quá lớn. Vui lòng chọn file dưới 50 MB." }, { status: 413 });
  }

  const encoder = new TextEncoder();
  let aiLogId: string | null = null;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n")); } catch {}
      };

      try {
        try {
          const log = await prisma.aiImportLog.create({
            data: {
              userId: session.user.id,
              action: "exam_import",
              provider: "gemini",
              status: "running",
              model: geminiModel,
              prompt: prompt ? prompt.slice(0, 2000) : null,
            },
          });
          aiLogId = log.id;
        } catch {}
        let resultText = "";
        let source: "docx" | "pdf-text" | "pdf-gemini" | "text" = "text";

        if (file) {
          const buffer = Buffer.from(await file.arrayBuffer());
          if (!buffer.byteLength) return send({ type: "error", error: "Không đọc được dữ liệu file" });
          const lowerName = file.name.toLowerCase();
          const isDocx = lowerName.endsWith(".docx");
          const isPdf = lowerName.endsWith(".pdf");
          const mimeType = mimeTypeFor(file);
          if (!isDocx && !isPdf) return send({ type: "error", error: "Chỉ hỗ trợ file PDF hoặc Word (.docx)" });

          send({ type: "stage", stage: "extract" });

          if (isDocx) {
            const docx = await mammoth.extractRawText({ buffer });
            const content = docx.value.trim();
            if (!content) return send({ type: "error", error: "Không đọc được nội dung trong file Word" });
            console.info(`[exam-import] docx extracted ${content.length} chars; model=${geminiModel}`);
            send({ type: "stage", stage: "analyze" });
            const result = await generateWithRetry(
              (model) => ai.models.generateContent({ model, contents: `${extractionPrompt}\n\nNỘI DUNG ĐỀ:\n${content.slice(0, MAX_TEXT_CHARS)}`, config: generationConfig() }).then((r) => r.text),
              retryOpts,
            );
            resultText = result;
            source = "docx";
          } else {
            const extractedText = await extractPdfText(buffer);
            if (extractedText) {
              console.info(`[exam-import] pdf text extracted ${extractedText.length} chars; model=${geminiModel}`);
              send({ type: "stage", stage: "analyze" });
              const result = await generateWithRetry(
                (model) => ai.models.generateContent({ model, contents: `${extractionPrompt}\n\nNỘI DUNG PDF:\n${extractedText}`, config: generationConfig() }).then((r) => r.text),
                retryOpts,
              );
              resultText = result;
              source = "pdf-text";
            } else {
              console.info(`[exam-import] pdf text extraction empty; fallback=gemini; bytes=${buffer.byteLength}; model=${geminiModel}`);
              send({ type: "stage", stage: "analyze" });
              resultText = await generatePdfFallback(buffer, mimeType, file.name);
              source = "pdf-gemini";
            }
          }
        } else {
          send({ type: "stage", stage: "analyze" });
          const result = await generateWithRetry(
            (model) => ai.models.generateContent({ model, contents: `${extractionPrompt}\n\nNỘI DUNG:\n${prompt!}`, config: generationConfig() }).then((r) => r.text),
            retryOpts,
          );
          resultText = result;
        }

        if (!resultText?.trim()) return send({ type: "error", error: "AI không trả về dữ liệu câu hỏi" });

        send({ type: "stage", stage: "check" });
        const elapsedMs = Date.now() - startedAt;
        console.info(`[exam-import] completed in ${elapsedMs}ms; model=${geminiModel}; source=${source}`);
        send({ type: "result", result: resultText, meta: { model: geminiModel, source, elapsedMs } });
        if (aiLogId) {
          await prisma.aiImportLog.update({
            where: { id: aiLogId },
            data: { status: "success", meta: { source, elapsedMs } },
          }).catch(() => {});
        }
      } catch (error) {
        const elapsedMs = Date.now() - startedAt;
        console.error(`[exam-import] failed after ${elapsedMs}ms`, error);
        const message = error instanceof Error ? error.message : "Lỗi không xác định";
        send({ type: "error", error: mapError(message) });
        if (aiLogId) {
          await prisma.aiImportLog.update({
            where: { id: aiLogId },
            data: { status: "failed", error: message.slice(0, 1000) },
          }).catch(() => {});
        }
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
