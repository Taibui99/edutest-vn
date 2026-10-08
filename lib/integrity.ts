/**
 * GĐ2/GĐ3 — Tính mức rủi ro + chế độ chống gian lận khi thi.
 *
 * Nguyên tắc đã chốt (ROADMAP — "Chống gian lận khi thi"): chỉ **ghi log +
 * gắn cờ**, giáo viên xem timeline rồi tự quyết — **không** tự 0 điểm,
 * **không** từ chối nộp bài. Module này thuần túy: không đụng DB, không lấy
 * thời gian thực → chạy được bằng script test (`scripts/qa-integrity.mjs`).
 */

/** Số lần vi phạm chạm ngưỡng thì client tự nộp bài; server dùng chính con số
 *  này để gán `Submission.autoSubmitted`. */
export const MAX_VIOLATIONS = 3;

export type Severity = "low" | "medium" | "high";
export type RiskLevel = "none" | "low" | "medium" | "high";

/** Whitelist — client chỉ được báo các tên này; tên lạ bị API từ chối. */
export const PROCTOR_EVENT_TYPES = [
  "tab_blur",
  "visibility_hidden",
  "copy",
  "paste",
  "context_menu",
  "devtools_open",
  "view_source",
  "print",
  "screenshot",
  "screen_share",
  "multi_tab",
  "fullscreen_exit",
] as const;

/** Chế độ giáo viên chọn cho từng đề. `strict` tự hạ cấp thành `light` khi thi
 *  trên điện thoại (không có bàn phím/F11 → bắt fullscreen là vô nghĩa). */
export const PROCTOR_MODES = ["off", "light", "strict"] as const;
export type ProctorMode = (typeof PROCTOR_MODES)[number];

export function isProctorMode(value: string): value is ProctorMode {
  return (PROCTOR_MODES as readonly string[]).includes(value);
}

/**
 * Chế độ thực thi trên máy học sinh. Thuần hàm để test được.
 * `off` giữ nguyên hành vi cũ; GĐ2 (tab_blur/visibility_hidden) luôn chạy bất kể
 * chế độ vì đó là nền tảng đã chốt ở GĐ2.
 */
export function resolveProctorMode(mode: ProctorMode, opts: { isMobile: boolean }): ProctorMode {
  if (mode === "strict" && opts.isMobile) return "light";
  return mode;
}

/** Nhãn ngắn cho giáo viên (editor, thẻ đề, timeline). */
export const PROCTOR_MODE_LABELS: Record<ProctorMode, string> = {
  off: "Tắt",
  light: "Nhẹ",
  strict: "Nghiêm",
};

export const PROCTOR_MODE_DESCRIPTIONS: Record<ProctorMode, string> = {
  off: "Chỉ ghi nhận khi học sinh rời tab (mặc định).",
  light: "Chặn copy/paste/menu chuột phải, phím tắt DevTools, in ấn; phát hiện nhiều tab và chụp màn hình. Không bắt toàn màn hình.",
  strict: "Như Nhẹ, thêm: bắt buộc toàn màn hình, chặn cứng các thao tác sao chép/in. Thi trên điện thoại tự hạ về mức Nhẹ.",
}

export function proctorModeLabel(mode: string): string {
  return isProctorMode(mode) ? PROCTOR_MODE_LABELS[mode] : "Tắt";
}

export type ProctorEventType = (typeof PROCTOR_EVENT_TYPES)[number];

/** Mức nghiêm trọng do SERVER quy cho từng loại sự kiện — không nhận từ client. */
const SEVERITY_BY_TYPE: Record<string, Severity> = {
  tab_blur: "medium",
  visibility_hidden: "medium",
  copy: "high",
  paste: "high",
  context_menu: "medium",
  devtools_open: "high",
  view_source: "medium",
  print: "high",
  screenshot: "medium",
  screen_share: "high",
  multi_tab: "medium",
  fullscreen_exit: "medium",
};

const SEVERITY_WEIGHT: Record<Severity, number> = { low: 5, medium: 15, high: 30 };

/** Cộng thêm khi bài bị nộp tự động vì đạt ngưỡng vi phạm. */
const AUTO_SUBMIT_BONUS = 25;
const RISK_CAP = 100;
const MEDIUM_AT = 25;
const HIGH_AT = 50;

export function isProctorEventType(type: string): type is ProctorEventType {
  return (PROCTOR_EVENT_TYPES as readonly string[]).includes(type);
}

export function severityOf(type: string): Severity | null {
  return isProctorEventType(type) ? SEVERITY_BY_TYPE[type] : null;
}

/** Nhãn tiếng Việt cho timeline của giáo viên. */
export const PROCTOR_EVENT_LABELS: Record<ProctorEventType, string> = {
  tab_blur: "Rời khỏi cửa sổ thi",
  visibility_hidden: "Chuyển sang tab khác",
  copy: "Sao chép nội dung",
  paste: "Dán nội dung",
  context_menu: "Mở menu chuột phải",
  devtools_open: "Mở công cụ nhà phát triển",
  view_source: "Mở xem mã nguồn trang",
  print: "In / lưu đề thi",
  screenshot: "Nhấn phím chụp màn hình",
  screen_share: "Chia sẻ / ghi màn hình",
  multi_tab: "Mở nhiều tab cùng lúc",
  fullscreen_exit: "Thoát chế độ toàn màn hình",
};

export function labelOf(type: string): string {
  return isProctorEventType(type) ? PROCTOR_EVENT_LABELS[type] : type;
}

/**
 * Cộng dồn điểm rủi ro từ danh sách sự kiện.
 *
 * - `violationCount` = số sự kiện (mọi loại đều được tính, kể cả loại lạ).
 * - `autoSubmitted` = đã chạm `MAX_VIOLATIONS` — server tự suy ra, không tin
 *   cờ do client gửi lên.
 * - `riskLevel`: `none` khi không có vi phạm; ngược lại xếp theo điểm.
 */
export function computeRisk(events: Array<{ type: string }>): {
  violationCount: number;
  riskScore: number;
  riskLevel: RiskLevel;
  autoSubmitted: boolean;
} {
  const violationCount = events.length;
  const autoSubmitted = violationCount >= MAX_VIOLATIONS;

  let raw = 0;
  for (const e of events) {
    const severity = severityOf(e.type);
    raw += severity ? SEVERITY_WEIGHT[severity] : SEVERITY_WEIGHT.medium;
  }
  if (autoSubmitted) raw += AUTO_SUBMIT_BONUS;

  const riskScore = Math.min(RISK_CAP, raw);
  const riskLevel: RiskLevel =
    violationCount === 0 ? "none" : riskScore >= HIGH_AT ? "high" : riskScore >= MEDIUM_AT ? "medium" : "low";

  return { violationCount, riskScore, riskLevel, autoSubmitted };
}
