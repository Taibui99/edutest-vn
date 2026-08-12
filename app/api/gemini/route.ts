import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

const geminiModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const extractionPrompt = `Bạn là bộ máy nhập đề thi của EduTest.
Trích xuất CÁC CÂU HỎI TRẮC NGHIỆM ĐÃ CÓ SẴN trong tài liệu.

QUY TẮC:
- Không tự tạo câu hỏi mới.
- Giữ nguyên nội dung câu hỏi và đáp án, chỉ bỏ phần đánh số thừa nếu cần.
- Mỗi câu có tối đa 4 lựa chọn A, B, C, D.
- answer chỉ được là A, B, C hoặc D nếu tài liệu xác định được đáp án.
- Nếu tài liệu không có đáp án, để answer là "".
- title lấy tên đề nếu tài liệu có; nếu không có thì để "Đề thi mới".
- Không giải bài, không giải thích, không thêm nội dung ngoài tài liệu.
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
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "string", enum: ["A", "B", "C", "D", ""] },
        },
        required: ["question", "options", "answer"],
      },
    },
  },
  required: ["title", "questions"],
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function generationConfig() {
  return {
    responseMimeType: "application/json",
    responseSchema,
    maxOutputTokens: 32768,
    thinkingConfig: { thinkingLevel: "minimal" },
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Thiếu GEMINI_API_KEY" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const prompt = (formData.get("prompt") as string | null)?.trim();
    if (!file && !prompt) return NextResponse.json({ error: "Thiếu file hoặc nội dung cần xử lý" }, { status: 400 });

    let resultText: string;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx");

      if (isDocx) {
        const docx = await mammoth.extractRawText({ buffer });
        const content = docx.value.trim();
        if (!content) return NextResponse.json({ error: "Không đọc được nội dung trong file Word" }, { status: 400 });

        const result = await ai.models.generateContent({
          model: geminiModel,
          contents: `${extractionPrompt}\n\nNỘI DUNG ĐỀ:\n${content}`,
          config: generationConfig(),
        });
        resultText = result.text;
      } else {
        const uploaded = await ai.files.upload({
          file: new Blob([buffer], { type: file.type || "application/pdf" }),
          config: { displayName: file.name, mimeType: file.type || "application/pdf" },
        });

        let processed = uploaded;
        while (processed.state === "PROCESSING") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          processed = await ai.files.get({ name: uploaded.name! });
        }
        if (processed.state === "FAILED") return NextResponse.json({ error: "Gemini không xử lý được file PDF" }, { status: 422 });

        const result = await ai.models.generateContent({
          model: geminiModel,
          contents: [extractionPrompt, { fileData: { fileUri: processed.uri!, mimeType: processed.mimeType || file.type || "application/pdf" } }],
          config: generationConfig(),
        });
        resultText = result.text;

        try {
          if (processed.name) await ai.files.delete({ name: processed.name });
        } catch {}
      }
    } else {
      const result = await ai.models.generateContent({ model: geminiModel, contents: prompt!, config: generationConfig() });
      resultText = result.text;
    }

    if (!resultText?.trim()) return NextResponse.json({ error: "AI không trả về dữ liệu câu hỏi" }, { status: 422 });

    console.info(`[exam-import] completed in ${Date.now() - startedAt}ms`);
    return NextResponse.json({ result: resultText });
  } catch (error) {
    console.error(`[exam-import] failed after ${Date.now() - startedAt}ms`, error);
    return NextResponse.json({ error: "Lỗi xử lý file" }, { status: 500 });
  }
}
