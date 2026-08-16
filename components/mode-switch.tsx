"use client";

import { useState, useTransition } from "react";
import { switchModeAction } from "@/app/actions/auth";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";

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
        <span className="relative block w-full">
          {switching && (
            <span className="absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-white/70 dark:bg-black/40 backdrop-blur-[1px]">
              <Spinner size="md" color="primary" />
            </span>
          )}
          {children}
        </span>
      </button>

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