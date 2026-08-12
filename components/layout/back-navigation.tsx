"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function BackNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  // Dashboard root is already the top-level destination, so don't show a back control there.
  if (!pathname || pathname === "/bang-dieu-khien") return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/bang-dieu-khien");
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="fixed left-3 top-[68px] lg:left-[276px] lg:top-5 z-30 inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] px-3 text-xs font-bold text-[var(--text-secondary)] shadow-sm backdrop-blur-sm transition hover:bg-[var(--gray-100)] hover:text-[var(--text-primary)] active:scale-[0.98]"
      aria-label="Quay lại trang trước"
      title="Quay lại"
    >
      <ArrowLeft size={15} />
      <span className="hidden sm:inline">Quay lại</span>
    </button>
  );
}
