/* Định dạng ngày/giờ cho UI — GHIM MÚI GIỜ `Asia/Ho_Chi_Minh`.
 *
 * Lý do có file này (bug đo được, PROCTOR/LIVE-1): server Vercel chạy UTC còn
 * máy khách ở Việt Nam → component "use client" render chuỗi giờ lúc SSR (UTC)
 * rồi hydrate lại bằng giờ máy khách (UTC+7) → CHUỖI KHÁC NHAU → React #418,
 * React dựng lại cây DOM → node preloader bị thay → màn loading đứng yên tới
 * khi failsafe CSS 6s dọn đi ("loading đứng đơ rồi vào luôn").
 *
 * Ghim `timeZone` trong từng lệnh format là display-only: không đổi mốc thời
 * gian, không đổi phép tính ngày (statistics, schedule vẫn giữ nguyên). */

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Tương đương `Date#toLocaleString("vi-VN", options)` nhưng luôn theo giờ VN. */
export function vnDateTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleString("vi-VN", { ...options, timeZone: VN_TIME_ZONE });
}

/** Tương đương `Date#toLocaleDateString("vi-VN", options)` — chỉ ngày. */
export function vnDate(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString("vi-VN", { ...options, timeZone: VN_TIME_ZONE });
}

/** Giờ VN dạng `HH:MM:SS` (dùng cho "Cập nhật …" trên bảng chiếu). */
export function vnClock(value: string | number | Date): string {
  return vnDateTime(value, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
