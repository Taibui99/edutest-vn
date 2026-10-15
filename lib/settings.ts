import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Cài đặt hệ thống (maintenanceMode, siteName…) đọc ở root layout NÊN mỗi
 * request đều tốn một round-trip DB (~1s tới Supabase). Giá trị gần như không
 * đổi → cache ở Data Cache 60s, và xoá cache ngay khi admin lưu (tag
 * "settings" — xem `app/api/admin/settings/route.ts`).
 */
const SETTINGS_TTL_SECONDS = 60;

const readSetting = unstable_cache(
  async (key: string, fallback: string) => {
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key } });
      return setting?.value ?? fallback;
    } catch {
      return fallback;
    }
  },
  ["system-setting"],
  { revalidate: SETTINGS_TTL_SECONDS, tags: ["settings"] }
);

export async function getSetting(key: string, fallback = "true"): Promise<string> {
  return readSetting(key, fallback);
}
