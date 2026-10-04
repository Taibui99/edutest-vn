import { chromium } from "playwright";

/** BRAND-3 — Font có thực sự được nạp và áp dụng đúng vai trò không. */
const BASE = "http://localhost:3111";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/vao-thi`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

const info = await page.evaluate(() => {
  const bodyFam = getComputedStyle(document.body).fontFamily;
  const h = document.querySelector("h1, h2, h3");
  const headFam = h ? getComputedStyle(h).fontFamily : null;
  const loaded = [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`);
  return { bodyFam, headFam, headTag: h?.tagName, loaded };
});

const fails = [];
const has = (fam, needle) => fam.toLowerCase().includes(needle);

if (!has(info.bodyFam, "inter")) fails.push(`body chua dung Inter: ${info.bodyFam}`);
if (info.headFam && !has(info.headFam, "be vietnam pro")) {
  fails.push(`${info.headTag} chua dung Be Vietnam Pro: ${info.headFam}`);
}
const interLoaded = info.loaded.some((f) => f.includes("Inter") && f.includes("loaded"));
const bvLoaded = info.loaded.some((f) => f.includes("Be Vietnam Pro") && f.includes("loaded"));
if (!interLoaded) fails.push("Inter chua bat dau tai (font chua duoc dung den)");
if (!bvLoaded) fails.push("Be Vietnam Pro chua bat dau tai");

console.log(`\n=== BRAND-3 — Kiem tra font ===\n`);
console.log(`body          : ${info.bodyFam}`);
console.log(`${info.headTag ?? "Khong co tieu de"}          : ${info.headFam}`);
console.log(`\nFont da nap (${info.loaded.filter((f) => f.includes("loaded")).length}/${info.loaded.length}):`);
for (const f of info.loaded) console.log(`  ${f}`);

console.log("");
if (fails.length) {
  for (const f of fails) console.log(`FAIL  ${f}`);
} else {
  console.log("PASS  Body dung Inter, tieu de dung Be Vietnam Pro, ca hai da duoc tai.");
}

await browser.close();
if (fails.length) process.exit(1);