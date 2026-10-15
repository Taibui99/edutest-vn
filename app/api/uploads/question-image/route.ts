import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isTeacherAccess } from "@/lib/access";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase";

/* IMG-1 — tải ảnh minh hoạ cho câu hỏi lên Supabase Storage (bucket công khai)
 * rồi trả URL dùng thẳng trong `grading.image`. Bucket công khai để ảnh render
 * được ở cả trang thi React lẫn bản HTML thuần cho máy iOS cũ, và URL ổn định
 * (không hết hạn như signed URL). Ảnh không nhạy cảm nên công khai là chấp nhận.
 * Giới hạn 4 MB — client đã thu nhỏ ảnh lớn trước khi gửi. */
const BUCKET = "question-images";
export const IMG_MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  if (!isTeacherAccess(session.user)) {
    return NextResponse.json({ error: "Chỉ giáo viên mới được tải ảnh" }, { status: 403 });
  }
  const rl = rateLimit(`upload-image:${session.user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Bạn thao tác quá nhanh. Thử lại sau 1 phút." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu tệp ảnh" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh PNG, JPG, WEBP hoặc GIF" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > IMG_MAX_BYTES) {
    return NextResponse.json({ error: "Ảnh vượt quá 4 MB. Hãy chọn ảnh nhỏ hơn." }, { status: 400 });
  }

  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) {
    return NextResponse.json({ error: "Không kết nối được kho lưu trữ" }, { status: 500 });
  }
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
    if (createError) {
      return NextResponse.json({ error: "Không khởi tạo được kho ảnh" }, { status: 500 });
    }
  }

  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "");
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${session.user.id}/${Date.now()}-${rand}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upError) {
    return NextResponse.json({ error: "Không tải được ảnh lên" }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
