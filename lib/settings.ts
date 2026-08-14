import { prisma } from "@/lib/prisma";

export async function getSetting(key: string, fallback = "true"): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    return setting?.value ?? fallback;
  } catch {
    return fallback;
  }
}
