/**
 * BRAND-1 — Kiem tra do phan biet WCAG cho bang mau A6Class Education (nen sang).
 *
 * Mau goc cua A6Class la nen TOI navy nen gia tri raw (#38BDF8 sky-400, #FBBF24
 * amber-400, #FB7185 rose-400) chi dat ~1.9:1 tren nen sang -> khong du lam
 * mau chu. Script nay kiem chung cac bien theo khop sang mau da dam lai,
 * de khong ship mot bang mau that bai o che do sang.
 *
 * Chay: node scripts/qa-brand-contrast.mjs
 */

const PALETTE = {
  surfaceBg: "#F5F7FB",
  surfaceCard: "#FFFFFF",
  surfaceHover: "#EEF3FA",
  surfaceBorder: "#DFE5F0",
  surfaceBorderStrong: "#7C8CA8",

  textPrimary: "#0F1729",
  textSecondary: "#33415F",
  textMuted: "#5B6B8C",

  primary: "#0369A1",
  primaryHover: "#075985",
  primaryLight: "#E0F2FE",
  secondary: "#6D28D9",
  secondaryLight: "#EDE9FE",
  accent: "#B45309",
  accentLight: "#FEF3C7",

  success: "#047857",
  successLight: "#D1FAE5",
  warning: "#B45309",
  warningLight: "#FEF3C7",
  danger: "#BE123C",
  dangerLight: "#FFE4E6",
  info: "#1D4ED8",
  infoLight: "#DBEAFE",
};

/** Mon mau the he A6Class (dang duoi 700 de dat AA tren nen sang). */
const SUBJECTS = {
  "subject-toan": { fg: "#0369A1", bg: "#E0F2FE" },
  "subject-van": { fg: "#BE123C", bg: "#FFE4E6" },
  "subject-anh": { fg: "#6D28D9", bg: "#EDE9FE" },
  "subject-ly": { fg: "#B45309", bg: "#FEF3C7" },
  "subject-hoa": { fg: "#047857", bg: "#D1FAE5" },
  "subject-sinh": { fg: "#0F766E", bg: "#CCFBF1" },
};

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
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
const AA_LARGE = 3.0;
const AA_NON_TEXT = 3.0;

const P = PALETTE;
const checks = [
  ["Chu chinh tren nen trang", P.textPrimary, P.surfaceCard, AA_TEXT],
  ["Chu chinh tren nen trang tang", P.textPrimary, P.surfaceBg, AA_TEXT],
  ["Chu phu tren nen trang", P.textSecondary, P.surfaceCard, AA_TEXT],
  ["Chu phu tren nen trang tang", P.textSecondary, P.surfaceBg, AA_TEXT],
  ["Chu mo tren nen trang", P.textMuted, P.surfaceCard, AA_TEXT],
  ["Chu mo tren nen trang tang", P.textMuted, P.surfaceBg, AA_TEXT],
  ["Chu mo tren nen hover", P.textMuted, P.surfaceHover, AA_TEXT],

  ["Primary tren nen trang", P.primary, P.surfaceCard, AA_TEXT],
  ["Primary tren nen trang tang", P.primary, P.surfaceBg, AA_TEXT],
  ["Hover primary tren nen trang", P.primaryHover, P.surfaceCard, AA_TEXT],
  ["Chu trang tren nut primary", "#FFFFFF", P.primary, AA_TEXT],
  ["Chu trang tren nut primary hover", "#FFFFFF", P.primaryHover, AA_TEXT],

  ["Secondary tren nen trang", P.secondary, P.surfaceCard, AA_TEXT],
  ["Chu trang tren nut secondary", "#FFFFFF", P.secondary, AA_TEXT],
  ["Chu trang nen accent (logo)", "#FFFFFF", "#B45309", AA_TEXT],
  ["Accent tren nen trang tang", P.accent, P.surfaceBg, AA_TEXT],

  ["Success tren nen trang", P.success, P.surfaceCard, AA_TEXT],
  ["Success tren nen nhat success", P.success, P.successLight, AA_TEXT],
  ["Warning tren nen trang", P.warning, P.surfaceCard, AA_TEXT],
  ["Warning tren nen nhat warning", P.warning, P.warningLight, AA_TEXT],
  ["Danger tren nen trang", P.danger, P.surfaceCard, AA_TEXT],
  ["Danger tren nen nhat danger", P.danger, P.dangerLight, AA_TEXT],
  ["Info tren nen trang", P.info, P.surfaceCard, AA_TEXT],
  ["Info tren nen nhat info", P.info, P.infoLight, AA_TEXT],

  ["Primary tren nen nhat primary", P.primary, P.primaryLight, AA_TEXT],
  ["Secondary tren nen nhat secondary", P.secondary, P.secondaryLight, AA_TEXT],

  // WCAG 1.4.11 chi yeu cau 3:1 cho vung phan dinh nghiep, khong ap cho
  // duong phan cach trang trinh.nen nen --surface-border chi mang tinh
  // trang trinh nen khong co nguong; --surface-borderStrong (vien o nhap,
  // checkbox, vien control) moi phai dat 3:1 tren ca 3 nen.
  ["Vien control tren nen trang", P.surfaceBorderStrong, P.surfaceCard, AA_NON_TEXT],
  ["Vien control tren nen trang tang", P.surfaceBorderStrong, P.surfaceBg, AA_NON_TEXT],
  ["Vien control tren nen hover", P.surfaceBorderStrong, P.surfaceHover, AA_NON_TEXT],
];

for (const [name, s] of Object.entries(SUBJECTS)) {
  checks.push([`${name} tren nen nhat`, s.fg, s.bg, AA_TEXT]);
}

let failed = 0;
const rows = checks.map(([name, fg, bg, min]) => {
  const ratio = contrast(fg, bg);
  const pass = ratio >= min;
  if (!pass) failed += 1;
  return { name, fg, bg, ratio, min, pass };
});

const pad = (v, n) => String(v).padEnd(n);
console.log("\n=== BRAND-1 — Do phan biet WCAG AA (A6Class Education, nen sang) ===\n");
for (const r of rows) {
  const mark = r.pass ? "PASS" : "FAIL";
  const val = r.ratio.toFixed(2).padStart(6);
  console.log(
    `${mark}  ${pad(r.name, 36)} ${r.fg} / ${r.bg}  ${val}:1  (can >= ${r.min})`,
  );
}

console.log(`\n${rows.length - failed}/${rows.length} khop dat.`);
if (failed > 0) {
  console.log(`\n${failed} khop KHONG dat — can dam chu hon hoac sang nen hon.`);
  process.exit(1);
}
console.log("Bang mau dat WCAG AA o che do sang.");