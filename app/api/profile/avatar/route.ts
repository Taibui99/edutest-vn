import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function ensureBucket() {
  try {
    await supabaseAdmin.storage.createBucket(AVATAR_BUCKET, { public: true });
  } catch {
    // bucket có thể đã tồn tại
  }
}

function avatarPathFromUrl(url: string | null) {
  if (!url) return null;
  const marker = `/${AVATAR_BUCKET}/`;
  const idx = url.lastIndexOf(marker);
  if (idx < 0) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Avatar chưa được cấu hình (thiếu Supabase)" }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || !file.size) return NextResponse.json({ error: "Chưa chọn ảnh" }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Chỉ hỗ trợ ảnh JPG, PNG, WebP hoặc GIF" }, { status: 400 });
  if (file.size > MAX_AVATAR_BYTES) return NextResponse.json({ error: "Ảnh tối đa 2 MB" }, { status: 413 });

  try {
    await ensureBucket();
    const userId = session.user.id!;
    const oldUrl = (await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } }))?.avatarUrl;

    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
    if (error) return NextResponse.json({ error: `Upload thất bại: ${error.message}` }, { status: 500 });

    const publicUrl = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
      select: { avatarUrl: true },
    });

    if (oldUrl) {
      const oldPath = avatarPathFromUrl(oldUrl);
      if (oldPath && oldPath !== path) {
        await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([oldPath]).catch(() => {});
      }
    }

    return NextResponse.json({ avatarUrl: user.avatarUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi upload ảnh";
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
  if (user?.avatarUrl) {
    const path = avatarPathFromUrl(user.avatarUrl);
    if (path) await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([path]).catch(() => {});
  }
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
  return NextResponse.json({ success: true });
}