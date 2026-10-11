import type { Session } from "next-auth";

type SessionUser = { role?: string | null; mode?: string | null } | undefined | null;

export function defaultModeByRole(role?: string | null): string {
  if (role === "admin") return "admin";
  if (role === "teacher") return "teacher";
  return "student";
}

export function effectiveMode(user: SessionUser): string | null {
  if (!user) return null;
  if (user.mode) return user.mode;
  // Token cũ trước G6 không có claim mode → suy ra mặc định theo role
  return user.role ? defaultModeByRole(user.role) : null;
}

/**
 * G6b — chế độ (mode) có hiệu lực thật: đang ở chế độ Giáo viên thì dùng được
 * tính năng giáo viên, bất kể role gốc. An toàn vì mọi API giáo viên nhốt dữ
 * liệu theo userId (chỉ thấy/tạo/sửa đề-lớp-thống kê của chính mình).
 * NGOẠI LỆ giữ check role: preview `?preview=1` (lộ đáp án — GĐ0) và /admin.
 */
export function isTeacherAccess(user: SessionUser): boolean {
  if (!user) return false;
  if (user.role === "teacher" || user.role === "admin") return true;
  return effectiveMode(user) === "teacher";
}

/** Chiều ngược lại: chỉ chế độ Học sinh mới làm/nộp bài (khách đi nhánh riêng). */
export function isStudentAccess(user: SessionUser): boolean {
  if (!user) return false;
  return effectiveMode(user) === "student";
}

// Admin API yêu cầu role=admin VÀ đang ở chế độ Quản trị
// (nhất quán với guard trang /admin; token cũ thiếu mode vẫn được suy ra theo role)
export function isAdminAccess(user: SessionUser): boolean {
  if (!user || user.role !== "admin") return false;
  return effectiveMode(user) === "admin";
}

export function sessionUser(session: Session | null): SessionUser {
  return session?.user ?? null;
}