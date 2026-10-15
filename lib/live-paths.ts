/* LIVE-1b — đường dẫn trang bảng điểm. Tách riêng KHÔNG phụ thuộc server
 * (crypto/prisma/auth) để component phía client import được. */

export function livePath(token: string): string {
  return `/truc-tiep/${encodeURIComponent(token)}`;
}

/** Màn hình chi tiết 1 bài làm — mở khi bấm tên học sinh trên bảng xếp hạng. */
export function liveSubmissionPath(token: string, submissionId: string): string {
  return `${livePath(token)}/bai/${encodeURIComponent(submissionId)}`;
}

export function liveApiPath(token: string): string {
  return `/api/public/live/${encodeURIComponent(token)}`;
}

export function liveSubmissionApiPath(token: string, submissionId: string): string {
  return `${liveApiPath(token)}/${encodeURIComponent(submissionId)}`;
}
