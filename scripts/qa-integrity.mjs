// Test thuần cho `lib/integrity.ts` (GĐ2) — không cần server, không cần DB.
// Cách chạy: node scripts/qa-integrity.mjs
import { computeRisk, severityOf, isProctorEventType, labelOf, MAX_VIOLATIONS, isProctorMode, resolveProctorMode, proctorModeLabel } from "../lib/integrity.ts";

let failures = 0;
function check(ok, label, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`);
  if (!ok) failures++;
}
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(ok, label, ok ? "" : `thuc te=${JSON.stringify(actual)} mong doi=${JSON.stringify(expected)}`);
}

eq(isProctorEventType("tab_blur"), true, "tab_blur nam trong whitelist");
eq(isProctorEventType("nuke_everything"), false, "ten su kien la bi tu choi");
eq(isProctorEventType("__proto__"), false, "ten giong prototype bi tu choi");

eq(severityOf("tab_blur"), "medium", "tab_blur co do nghiem trong medium");
eq(severityOf("copy"), "high", "copy co do nghiem trong high");
eq(severityOf("khong-ton-tai"), null, "su kien la khong co severity");

check(labelOf("tab_blur").length > 0, "co nhan tieng Viet cho su kien", labelOf("tab_blur"));
check(labelOf("khong-la-biet").length > 0, "su kien la van co nhan de hien thi", labelOf("khong-la-biet"));

// Không vi phạm → điểm 0, mức none
eq(computeRisk([]), { violationCount: 0, riskScore: 0, riskLevel: "none", autoSubmitted: false }, "khong vi pham → none/0");

// 1 lần rời tab: medium = 15 → low
eq(computeRisk([{ type: "tab_blur" }]), { violationCount: 1, riskScore: 15, riskLevel: "low", autoSubmitted: false }, "1 lan tab_blur → low/15");

// 2 lần: 30 → medium
eq(computeRisk([{ type: "tab_blur" }, { type: "tab_blur" }]), { violationCount: 2, riskScore: 30, riskLevel: "medium", autoSubmitted: false }, "2 lan tab_blur → medium/30");

// 3 lần: chạm ngưỡng → autoSubmitted + 25 → 45+25 = 70 → high
eq(computeRisk([{ type: "tab_blur" }, { type: "tab_blur" }, { type: "tab_blur" }]), { violationCount: 3, riskScore: 70, riskLevel: "high", autoSubmitted: true }, "3 lan tab_blur → autoSubmit/high/70");

// Sự kiện nặng: copy (30) 2 lần = 60 → high, chưa autoSubmit
eq(computeRisk([{ type: "copy" }, { type: "copy" }]), { violationCount: 2, riskScore: 60, riskLevel: "high", autoSubmitted: false }, "2 lan copy → high/60, chua autoSubmit");

// Ngưỡng autoSubmit theo MAX_VIOLATIONS, không hardcode 3
{
  const many = Array.from({ length: MAX_VIOLATIONS }, () => ({ type: "context_menu" }));
  const r = computeRisk(many);
  eq(r.autoSubmitted, true, `cham dung ${MAX_VIOLATIONS} lan thi autoSubmit`);
  eq(r.violationCount, MAX_VIOLATIONS, "violationCount = MAX_VIOLATIONS");
}

// Loại lạ vẫn được đếm (không bỏ sót) và dùng trọng số trung bình
{
  const r = computeRisk([{ type: "ten-la-moi" }]);
  eq(r.violationCount, 1, "su kien la van duoc dem vao violationCount");
  eq(r.riskScore, 15, "su kien la dung trong so medium mac dinh");
  eq(r.riskLevel, "low", "su kien la → low");
}

// Trừ điểm: không bao giờ vượt 100
{
  const many = Array.from({ length: 50 }, () => ({ type: "copy" }));
  const r = computeRisk(many);
  check(r.riskScore === 100, "diem bi gio han 100", `score=${r.riskScore}`);
  check(r.riskLevel === "high", "nhieu vi pham → high");
}

// Không bao giờ autoSubmit khi dưới ngưỡng
{
  const r = computeRisk(Array.from({ length: MAX_VIOLATIONS - 1 }, () => ({ type: "tab_blur" })));
  eq(r.autoSubmitted, false, "thieu 1 lan nua thi chua autoSubmit");
}

// Ngưỡng low/medium/high: 25 là mốc medium, 50 là mốc high
{
  const r = computeRisk([{ type: "copy" }, { type: "tab_blur" }]);
  eq(r.riskScore, 45, "copy+tab_blur = 45");
  eq(r.riskLevel, "medium", "45 → medium (duoi 50)");
  eq(computeRisk([{ type: "copy" }, { type: "paste" }]).riskLevel, "high", "copy+paste = 60 → high");
  eq(computeRisk([{ type: "tab_blur" }, { type: "context_menu" }]).riskLevel, "medium", "15+15 = 30 → medium");
  eq(computeRisk([{ type: "tab_blur" }]).riskLevel, "low", "15 → low");
}

// GĐ3 — sự kiện mới của rào trình duyệt
eq(isProctorEventType("print"), true, "print nam trong whitelist GĐ3");
eq(isProctorEventType("screen_share"), true, "screen_share nam trong whitelist GĐ3");
eq(severityOf("print"), "high", "print = high (in de)");
eq(severityOf("screen_share"), "high", "screen_share = high (ghi man hinh)");
eq(severityOf("view_source"), "medium", "view_source = medium");
eq(severityOf("screenshot"), "medium", "screenshot = medium");

// GĐ3 — chế độ chống gian lận
eq(isProctorMode("off"), true, "off la che do hop le");
eq(isProctorMode("light"), true, "light la che do hop le");
eq(isProctorMode("strict"), true, "strict la che do hop le");
eq(isProctorMode("max"), false, "che do la bi tu choi");
eq(resolveProctorMode("strict", { isMobile: false }), "strict", "may tinh: strict giu nguyen");
eq(resolveProctorMode("strict", { isMobile: true }), "light", "dien thoai: strict ha xuong light");
eq(resolveProctorMode("light", { isMobile: true }), "light", "dien thoai: light giu nguyen");
eq(resolveProctorMode("off", { isMobile: true }), "off", "off luon la off");
eq(proctorModeLabel("strict"), "Nghiêm", "co nhan tieng Viet cho strict");
eq(proctorModeLabel("khong-hop-le"), "Tắt", "che do la → nhan mac dinh Tat");

// print đẩy rủi ro lên nhanh: 1 lần print (high=30) đã là low, 2 lần = high
eq(computeRisk([{ type: "print" }]).riskScore, 30, "1 lan print = 30");
eq(computeRisk([{ type: "print" }, { type: "print" }]).riskLevel, "high", "2 lan print → high");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
