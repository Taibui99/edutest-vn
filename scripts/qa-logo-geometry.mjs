import { chromium } from "@playwright/test";

/**
 * BRAND-3 — Kiểm chứng logo bằng pixel (không phụ thuộc nhìn).
 *
 * Bộ đo này không giả định hình dạng logo. Nó tách SVG thành hai lớp:
 *   - lớp nền: riêng hình chữ nhật bo góc (dải navy → cyan → gold)
 *   - lớp glyph: mũ, số 6, chấm vàng
 * rồi đo lớp glyph: có tràn mép ô không, có cân không, và — quan trọng nhất —
 * chữ trắng trên nền chuyển sắc có đủ tương phản ở MỌI điểm hay không.
 * Bản gốc đặt chữ trắng ở đoạn navy/cyan nên kỳ vọng đạt; nếu sau này ai đó
 * dời glyph sang góc gold thì số ở đây sẽ báo đỏ.
 */

const BASE = "http://localhost:3111";
// aria-label có thể đổi theo phát hiện, nên chỉ chọn đúng svg đầu tiên.
const MARK_SEL = '[aria-label^="A6Class"] svg, [role="img"][aria-label^="A6Class"] svg';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/vao-thi`, { waitUntil: "networkidle" });

const found = await page.locator(MARK_SEL).count();
if (!found) {
  await browser.close();
  console.log("LOI: khong tim thay SVG logo tren /vao-thi");
  process.exit(1);
}

/**
 * Rasterize các biến thể của SVG ở kích thước S và trả về mọi lớp cùng lúc
 * để so sánh chúng từng điểm ảnh.
 */
const render = (S) =>
  page.evaluate(
    async ({ sel, size }) => {
      const svg = document.querySelector(sel);
      const vb = svg.getAttribute("viewBox").split(/\s+/).map(Number);

      const rasterize = async (mutate) => {
        const clone = svg.cloneNode(true);
        mutate(clone);
        const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
          type: "image/svg+xml",
        });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = url;
        });
        URL.revokeObjectURL(url);
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        return ctx.getImageData(0, 0, size, size).data;
      };

      // Lop nen: giu hinh chu nhat, bo glyph.
      const bg = await rasterize((el) => {
        el.querySelectorAll("g > *").forEach((n) => {
          if (n.tagName !== "rect") n.remove();
        });
      });
      // Lop glyph: bo hinh chu nhat nen.
      const glyph = await rasterize((el) => {
        el.querySelectorAll("g > rect").forEach((n) => n.remove());
      });
      // Lop day du.
      const full = await rasterize(() => {});

      return { size, vb, bg: Array.from(bg), glyph: Array.from(glyph), full: Array.from(full) };
    },
    { sel: MARK_SEL, size: S }
  );

const srgb = (v) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

const S = 320;
const { vb, bg, glyph, full } = await render(S);
const k = S / vb[2]; // px -> don viet viewBox
const at = (arr, x, y) => (y * S + x) * 4;

let whiteN = 0;
let goldN = 0;
let worstWhite = Infinity;
let worstGold = Infinity;
const gbox = [S, S, -1, -1];
const wbox = [S, S, -1, -1];
const dbox = [S, S, -1, -1];

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = at(glyph, x, y);
    if (glyph[i + 3] < 40) continue; // ngoai glyph
    const gx0 = Math.min(gbox[0], x), gx1 = Math.max(gbox[2], x);
    const gy0 = Math.min(gbox[1], y), gy1 = Math.max(gbox[3], y);
    gbox[0] = gx0; gbox[1] = gy0; gbox[2] = gx1; gbox[3] = gy1;

    const f = at(full, x, y);
    const b = at(bg, x, y);
    const fg = lum(full[f], full[f + 1], full[f + 2]);
    const under = lum(bg[b], bg[b + 1], bg[b + 2]);
    const cr = ratio(fg, under);

    const [fr, fg2, fb] = [full[f], full[f + 1], full[f + 2]];
    if (fr > 225 && fg2 > 225 && fb > 225) {
      whiteN++;
      worstWhite = Math.min(worstWhite, cr);
      wbox[0] = Math.min(wbox[0], x); wbox[1] = Math.min(wbox[1], y);
      wbox[2] = Math.max(wbox[2], x); wbox[3] = Math.max(wbox[3], y);
    } else if (fr > 190 && fg2 > 140 && fb < 140) {
      goldN++;
      worstGold = Math.min(worstGold, cr);
      dbox[0] = Math.min(dbox[0], x); dbox[1] = Math.min(dbox[1], y);
      dbox[2] = Math.max(dbox[2], x); dbox[3] = Math.max(dbox[3], y);
    }
  }
}

const toUnits = (v) => Math.round((v / k) * 100) / 100;
const [gx0, gy0, gx1, gy1] = gbox.map(toUnits);
const [wx0, wy0, wx1, wy1] = wbox.map(toUnits);
const [dx0, dy0, dx1, dy1] = dbox.map(toUnits);
const tile = vb[2];

const checks = [];
checks.push(["Glyph trong ô (can >= 1.2)", Math.min(gx0, gy0, tile - gx1, tile - gy1) >= 1.2,
  `L${gx0} R${tile - gx1} T${gy0} B${tile - gy1}`]);
checks.push(["Glyph can giua ngang (lech <= 1.5)", Math.abs((gx0 + gx1) / 2 - tile / 2) <= 1.5,
  `tâm = ${toUnits((gx0 + gx1) / 2)}`]);
checks.push(["Glyph can giua doc (lech <= 1.5)", Math.abs((gy0 + gy1) / 2 - tile / 2) <= 1.5,
  `tâm = ${toUnits((gy0 + gy1) / 2)}`]);
checks.push(["Chu trang du tuong phan tren nen chuyen sac (>= 4.5)", worstWhite >= 4.5,
  `xau nhat ${worstWhite.toFixed(2)}:1`]);
checks.push(["Cham vang du tuong phan tren nen (>= 3.0)", worstGold >= 3.0,
  `xau nhat ${worstGold.toFixed(2)}:1`]);
checks.push(["Chu trang khong bi vay/cham", whiteN / (S * S) > 0.06,
  `${((whiteN / (S * S)) * 100).toFixed(1)}%`]);
checks.push(["Cham vang van hien", goldN / (S * S) > 0.004,
  `${((goldN / (S * S)) * 100).toFixed(1)}%`]);

console.log(`\n=== BRAND-3 — Do logo "${vb[2]}x${vb[3]}" bang pixel ===\n`);
console.log(`Chu trang   : ${((whiteN / (S * S)) * 100).toFixed(1)}%  bbox x ${wx0}..${wx1}  y ${wy0}..${wy1}`);
console.log(`Cham vang   : ${((goldN / (S * S)) * 100).toFixed(1)}%  bbox x ${dx0}..${dx1}  y ${dy0}..${dy1}`);
console.log(`Toan glyph  : x ${gx0}..${gx1}  y ${gy0}..${gy1}\n`);

let bad = 0;
for (const [name, ok, detail] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(52)} ${detail}`);
}

// Do doc o kich thuoc thuc: logo dung o 28 / 36 / 48px (sizes sm/md/lg).
// 20px va 24px la bai kiem tra du phong — nho hon moi kich thuoc that, nen
// nguong thap hon. Nguong 5% nghia la glyph chua tan thanh mot vet mau.
console.log(`\n=== BRAND-3 — Do doc o kich thuoc nho ===\n`);
console.log("size   chu trang   cham vang");
for (const size of [20, 24, 28, 32, 40, 48]) {
  const r = await render(size);
  let w = 0, g = 0;
  for (let i = 0; i < r.glyph.length; i += 4) {
    if (r.glyph[i + 3] < 40) continue;
    const [fr, fg2, fb] = [r.full[i], r.full[i + 1], r.full[i + 2]];
    if (fr > 225 && fg2 > 225 && fb > 225) w++;
    else if (fr > 190 && fg2 > 140 && fb < 140) g++;
  }
  const wPct = (w / (size * size)) * 100;
  const gPct = (g / (size * size)) * 100;
  console.log(`${String(size).padStart(3)}px  ${wPct.toFixed(1).padStart(8)}%   ${gPct.toFixed(1).padStart(8)}%`);
  // Chu trang la hinh chinh phai doc duoc o moi size. Cham vang la chi tiet
  // trang tri nam trong ruot so 6, o 20px no bien mat la duong chp nhan.
  if (wPct < 5) { bad++; console.log(`FAIL  ${size}px: chu trang nho qua (<5%)`); }
  if (size >= 24 && gPct < 0.4) { bad++; console.log(`FAIL  ${size}px: cham vang bay (<0.4%)`); }
}

console.log(`\n${checks.length - bad}/${checks.length} khop dat.`);
await browser.close();
if (bad) process.exit(1);