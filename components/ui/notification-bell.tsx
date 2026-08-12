"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell, Check } from "lucide-react";
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
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications || []);
        setUnread(d.unreadCount || 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = Math.min(360, window.innerWidth - 16);
    const left = Math.min(
      rect.left,
      Math.max(8, window.innerWidth - dropdownWidth - 8)
    );

    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left,
      width: dropdownWidth,
      zIndex: 2147483647,
    });
  }, []);

  const handleOpen = () => {
    if (!open) updateDropdownPosition();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;

    const handleViewportChange = () => updateDropdownPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updateDropdownPosition]);

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
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      void markRead(notification.id);
    }
    setOpen(false);
  };

  const renderNotification = (n: Notification) => {
    const rowClass = cn(
      "flex items-start gap-3 p-4 hover:bg-[var(--gray-100)] transition-colors",
      !n.read && "bg-[var(--primary-light)]/30",
      n.link ? "cursor-pointer" : "cursor-default"
    );

    const content = (
      <>
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full mt-1.5 shrink-0",
            !n.read ? "bg-[var(--primary)]" : "bg-transparent"
          )}
        />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-semibold",
              !n.read
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-secondary)]"
            )}
          >
            {n.title}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
            {n.message}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {timeAgo(n.createdAt)}
          </p>
        </div>
      </>
    );

    if (n.link) {
      return (
        <Link
          key={n.id}
          href={n.link}
          onClick={() => handleNotificationClick(n)}
          className={rowClass}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        key={n.id}
        type="button"
        onClick={() => handleNotificationClick(n)}
        className={cn(rowClass, "w-full text-left")}
      >
        {content}
      </button>
    );
  };

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--surface-border)]">
        <h3 className="text-sm font-black text-[var(--text-primary)]">
          Thông báo{" "}
          {unread > 0 && (
            <span className="text-[var(--primary)]">({unread})</span>
          )}
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
          notifications.map(renderNotification)
        )}
      </div>
    </div>
  ) : null;

  return (
    <div data-notif-root className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
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

      {mounted && typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}
