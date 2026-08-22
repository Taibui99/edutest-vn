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

export function isTeacherAccess(user: SessionUser): boolean {
  if (!user) return false;
  return user.role === "teacher" || user.role === "admin";
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