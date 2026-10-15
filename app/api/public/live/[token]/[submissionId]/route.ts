import { NextResponse } from "next/server";
import { getLiveSubmissionByToken } from "@/lib/live-board";

/* LIVE-1b — API công khai cho MÀN CHI TIẾT 1 bài làm: cùng token bí mật với
 * bảng điểm, KHÔNG cần đăng nhập. Luôn no-store để màn tự làm mới (điểm có
 * thể đổi khi giáo viên chấm tay ở trang khác). */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; submissionId: string }> }) {
  const { token, submissionId } = await params;
  const detail = await getLiveSubmissionByToken(
    decodeURIComponent(token ?? ""),
    decodeURIComponent(submissionId ?? ""),
  );
  const headers = { "cache-control": "no-store, max-age=0" };

  if (!detail.found) {
    return NextResponse.json({ found: false, error: "Không tìm thấy bài làm này" }, { status: 404, headers });
  }
  return NextResponse.json(detail, { headers });
}
