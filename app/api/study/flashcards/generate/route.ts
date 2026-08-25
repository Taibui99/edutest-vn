import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { generateWithRetry, DEFAULT_MODEL } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";

const flashcardPrompt = (subject: string, topic: string) => `Bạn là trợ lý tạo thẻ học (flashcard) cho học sinh Việt Nam.
Tạo các thẻ học tập ngắn gọn, chính xác, dễ nhớ về chủ đề: "${topic || subject}" (môn: ${subject}).
Quy tắc:
- front: câu hỏi/khái niệm ngắn (tối đa ~80 ký tự), back: đáp án/giải thích ngắn (tối đa ~120 ký tự).
- Tối đa 8 thẻ, chất lượng hơn số lượng.
- Dùng tiếng Việt.
- Không thêm ghi chú, chỉ trả về JSON.`;

const responseSchema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          front: { type: "string" },
          back: { type: "string" },
        },
        required: ["front", "back"],
      },
    },
  },
  required: ["cards"],
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  const rl = rateLimit(`flashcard-gen:${session.user.id}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Bạn đang tạo flashcard quá nhanh. Thử lại sau 1 phút." }, { status: 429 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Thiếu GEMINI_API_KEY" }, { status: 500 });
  if ((await getSetting("enableAiImport", "true")) !== "true") {
    return NextResponse.json({ error: "Tính năng AI đang tắt bởi quản trị viên" }, { status: 403 });
  }

  const body = await request.json();
  const subject = String(body.subject || "").trim();
  const topic = String(body.topic || "").trim();
  if (!subject) return NextResponse.json({ error: "Vui lòng nhập môn học" }, { status: 400 });

  let aiLogId: string | null = null;
  try {
    const log = await prisma.aiImportLog.create({
      data: {
        userId: session.user.id,
        action: "flashcard_generate",
        provider: "gemini",
        status: "running",
        model: DEFAULT_MODEL,
        prompt: topic.slice(0, 2000),
      },
    });
    aiLogId = log.id;
  } catch {}

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const text = await generateWithRetry((model) =>
      ai.models.generateContent({
        model,
        contents: `${flashcardPrompt(subject, topic)}`,
        config: { responseMimeType: "application/json", responseSchema, maxOutputTokens: 4096 },
      }).then((r) => r.text),
    );

    let parsed: { cards?: Array<{ front: string; back: string }> };
    try {
      parsed = JSON.parse(text || "{}");
    } catch {
      throw new Error("AI trả về dữ liệu không hợp lệ");
    }

    const rawCards = Array.isArray(parsed.cards) ? parsed.cards.slice(0, 8) : [];
    const cards = rawCards
      .filter((c) => c && String(c.front || "").trim() && String(c.back || "").trim())
      .map((c) => ({ front: String(c.front).trim().slice(0, 200), back: String(c.back).trim().slice(0, 300) }));

    if (cards.length === 0) throw new Error("AI không tạo được thẻ nào, thử lại với chủ đề rõ hơn");

    const created = await prisma.$transaction(
      cards.map((c) => prisma.flashcard.create({ data: { studentId: session.user.id!, subject, deck: subject, front: c.front, back: c.back } })),
    );

    if (aiLogId) {
      await prisma.aiImportLog.update({ where: { id: aiLogId }, data: { status: "success", meta: { count: created.length } } }).catch(() => {});
    }

    return NextResponse.json({ cards: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    if (aiLogId) {
      await prisma.aiImportLog.update({ where: { id: aiLogId }, data: { status: "failed", error: message.slice(0, 1000) } }).catch(() => {});
    }
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 500 });
  }
}