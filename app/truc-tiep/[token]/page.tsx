import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getLiveBoardByToken } from "@/lib/live-board";
import { LiveBoardClient } from "./live-board";

/* LIVE-1 — trang chiếu công khai qua token bí mật (KHÔNG đăng nhập).
 * Server render lần đầu để tivi có nội dung ngay, client tự poll tiếp. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bảng điểm trực tiếp — A6Class Edu",
  robots: { index: false, follow: false },
};

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function LiveBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ all?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const board = await getLiveBoardByToken(decodeURIComponent(token ?? ""));
  if (!board.found || !board.exam) notFound();

  const origin = await requestOrigin();
  const joinUrl = `${origin}/thi/${encodeURIComponent(board.exam.joinCode)}`;
  const qrUrl = origin ? await QRCode.toDataURL(joinUrl, { width: 600, margin: 2 }) : null;

  // `?all=1` để mở sẵn bảng xếp hạng đầy đủ (dùng khi chiếu trên màn to / máy tính).
  return <LiveBoardClient initial={board} token={token} qrUrl={qrUrl} joinUrl={joinUrl} initialShowAll={sp?.all === "1"} />;
}
