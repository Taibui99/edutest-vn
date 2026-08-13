"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function BackNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  if (!pathname || pathname === "/bang-dieu-khien") return null;

  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/bang-dieu-khien");
  };

  return (
    <div className="px-5 lg:px-8 pt-4 pb-1">
      <button type="button" onClick={handleBack} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] px-3 text-xs font-bold text-[var(--text-secondary)] shadow-sm transition hover:bg-[var(--gray-100)] hover:text-[var(--text-primary)]">
        <ArrowLeft size={15} />
        <span>Quay lại</span>
      </button>
    </div>
  );
}
