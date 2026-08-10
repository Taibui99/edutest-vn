"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}


export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = () => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications || []);
        setUnread(d.unreadCount || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Thông báo"
        className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--gray-100)] hover:bg-[var(--gray-200)] transition-colors text-[var(--text-secondary)]"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--danger)] rounded-full text-[10px] text-white font-black flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--surface-border)]">
            <h3 className="text-sm font-black text-[var(--text-primary)]">
              Thông báo {unread > 0 && <span className="text-[var(--primary)]">({unread})</span>}
            </h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-[var(--primary)] font-semibold hover:underline"
              >
                <Check size={11} /> Đọc tất cả
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--surface-border)]">
            {notifications.length === 0 ? (
              <p className="text-center text-sm text-[var(--text-muted)] py-8">
                Không có thông báo nào
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 p-3.5 hover:bg-[var(--gray-100)] transition-colors",
                    !n.read && "bg-[var(--primary-light)]/30"
                  )}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", !n.read ? "bg-[var(--primary)]" : "bg-transparent")} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold truncate", !n.read ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]")}>
                      {n.title}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {n.link && (
                    <Link
                      href={n.link}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 text-[var(--text-muted)] hover:text-[var(--primary)]"
                    >
                      <ExternalLink size={13} />
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
