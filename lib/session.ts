import { cache } from "react";
import { auth } from "@/auth";

/**
 * `auth()` giải mã JWT mỗi lần gọi. Root layout VÀ page đều cần session, cộng
 * thêm nhiều page khác nữa → React `cache()` gộp lại còn một lần/request, tránh
 * giải mã trùng (đỡ CPU trên máy chủ, giúp TTFB thấp hơn).
 */
export const getSession = cache(async () => {
  try {
    return await auth();
  } catch {
    return null;
  }
});
