/**
 * BRAND-2b — Gom hex hardcode trong app/components/lib về token CSS.
 *
 * Sau BRAND-2, `app/globals.css` đã mang bảng màu A6Class Education nhưng
 * code vẫn còn hàng trăm hex cũ rải rác, nên giao diện hiện pha trộn tím
 * cũ với xanh mới. Script này thay hex → `var(--token)` để mọi màu đều
 * chảy từ đúng một nguồn sự thật.
 *
 * Idempotent: chạy lại sẽ không còn gì để thay.
 *
 * Chạy: node scripts/migrate-brand-tokens.mjs           (xem trước)
 *       node scripts/migrate-brand-tokens.mjs --write   (ghi file)
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["app", "components", "lib"];
const WRITE = process.argv.includes("--write");

/** Ba file này bị loại có chủ ý — `var()` không hợp lệ trong ngữ cảnh của chúng:
 *  - app/manifest.ts : JSON, theme_color phải là hex thật.
 *  - lib/email.ts    : email client không render được CSS var.
 *  - lib/subject.ts  : map màu ngữ nghĩa theo môn, sửa tay cho khớp token môn. */
const SKIP = new Set(["app/manifest.ts", "lib/email.ts", "lib/subject.ts"]);

/** Hex cũ → token thay thế trong app/globals.css. */
const MAP = {
  // Nhóm tím thương hiệu cũ → navy/sky của A6Class
  "6C4CF1": "--primary",
  "5A3BD8": "--primary-hover",
  "7C5CF3": "--primary-hover",
  "8B6FF5": "--primary-muted",
  "9B7FF7": "--primary-muted",
  "B9A5FA": "--primary-muted",
  "F1EDFD": "--primary-light",
  "DCD4FA": "--primary-muted",
  "F4F2FD": "--surface-hover",
  // Chữ + viền
  "1F2937": "--text-primary",
  "4B5563": "--text-secondary",
  "5B6470": "--text-muted",
  "E7E5E0": "--surface-border",
  "D6D3CD": "--surface-border-strong",
  "1C1917": "--gray-900",
  // Trạng thái
  "0E7350": "--success",
  "E8F7F1": "--success-light",
  "8A5A00": "--warning",
  "FCF3E2": "--warning-light",
  "1A5FB0": "--blue",
  "EAF3FC": "--blue-light",

  // Đợt 2 — các sắc hover / viền / tối của bảng cũ. Phải giữ SỰ KHÁC BIỆT
  // giữa nền và nền-hover, nếu gộp chung về `--danger-light` / `--success-light`
  // thì trạng thái hover biến mất.
  "BE3B3B": "--danger",
  "FFECEC": "--danger-light",
  "FFDDDD": "--danger-hover",
  "FFF0F0": "--danger-hover",
  "7F1D1D": "--danger-dark",
  "9B1C1C": "--danger-dark",
  "F5E5BC": "--warning-border",
  "E9D8A6": "--warning-border",
  "FFF3E0": "--warning-hover",
  "FFF7E6": "--warning-hover",
  "78350F": "--warning-dark",
  "D3EFE5": "--success-light",
  "D2F0E3": "--success-light",
  "D5F2EC": "--success-light",
  "A8E6D6": "--success-border",
  "064E3B": "--success-dark",

  // Đợt 3 — nền cũ và các panel tối. Bảng cũ trộn 4 nền tối khác hue
  // (#2B1616 nâu-đen, #0A2A20 xanh-đen, #2B2358 tím-đen, #0D2A3E teal-navy);
  // gộp về --gray-900 một màu navy thống nhất.
  "F6F5FB": "--surface-bg",
  "46309F": "--primary",
  "4B31D0": "--primary-hover",
  "E4DCFA": "--primary-light",
  "D8EDFB": "--primary-light",
  "DCEBFC": "--primary-light",
  "2B1616": "--gray-900",
  "2B2410": "--gray-900",
  "0A2A20": "--gray-900",
  "0D2A3E": "--gray-900",
  "21383A": "--gray-900",
  "2B2358": "--gray-900",
  "0F172A": "--text-primary",
  "6B6890": "--text-muted",

  // Bản sao nội tuyến của chính bảng màu mới — cũng gom về token để
  // đổi bảng màu sau này không sót chỗ.
  "B45309": "--warning",
  "94A3B8": "--gray-400",
  "E2E8F0": "--gray-200",
  "CBD5E1": "--gray-300",
  "334155": "--gray-700",
  "5B6B8C": "--text-muted",
  "DFE5F0": "--surface-border",
  "7C8CA8": "--surface-border-strong",
};

/** Hex 8 ký tự trong arbitrary value, vd border-[#8A5A0080] → var(--warning)/50 */
const ALPHA_80 = new Set(["80"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r)).filter((f) => !SKIP.has(relative(".", f).replace(/\\/g, "/")));

let grandTotal = 0;
const changed = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  let count = 0;

  // Dạng arbitrary value của Tailwind: text-[#6C4CF1], bg-[#6C4CF1]/10,
  // border-[#6C4CF1]/40… Hậu tố /NN nằm ngoài ngoặc nên được giữ nguyên.
  let out = src.replace(/\[#([0-9A-Fa-f]{6})\]/g, (m, hex) => {
    const token = MAP[hex.toUpperCase()];
    if (!token) return m;
    count += 1;
    return `[var(${token})]`;
  });

  // Dạng hex 8 ký tự (có alpha): border-[#8A5A0080] → border-[var(--warning)]/50
  out = out.replace(/\[#([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})\]/g, (m, hex, alpha) => {
    const token = MAP[hex.toUpperCase()];
    if (!token || !ALPHA_80.has(alpha.toUpperCase())) return m;
    count += 1;
    return `[var(${token})]/50`;
  });

  // Dạng hex thuần trong object style / chuỗi: "#6C4CF1"
  out = out.replace(/"#([0-9A-Fa-f]{6})"/g, (m, hex) => {
    const token = MAP[hex.toUpperCase()];
    if (!token) return m;
    count += 1;
    return `"var(${token})"`;
  });

  if (count > 0) {
    changed.push({ file: relative(".", file).replace(/\\/g, "/"), count });
    grandTotal += count;
    if (WRITE) writeFileSync(file, out, "utf8");
  }
}

changed.sort((a, b) => b.count - a.count);
console.log(`\n=== BRAND-2b — gom hex về token ===`);
console.log(WRITE ? "CHE DO GHI FILE" : "CHE DO XEM TRUOC (dung --write de ghi)\n");
for (const c of changed) console.log(`  ${String(c.count).padStart(3)}  ${c.file}`);
console.log(`\nTong: ${grandTotal} the trong ${changed.length} file.`);
if (!WRITE && grandTotal > 0) console.log("Chay lai voi --write de ap dung.");