import { NextResponse } from "next/server";
import { getLiveBoardByToken } from "@/lib/live-board";

/* LIVE-1 — API công khai cho bảng điểm trực tiếp: fetch theo token bí mật,
 * KHÔNG cần đăng nhập (giấu qua link share). Luôn no-store để máy chiếu
 * tự làm mới vài giây không dính cache. */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const board = await getLiveBoardByToken(decodeURIComponent(token ?? ""));
  const headers = { "cache-control": "no-store, max-age=0" };

  if (!board.found) {
    return NextResponse.json({ found: false, error: "Không tìm thấy bảng điểm" }, { status: 404, headers });
  }
  return NextResponse.json(board, { headers });
}
