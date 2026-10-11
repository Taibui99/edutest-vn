import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isTeacherAccess } from "@/lib/access";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase";

/* AI-6f — cấp signed URL để trình duyệt up file lớn THẲNG lên Supabase,
 * bỏ qua Vercel (Vercel chặn body trên ~4.5MB). Chỉ giáo viên, path nhốt
 * theo userId, bucket riêng tư, file tạm do route /api/gemini xoá sau xử lý.
 */
const BUCKET = "exam-docs";
export const DOC_MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = [".pdf", ".docx", ".txt", ".md"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  if (!isTeacherAccess(session.user)) {
    return NextResponse.json({ error: "Chỉ giáo viên mới được tải tài liệu" }, { status: 403 });
  }
  const rl = rateLimit(`upload-sign:${session.user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Bạn thao tác quá nhanh. Thử lại sau 1 phút." }, { status: 429 });
  }

  let body: { name?: unknown; size?: unknown };
  try {
    body = (await req.json()) as { name?: unknown; size?: unknown };
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const name = String(body.name || "");
  const size = Number(body.size || 0);
  const lower = name.toLowerCase();
  if (!ALLOWED_EXT.some((e) => lower.endsWith(e))) {
    return NextResponse.json({ error: "Chỉ hỗ trợ PDF, Word (.docx), TXT hoặc Markdown" }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > DOC_MAX_BYTES) {
    return NextResponse.json(
      { error: "File vượt quá 25 MB. Hãy chia nhỏ tài liệu hoặc dán đoạn cần thiết vào ô văn bản." },
      { status: 400 },
    );
  }

  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) {
    return NextResponse.json({ error: "Không kết nối được kho lưu trữ" }, { status: 500 });
  }
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
    if (createError) {
      return NextResponse.json({ error: "Không khởi tạo được kho lưu trữ" }, { status: 500 });
    }
  }

  const base = lower.split("/").pop()?.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || "tailieu";
  const path = `${session.user.id}/${Date.now()}-${base}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Không tạo được link tải lên" }, { status: 500 });
  }
  return NextResponse.json({ path, signedUrl: data.signedUrl });
}
