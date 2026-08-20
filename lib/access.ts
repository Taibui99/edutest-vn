import type { Session } from "next-auth";

type SessionUser = { role?: string | null; mode?: string | null } | undefined | null;

export function isTeacherAccess(user: SessionUser): boolean {
  if (!user) return false;
  return user.role === "teacher" || user.role === "admin";
}

export function isAdminAccess(user: SessionUser): boolean {
  if (!user) return false;
  return user.role === "admin";
}

export function sessionUser(session: Session | null): SessionUser {
  return session?.user ?? null;
}