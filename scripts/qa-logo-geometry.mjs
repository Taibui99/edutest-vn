import { chromium } from "@playwright/test";

/**
 * BRAND-3 — Kiểm chứng hình học logo bằng pixel (không phụ thuộc nhìn).
 *
 * Rasterize SVG của LogoMark trong canvas rồi đếm pixel theo màu, để chắc:
 * trang trắng nằm đúng giữa tile, check hổ phách không tràn mép, và tỉ lệ
 * trắng:check không lệch quá xa.
 */

const BASE = "http://localhost:3111";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/vao-thi`, { waitUntil: "networkidle" });

/** Rasterize SVG ở kích thước px thật rồi đếm pixel theo nhóm màu. */
const countAt = async (size) =>
  page.evaluate(async (S) => {
    const svg = document.querySelector('a[aria-label="A6Class"] svg');
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, S, S);
    const d = ctx.getImageData(0, 0, S, S).data;
    let white = 0, amber = 0, line = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 225 && g > 225 && b > 225) white++;
      else if (r > 170 && g > 130 && b < 150) amber++;
      else if (b > r + 25) line++;
    }
    return { white, amber, line, total: S * S };
  }, size);

const result = await page.evaluate(async () => {
  const svg = document.querySelector('a[aria-label="A6Class"] svg');
  if (!svg) return { error: "khong tim thay SVG" };
  const markup = new XMLSerializer().serializeToString(svg);

  const blob = new Blob([markup], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });

  const S = 320;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;

  let white = 0;
  let amber = 0;
  const wbox = [S, S, -1, -1];
  const abox = [S, S, -1, -1];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const r = d[i], g = d[i + 1], bl = d[i + 2], a = d[i + 3];
      if (a < 40) continue;
      if (r > 232 && g > 232 && bl > 232) {
        white++;
        wbox[0] = Math.min(wbox[0], x); wbox[1] = Math.min(wbox[1], y);
        wbox[2] = Math.max(wbox[2], x); wbox[3] = Math.max(wbox[3], y);
      } else if (r > 200 && g > 160 && bl < 140) {
        amber++;
        abox[0] = Math.min(abox[0], x); abox[1] = Math.min(abox[1], y);
        abox[2] = Math.max(abox[2], x); abox[3] = Math.max(abox[3], y);
      }
    }
  }

  const vb = svg.getAttribute("viewBox").split(/\s+/).map(Number);
  const k = S / vb[2];
  const toPx = (v) => v * k;
  return {
    S,
    white,
    amber,
    whitePct: +((white / (S * S)) * 100).toFixed(1),
    amberPct: +((amber / (S * S)) * 100).toFixed(1),
    ratio: +(white / Math.max(amber, 1)).toFixed(2),
    wboxPx: wbox.map((v) => Math.round(v / k * 10) / 10),
    aboxPx: abox.map((v) => Math.round(v / k * 10) / 10),
    viewBox: vb,
  };
});

if (result.error) {
  await browser.close();
  console.log("LOI: " + result.error);
  process.exit(1);
}

const [wx0, wy0, wx1, wy1] = result.wboxPx;
const [ax0, ay0, ax1, ay1] = result.aboxPx;
const [, , vw, vh] = result.viewBox;

console.log("\n=== BRAND-3 — Do hinh hoc logo (don viet viewBox 32) ===\n");
console.log(`viewBox         : 0 0 ${vw} ${vh}`);
console.log(`Trang trang     : ${result.white} px (${result.whitePct}%)  bbox x ${wx0}..${wx1}  y ${wy0}..${wy1}`);
console.log(`Check ho phach  : ${result.amber} px (${result.amberPct}%)  bbox x ${ax0}..${ax1}  y ${ay0}..${ay1}`);
console.log(`Ty le trang:check = ${result.ratio}`);

const checks = [];
checks.push(["Trang khong tran mep (tren >= 0.6)", wy0 >= 0.6, `tren = ${wy0}`]);
checks.push(["Trang khong tran mep (duoi <= 31.4)", wy1 <= 31.4, `duoi = ${wy1}`]);
checks.push(["Check khong tran mep (phai <= 31.4)", ax1 <= 31.4, `phai = ${ax1}`]);
checks.push(["Trang can giua theo chieu doc", Math.abs((wy0 + wy1) / 2 - 16) < 1.6, `tâm = ${((wy0 + wy1) / 2).toFixed(1)} (mong doi 16)`]);
const pageW = wx1 - wx0;
const pageH = wy1 - wy0;
const pageRatio = pageW / pageH;
checks.push(["Trang dung ty le giay A4 (0.68-0.82)", pageRatio > 0.68 && pageRatio < 0.82, `r/h = ${pageRatio.toFixed(2)}`]);

// Can bang ca cum trang + check trong o 32x32
const ux0 = Math.min(wx0, ax0), ux1 = Math.max(wx1, ax1);
const uy0 = Math.min(wy0, ay0), uy1 = Math.max(wy1, ay1);
const cxs = (ux0 + ux1) / 2, cys = (uy0 + uy1) / 2;
const lGap = ux0 - 0, rGap = 32 - ux1, tGap = uy0 - 0, bGap = 32 - uy1;
checks.push(["Can ngang (lech <= 0.6)", Math.abs(cxs - 16) <= 0.6, `tâm = ${cxs.toFixed(2)} (mong doi 16)`]);
checks.push(["Can doc (lech <= 0.6)", Math.abs(cys - 16) <= 0.6, `tâm = ${cys.toFixed(2)} (mong doi 16)`]);
checks.push(["Le bang deu (|max lech| <= 0.8)", Math.max(lGap, rGap, tGap, bGap) - Math.min(lGap, rGap, tGap, bGap) <= 0.8,
  `L${lGap.toFixed(2)} R${rGap.toFixed(2)} T${tGap.toFixed(2)} B${bGap.toFixed(2)}`]);
checks.push(["Check nam o nua duoi phai", (ax0 + ax1) / 2 > 16 && (ay0 + ay1) / 2 > 16, `tâm = ${((ax0 + ax1) / 2).toFixed(1)}, ${((ay0 + ay1) / 2).toFixed(1)}`]);
checks.push(["Check khong bi trang che", result.amberPct > 2.5, `${result.amberPct}%`]);
checks.push(["Ty le trang:check trong khoang 1.5-6", result.ratio > 1.5 && result.ratio < 6, `${result.ratio}`]);

let bad = 0;
console.log("");
for (const [name, ok, detail] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(38)} ${detail}`);
}
console.log(`\n${checks.length - bad}/${checks.length} khop dat.`);

// --- Do doc o kich thuoc thuc (sidebar 28px, mobile nho 20px) ---
console.log("\n=== BRAND-3 — Do doc o kich thuoc nho ===\n");
console.log("size   trang    check    duong-chu");
const small = [];
for (const size of [20, 24, 28, 32, 40]) {
  const c = await countAt(size);
  const wPct = (c.white / c.total) * 100;
  const aPct = (c.amber / c.total) * 100;
  const lPct = (c.line / c.total) * 100;
  console.log(
    `${String(size).padStart(3)}px  ${wPct.toFixed(1)}%    ${aPct.toFixed(1)}%    ${lPct.toFixed(1)}%`
  );
  small.push({ size, wPct, aPct, lPct });
}

console.log("");
const smChecks = [];
for (const s of small) {
  smChecks.push([`${s.size}px: trang doc duoc (>=6%)`, s.wPct >= 6, `${s.wPct.toFixed(1)}%`]);
  smChecks.push([`${s.size}px: check van hien (>=1.2%)`, s.aPct >= 1.2, `${s.aPct.toFixed(1)}%`]);
}
for (const [name, ok, detail] of smChecks) {
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(38)} ${detail}`);
}

console.log(
  `\nTong: ${checks.length + smChecks.length - bad}/${checks.length + smChecks.length} khop dat.`
);
await browser.close();
if (bad) process.exit(1);