/**
 * Phát hiện trình duyệt "quá cũ" — dưới sàn hỗ trợ của bộ nền hiện tại
 * (Next 16 + Tailwind 4 cần Safari 16.4+ / Chrome 111+ / Firefox 128+).
 *
 * Máy iOS cũ (iOS 15 trở xuống, hoặc 16.0–16.3) không chạy nổi app React:
 * form HTML thuần vẫn hoạt động nhưng JS của Next/React thì không hydrate →
 * trang thi "đứng", bấm đáp án không ăn. Những máy đó được đưa sang hệ thống
 * thi HTML thuần ở `/thi-cu` (xem `app/thi-cu/[code]/route.ts`).
 *
 * Nguyên tắc: CHỈ kết luận "cũ" khi nhận diện được engine; không rõ thì coi như
 * máy mới (tránh đẩy người dùng máy tốt sang bản nhẹ oan).
 */
export function isLegacyBrowser(ua: string | null | undefined): boolean {
  if (!ua) return false;
  const s = ua;

  // iOS (iPhone/iPad/iPod): Safari dùng WebKit hệ thống; "Version/" có thể vắng.
  const ios = s.match(/OS (\d+)_(\d+)/);
  if (/\b(iPhone|iPad|iPod)\b/.test(s) && ios) {
    const major = Number(ios[1]);
    const minor = Number(ios[2]);
    if (major < 16) return true;
    if (major === 16 && minor < 4) return true;
    return false;
  }

  // Safari desktop: có "Version/" và KHÔNG phải Chromium/Firefox/Opera.
  const isSafari = /Safari\//.test(s) && /Version\//.test(s) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(s);
  if (isSafari) {
    const v = s.match(/Version\/(\d+)(?:\.(\d+))?/);
    if (v) {
      const major = Number(v[1]);
      const minor = Number(v[2] || 0);
      if (major < 16) return true;
      if (major === 16 && minor < 4) return true;
    }
    return false;
  }

  // Chrome/Edge (Blink) — cần 111+.
  const chrome = s.match(/(?:Chrome|Chromium|Edg)\/(\d+)/);
  if (chrome && Number(chrome[1]) < 111) return true;

  // Firefox — cần 128+.
  const ff = s.match(/Firefox\/(\d+)/);
  if (ff && Number(ff[1]) < 128) return true;

  return false;
}
