"use client";

import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";

const AUTH_PATHS = ["/dang-nhap", "/dang-ky", "/quen-mat-khau", "/doi-mat-khau"];

export function MaintenanceGate({
  maintenanceOn,
  isAdmin,
  children,
}: {
  maintenanceOn: boolean;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const blocked =
    maintenanceOn && !isAdmin && !AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (!blocked) return <>{children}</>;

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24">
      <div className="w-16 h-16 rounded-2xl bg-[#FFF0F0] text-[#FF6B6B] flex items-center justify-center mb-5">
        <Wrench size={30} />
      </div>
      <h1 className="text-2xl font-black text-slate-800 mb-2">Website đang bảo trì</h1>
      <p className="text-sm text-slate-500 max-w-md">
        EduTest đang được nâng cấp và bảo trì. Vui lòng quay lại sau ít phút nữa.
        Cảm ơn bạn đã kiên nhẫn!
      </p>
    </main>
  );
}
