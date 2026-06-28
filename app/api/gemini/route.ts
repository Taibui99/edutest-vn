import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const extractQuestionsPrompt = `Trích xuất tất cả câu hỏi trắc nghiệm từ nội dung sau.
Trả về JSON theo format sau, KHÔNG có markdown, chỉ JSON thuần:
{
  "title": "tên đề thi nếu có",
  "questions": [
    {
      "question": "nội dung câu hỏi",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A"
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Thiếu GEMINI_API_KEY" },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const prompt = formData.get("prompt") as string;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let text: string;

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const isDocx =
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.toLowerCase().endsWith(".docx");

      if (isDocx) {
        const docx = await mammoth.extractRawText({ buffer });

        if (!docx.value.trim()) {
          return NextResponse.json(
            { error: "Không đọc được nội dung trong file Word" },
            { status: 400 },
          );
        }

        const result = await model.generateContent(
          `${extractQuestionsPrompt}\n\nNội dung file Word:\n${docx.value}`,
        );
        text = result.response.text();
      } else {
        const base64 = buffer.toString("base64");
        const mimeType = file.type || "application/pdf";

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
          {
            text: extractQuestionsPrompt,
          },
        ]);
        text = result.response.text();
      }
    } else {
      const result = await model.generateContent(prompt);
      text = result.response.text();
    }

    return NextResponse.json({ result: text });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi xử lý file" }, { status: 500 });
  }
}
