import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTeacherAccess } from "@/lib/access";

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const AGENT_HINT = "__NEEDS_EDUTEST_AGENT__";

/**
 * AI-5a — ý định nào cần agent có dữ liệu thật (thay vì Groq trả lời mù).
 *
 * Hai nhóm: (1) THAO TÁC dữ liệu (tạo/sửa/xóa/giao đề-lớp, xem bài nộp...),
 * giữ nguyên như cũ; (2) ĐỌC dữ liệu (xem đề-bài-lớp của mình, kết quả,
 * điểm yếu, tiến độ, nên học/ôn gì...) — trước đây rơi sang Groq nên AI
 * "hứa nhưng không làm được" (không thấy điểm/bài làm nào). Câu hỏi kiến
 * thức và luyện tập thuần túy (giải thích, ra câu hỏi chữ) vẫn đi Groq nhanh.
 */
const MUTATION_RE =
  /\b(tạo đề|tạo bài thi|xuất bản đề|đăng đề|giao đề|gỡ đề|gỡ bài|xóa đề|xoá đề|cập nhật đề|sửa đề|chỉnh đề|tạo lớp|lớp học mới|thêm thành viên|duyệt|bài nộp|thống kê|phân tích lớp|học sinh lớp|đề vừa tạo|publish|assign|delete|update)\b|tạo(\s+\S+){1,4}\s+đề/i;

const DATA_READ_RE =
  /(xem|liệt kê|danh sách|hiển thị|cho xem).*(đề|bài|lớp|kết quả|điểm)|kết quả|điểm số|điểm yếu|phân tích|bài (đã làm|đã nộp|của tôi)|tiến độ|tổng quan|nên (học|ôn)|học gì|ôn gì|ôn tập|kế hoạch|gợi ý (ôn|học)|đề (được giao|của tôi|thi của|nào|gần nhất)/i;

function shouldDelegate(message: string) {
  return MUTATION_RE.test(message) || DATA_READ_RE.test(message);
}

/* AI-5d — câu hỏi dữ liệu của HỌC SINH trả lời trực tiếp bằng Prisma.
 *
 * Đo được trên production: đường agent (`ai-coach`, nhiều vòng gọi Gemini
 * nối tiếp) cho câu này mất 24s khi may, treo tới kẹt kết nối khi xui
 * (Vercel giết function giữa chừng → client ECONNRESET, khung chat quay mãi).
 * Học sinh chỉ cần 2 dạng: xem kết quả + phân tích/gợi ý ôn tập — truy vấn
 * thẳng nhanh (<2s) và luôn đúng, không đoán. Giáo viên vẫn đi agent vì cần
 * tools tạo/sửa/giao đề.
 */
const STUDENT_RESULTS_RE = /(kết quả|điểm số|bài (đã làm|đã nộp|của tôi))/i;
const STUDENT_COACH_RE =
  /(điểm yếu|phân tích|tiến độ|tổng quan|nên (học|ôn)|học gì|ôn gì|ôn tập|kế hoạch|gợi ý (ôn|học))/i;

async function studentResultsReply(userId: string): Promise<string> {
  const [total, subs] = await Promise.all([
    prisma.submission.count({ where: { studentId: userId } }),
    prisma.submission.findMany({
      where: { studentId: userId },
      include: { exam: { select: { title: true, subject: true } } },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
  ]);
  if (!subs.length) {
    return "Bạn chưa có bài nộp nào. Nhập mã đề từ giáo viên ở mục Vào thi để làm bài đầu tiên, rồi quay lại đây nhé!";
  }
  const avg = subs.reduce((a, s) => a + s.score, 0) / subs.length;
  const lines = subs
    .map(
      (s, i) =>
        `${i + 1}. ${s.exam.title} (${s.exam.subject}) — ${s.score}/10, đúng ${s.correctCount}/${s.totalQuestions} câu`,
    )
    .join("\n");
  return `Bạn đã làm ${total} bài${total > 10 ? " (10 bài gần nhất)" : ""}, điểm trung bình ${avg.toFixed(1)}:\n${lines}`;
}

async function studentCoachReply(userId: string): Promise<string> {
  const subs = await prisma.submission.findMany({
    where: { studentId: userId },
    include: { exam: { select: { subject: true } } },
    orderBy: { submittedAt: "desc" },
    take: 50,
  });
  if (!subs.length) {
    return "Bạn chưa có bài làm nào để phân tích. Hãy làm một đề ở mục Vào thi, rồi quay lại đây tôi sẽ chỉ ra điểm yếu và gợi ý ôn tập!";
  }
  const bySubject = new Map<string, { n: number; sum: number }>();
  for (const s of subs) {
    const e = bySubject.get(s.exam.subject) ?? { n: 0, sum: 0 };
    e.n += 1;
    e.sum += s.score;
    bySubject.set(s.exam.subject, e);
  }
  const rows = [...bySubject.entries()]
    .map(([subject, v]) => ({ subject, avg: v.sum / v.n, n: v.n }))
    .sort((a, b) => a.avg - b.avg);
  const weakest = rows[0];
  const lines = rows.map((r) => `• ${r.subject}: trung bình ${r.avg.toFixed(1)} (${r.n} bài)`).join("\n");
  const advice =
    weakest.avg >= 8
      ? "Phong độ tốt ở mọi môn. Hãy giữ nhịp bằng cách làm thêm đề tổng hợp và soát lại các câu từng sai."
      : `Hãy ưu tiên ôn ${weakest.subject} (trung bình ${weakest.avg.toFixed(1)} — thấp nhất): làm lại các đề môn này, đọc kỹ lời giải những câu sai, rồi hỏi tôi giải thích chỗ chưa hiểu.`;
  return `Phân tích từ ${subs.length} bài bạn đã làm:\n${lines}\n\nGợi ý: ${advice}`;
}

function buildPrompt(role: string, message: string) {
  return `Bạn là AI hội thoại của A6Class Edu. Trả lời tiếng Việt, ngắn gọn, thân thiện và hữu ích. Người dùng có vai trò: ${role}.

Nếu yêu cầu CHỈ là trò chuyện, giải thích, học tập hoặc hỏi kiến thức và không cần thao tác dữ liệu A6Class Edu, hãy trả lời bình thường.
Nếu yêu cầu cần thao tác thật trên A6Class Edu (tạo/xóa/cập nhật đề, lớp, giao đề, xuất bản, xem dữ liệu tài khoản, thống kê, bài nộp...), chỉ trả đúng token ${AGENT_HINT} và không nói thêm gì.

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

  // AI-5d: agent nhiều vòng gọi LLM nối tiếp, quá 55s thì cắt để khung chat
  // không quay mãi (production từng ECONNRESET vì function bị giết giữa chừng).
  const response = await fetch(url, {
    method: "POST",
    headers: forwardedHeaders,
    body: JSON.stringify({ message, history }),
    cache: "no-store",
    signal: AbortSignal.timeout(55000),
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

  // Học sinh hỏi dữ liệu của mình: trả lời thẳng bằng DB, nhanh và luôn đúng.
  if (!isTeacherAccess(session.user)) {
    if (STUDENT_RESULTS_RE.test(message)) {
      return NextResponse.json({ reply: await studentResultsReply(session.user.id!), provider: "local" });
    }
    if (STUDENT_COACH_RE.test(message)) {
      return NextResponse.json({ reply: await studentCoachReply(session.user.id!), provider: "local" });
    }
  }

  // System-sensitive A6Class Edu actions always use the existing authenticated agent.
  // This keeps database mutations behind the current permission checks and tool layer.
  if (shouldDelegate(message)) {
    try {
      return NextResponse.json(await delegateToGemini(req, message, history));
    } catch (error) {
      console.error("AI delegate error:", error);
      return NextResponse.json(
        { error: "AI tra dữ liệu hơi lâu. Bạn thử lại sau ít phút nhé!" },
        { status: 500 },
      );
    }
  }

  try {
    const groq = await callGroq(message, role);
    if (groq.available && groq.reply && !groq.reply.includes(AGENT_HINT)) {
      return NextResponse.json({ reply: groq.reply, provider: "groq" });
    }
  } catch (error) {
    console.error("Groq router error:", error);
  }

  // Graceful fallback to the authenticated A6Class Edu agent when Groq is unavailable.
  return NextResponse.json(await delegateToGemini(req, message, history));
}
