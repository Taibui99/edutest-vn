"use client";

import { useEffect } from "react";

/* Dấu hiệu React ĐÃ hydrate — đọc bởi script fallback trong ./layout.tsx.
 * Chỉ chạy ở client (useEffect). Máy không chạy nổi React sẽ không bao giờ đặt
 * cờ này → script fallback tự đưa người dùng sang /thi-cu. */
export function HydrationSignal(): null {
  useEffect(() => {
    (window as unknown as { __a6Hydrated?: boolean }).__a6Hydrated = true;
  }, []);
  return null;
}
