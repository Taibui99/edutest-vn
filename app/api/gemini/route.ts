import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const prompt = formData.get("prompt") as string;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let result;

    if (file) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const mimeType = file.type as "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: base64,
          },
        },
        {
          text: `Đọc file này và trích xuất tất cả câu hỏi trắc nghiệm. 
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
          }`,
        },
      ]);
    } else {
      result = await model.generateContent(prompt);
    }

    const text = result.response.text();
    return NextResponse.json({ result: text });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi xử lý" }, { status: 500 });
  }
}