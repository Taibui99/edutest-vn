"use client";

import { useState, useTransition } from "react";
import { switchModeAction } from "@/app/actions/auth";
import { ConfirmDialog } from "@/components/confirm-dialog";

type ModeValue = "student" | "teacher" | "admin";

interface ModeSwitchButtonProps {
  mode: ModeValue;
  redirectTo: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-[var(--surface-page)]">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--primary)] to-[var(--coral)] flex items-center justify-center shadow-lg shadow-[var(--primary)]/20">
          <span className="text-2xl font-black text-white">
            <span className="text-white/80">E</span>u
          </span>
        </div>
        <span className="absolute -inset-2 rounded-[2rem] border-2 border-transparent border-t-[var(--primary)] animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-lg font-black text-[var(--text-primary)]">Đang chuyển sang chế độ {label}...</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Vui lòng đợi trong giây lát</p>
      </div>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-[var(--gray-200)]">
        <div className="h-full w-1/2 rounded-full bg-[var(--primary)] animate-indeterminate" />
      </div>
    </div>
  );
}

export function ModeSwitchButton({
  mode,
  redirectTo,
  label,
  active,
  children,
  className,
  confirmMessage,
}: ModeSwitchButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  const switching = busy || isPending;

  const handleClick = () => {
    if (switching) return;
    if (active) return;
    setConfirming(true);
  };

  const doSwitch = () => {
    setConfirming(false);
    setBusy(true);
    const fd = new FormData();
    fd.set("mode", mode);
    fd.set("redirectTo", redirectTo);
    startTransition(async () => {
      try {
        await switchModeAction(fd);
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={switching}
        aria-label={`Chuyển sang chế độ ${label}`}
        className={className}
      >
        {children}
      </button>

      {switching && <LoadingScreen label={label} />}

      <ConfirmDialog
        open={confirming}
        title={`Chuyển sang chế độ ${label}?`}
        message={
          confirmMessage ??
          `Bạn có chắc muốn chuyển sang chế độ ${label}? Giao diện và tính năng sẽ chuyển sang chế độ này.`
        }
        confirmLabel="Chuyển chế độ"
        onConfirm={doSwitch}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}