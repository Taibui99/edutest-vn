/**
 * BRAND-1 — Kiem tra do phan biet WCAG AA cho bang mau A6Class Education (nen sang).
 *
 * Mau goc cua A6Class la nen TOI navy nen gia tri raw (#38BDF8 sky-400, #FBBF24
 * amber-400, #FB7185 rose-400) chi dat ~1.9:1 tren nen sang -> khong du lam
 * mau chu. Script nay kiem chung cac bien theo khop sang mau da dam lai,
 * de khong ship mot bang mau that bai o che do sang.
 *
 * Doc truc tiep `app/globals.css` (khoi `:root`) chu khong hardcode gia tri:
 * script va bang mau la mot, nen ho khong the tro ch nhau.
 *
 * Chay: node scripts/qa-brand-contrast.mjs
 */

import { readFileSync } from "node:fs";

const CSS = "app/globals.css";

/** Lay cac bien trong khoi `:root` dau tien (che do sang — thu tu uu tien ship). */
function readLightTokens(file) {
  const css = readFileSync(file, "utf8");
  const root = css.match(/(^|[;}\s])@theme\s+inline\s*\{|:root\s*\{/g);
  if (!root) throw new Error(`Khong tim thay khoi :root trong ${file}`);

  const start = css.indexOf(":root");
  let depth = 0;
  let end = start;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const body = css.slice(start, end);
  const tokens = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

const T = readLightTokens(CSS);

function hex(name) {
  const v = T[name];
  if (!v) throw new Error(`Thieu token ${name} trong ${CSS}`);
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) throw new Error(`Token ${name} khong phai hex 6 ky tu: ${v}`);
  return v;
}

/** Mon mau: token `--subject-xxx` + `--subject-xxx-bg` deu ton tai trong globals.css. */
function subjectTokens() {
  const out = {};
  for (const [name, value] of Object.entries(T)) {
    const m = name.match(/^--subject-([a-z]+)$/);
    if (m && T[`--subject-${m[1]}-bg`]) out[m[1]] = { fg: value, bg: T[`--subject-${m[1]}-bg`] };
  }
  return out;
}

function hexToRgb(h) {
  const full = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function luminance(hexValue) {
  const [r, g, b] = hexToRgb(hexValue).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** AA: 4.5:1 cho chu binh thuong, 3:1 cho chu lon (>=18.66px bold hoac >=24px). */
const AA_TEXT = 4.5;
const AA_NON_TEXT = 3.0;
const WHITE = "#FFFFFF";

const checks = [];
const add = (name, fgToken, bgToken, min = AA_TEXT) => {
  const fg = fgToken.startsWith("#") ? fgToken : hex(fgToken);
  const bg = bgToken.startsWith("#") ? bgToken : hex(bgToken);
  checks.push([name, fg, bg, min]);
};

// Chu
add("Chu chinh tren nen trang", "--text-primary", "--surface-card");
add("Chu chinh tren nen trang tang", "--text-primary", "--surface-bg");
add("Chu phu tren nen trang", "--text-secondary", "--surface-card");
add("Chu phu tren nen trang tang", "--text-secondary", "--surface-bg");
add("Chu mo tren nen trang", "--text-muted", "--surface-card");
add("Chu mo tren nen trang tang", "--text-muted", "--surface-bg");
add("Chu mo tren nen hover", "--text-muted", "--surface-hover");

// Primary
add("Primary tren nen trang", "--primary", "--surface-card");
add("Primary tren nen trang tang", "--primary", "--surface-bg");
add("Hover primary tren nen trang", "--primary-hover", "--surface-card");
add("Chu trang tren nut primary", WHITE, "--primary");
add("Chu trang tren nut primary hover", WHITE, "--primary-hover");
add("Primary tren nen nhat primary", "--primary", "--primary-light");

// Secondary / accent — hai màu này giờ CHỈ dùng làm nền, nên phải kiểm cặp
// chữ-trên-nền đúng như bản gốc: nút gold/cyan đều đặt chữ navy.
add("Secondary-dark tren nen trang", "--secondary-dark", "--surface-card");
add("Secondary-dark tren nen nhat secondary", "--secondary-dark", "--secondary-light");
add("Accent-dark tren nen trang", "--accent-dark", "--surface-card");
add("Accent-dark tren nen nhat accent", "--accent-dark", "--accent-light");
add("Chu navy tren nut gold (logo/badge)", "--primary-dark", "--accent");
add("Chu navy tren nut cyan", "--primary-dark", "--secondary");

// Trang thai
add("Success tren nen trang", "--success", "--surface-card");
add("Success tren nen nhat success", "--success", "--success-light");
add("Warning tren nen trang", "--warning", "--surface-card");
add("Warning tren nen nhat warning", "--warning", "--warning-light");
add("Danger tren nen trang", "--danger", "--surface-card");
add("Danger tren nen nhat danger", "--danger", "--danger-light");
add("Info tren nen trang", "--info", "--surface-card");
add("Info tren nen nhat info", "--info", "--info-light");

// Sắc tối + nền hover. Cần giữ riêng vì nếu gộp chung, hover biến mất và
// các nhãn trạng thái mất độ phân biệt so với chữ chính.
add("Success-dark tren nen trang", "--success-dark", "--surface-card");
add("Warning-dark tren nen trang", "--warning-dark", "--surface-card");
add("Danger-dark tren nen trang", "--danger-dark", "--surface-card");
add("Danger tren nen hover danger", "--danger", "--danger-hover");
add("Warning-dark tren nen hover warning", "--warning-dark", "--warning-hover");

// WCAG 1.4.11 chi yeu cau 3:1 cho vung phan dinh nghiep, khong ap cho duong
// phan cach trang trinh. Nen --surface-border chi mang tinh trang trinh nen
// khong co nguong; --surface-border-strong (vien o nhap, checkbox, vien
// control) moi phai dat 3:1 tren ca 3 nen.
add("Vien control tren nen trang", "--surface-border-strong", "--surface-card", AA_NON_TEXT);
add("Vien control tren nen trang tang", "--surface-border-strong", "--surface-bg", AA_NON_TEXT);
add("Vien control tren nen hover", "--surface-border-strong", "--surface-hover", AA_NON_TEXT);

for (const [slug, s] of Object.entries(subjectTokens())) {
  add(`Mon ${slug} tren nen nhat`, s.fg, s.bg);
}

let failed = 0;
const pad = (v, n) => String(v).padEnd(n);

console.log("\n=== BRAND-1 — Do phan biet WCAG AA (A6Class Education, nen sang) ===");
console.log(`Nguon: ${CSS} · ${Object.keys(subjectTokens()).length} cap mau mon\n`);

for (const [name, fg, bg, min] of checks) {
  const ratio = contrast(fg, bg);
  const pass = ratio >= min;
  if (!pass) failed += 1;
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${pad(name, 36)} ${fg} / ${bg}  ${ratio.toFixed(2).padStart(6)}:1  (can >= ${min})`,
  );
}

console.log(`\n${checks.length - failed}/${checks.length} khop dat.`);
if (failed > 0) {
  console.log(`\n${failed} khop KHONG dat — can dam chu hon hoac sang nen hon.`);
  process.exit(1);
}
console.log("Bang mau dat WCAG AA o che do sang.");