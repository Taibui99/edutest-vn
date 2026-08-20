import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isTeacherAccess } from "@/lib/access";

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const AGENT_HINT = "__NEEDS_EDUTEST_AGENT__";

function shouldDelegate(message: string) {
  return /\b(tạo đề|tạo bài thi|xuất bản đề|đăng đề|giao đề|gỡ đề|gỡ bài|xóa đề|xoá đề|cập nhật đề|sửa đề|chỉnh đề|tạo lớp|lớp học mới|thêm thành viên|duyệt|bài nộp|thống kê|phân tích lớp|học sinh lớp|đề vừa tạo|publish|assign|delete|update)\b/i.test(message);
}

function buildPrompt(role: string, message: string) {
  return `Bạn là AI hội thoại của EduTest.vn. Trả lời tiếng Việt, ngắn gọn, thân thiện và hữu ích. Người dùng có vai trò: ${role}.

Nếu yêu cầu CHỈ là trò chuyện, giải thích, học tập hoặc hỏi kiến thức và không cần thao tác dữ liệu EduTest, hãy trả lời bình thường.
Nếu yêu cầu cần thao tác thật trên EduTest (tạo/xóa/cập nhật đề, lớp, giao đề, xuất bản, xem dữ liệu tài khoản, thống kê, bài nộp...), chỉ trả đúng token ${AGENT_HINT} và không nói thêm gì.

Tin nhắn người dùng:
${message}`;
}

async function callGroq(message: string, role: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { available: false as const };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: buildPrompt(role, message) }],
      temperature: 0.3,
      max_tokens: 1200,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return {
    available: true as const,
    reply: data.choices?.[0]?.message?.content?.trim() || "",
  };
}

async function delegateToGemini(req: NextRequest, message: string, history: unknown[]) {
  const url = new URL("/api/ai-coach", req.url);
  const forwardedHeaders = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) forwardedHeaders.set("cookie", cookie);

  const response = await fetch(url, {
    method: "POST",
    headers: forwardedHeaders,
    body: JSON.stringify({ message, history }),
    cache: "no-store",
  });
  return response.json();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });

  const body = await req.json() as { message?: unknown; history?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

  if (!message) return NextResponse.json({ error: "Tin nhắn trống" }, { status: 400 });

  const role = isTeacherAccess(session.user) ? "teacher" : "student";

  // System-sensitive EduTest actions always use the existing authenticated agent.
  // This keeps database mutations behind the current permission checks and tool layer.
  if (shouldDelegate(message)) {
    return NextResponse.json(await delegateToGemini(req, message, history));
  }

  try {
    const groq = await callGroq(message, role);
    if (groq.available && groq.reply && !groq.reply.includes(AGENT_HINT)) {
      return NextResponse.json({ reply: groq.reply, provider: "groq" });
    }
  } catch (error) {
    console.error("Groq router error:", error);
  }

  // Graceful fallback to the authenticated EduTest agent when Groq is unavailable.
  return NextResponse.json(await delegateToGemini(req, message, history));
}
