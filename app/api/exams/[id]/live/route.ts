import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTeacherAccess } from "@/lib/access";
import { createLiveToken, livePath } from "@/lib/live-board";

/* LIVE-1 — quản lý bảng điểm trực tiếp cho MỘT đề (chỉ chủ đề).
 * GET  → trạng thái + link + QR.
 * POST { action: "enable" | "rotate" | "disable" } → bật / đổi token (đóng
 * link cũ) / thu hồi (tắt hoàn toàn). */

async function authorize(id: string): Promise<{ ok: boolean; res?: NextResponse }> {
  const session = await auth();
  if (!session?.user) return { ok: false, res: NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 }) };
  if (!isTeacherAccess(session.user)) return { ok: false, res: NextResponse.json({ error: "Chỉ giáo viên mới dùng được" }, { status: 403 }) };
  const exam = await prisma.exam.findFirst({ where: { id, teacherId: session.user.id! }, select: { id: true } });
  if (!exam) return { ok: false, res: NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 }) };
  return { ok: true };
}

interface LiveLinkInfo {
  enabled: boolean;
  token: string | null;
  liveUrl: string | null;
  qrUrl: string | null;
}

async function build(origin: string, token: string | null): Promise<LiveLinkInfo> {
  if (!token) return { enabled: false, token: null, liveUrl: null, qrUrl: null };
  const liveUrl = `${origin}${livePath(token)}`;
  const qrUrl = await QRCode.toDataURL(liveUrl, { width: 600, margin: 2 });
  return { enabled: true, token, liveUrl, qrUrl };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await authorize(id);
  if (gate.res) return gate.res;

  const exam = await prisma.exam.findUnique({ where: { id }, select: { liveToken: true } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  return NextResponse.json(await build(new URL(request.url).origin, exam.liveToken));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await authorize(id);
  if (gate.res) return gate.res;

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action === "rotate" || body.action === "disable" ? body.action : "enable";

  const current = await prisma.exam.findUnique({ where: { id }, select: { liveToken: true } });
  if (!current) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

  let token: string | null;
  if (action === "disable") token = null;
  else if (action === "rotate") token = createLiveToken();
  else token = current.liveToken || createLiveToken();

  await prisma.exam.update({ where: { id }, data: { liveToken: token } });
  return NextResponse.json(await build(new URL(request.url).origin, token));
}
