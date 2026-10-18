import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * PRE-4 — Hồi quy cho script preloader INLINE trong `app/layout.tsx`.
 *
 * Bug đã xảy ra (đo trên prod): React #418 làm React THAY node preloader giữa
 * chừng → vòng lặp animate node đã gỡ khỏi DOM → overlay thật đứng "0%" tới
 * khi failsafe CSS 6s dọn ("loading đứng đơ rồi vào luôn"). Trang này dựng 1
 * trang tĩnh từ ĐÚNG source (script inline + markup Preloader), không cần
 * DB/app chạy, rồi ép 3 kịch bản:
 *   A. Bình thường: % chạy rồi tự gỡ overlay.
 *   B. Node bị THAY giữa chừng → node mới nối tiến trình, không kẹt, tự dọn.
 *   C. Node TRÙNG bị chèn vào khi đang animate → bị ẩn, không che trang.
 *
 * Chạy cùng lệnh E2E thường (`--project=desktop`) — không đụng network/DB.
 */

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(tmpdir(), "a6-preloader-harness.html");

function buildHarness(): string {
  const layout = readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
  const parts = layout.split("__html: `");
  if (parts.length < 3) throw new Error("layout.tsx: không tìm thấy script preloader");
  let script = parts[2].split("`")[0];
  if (script.includes("`")) throw new Error("script chứa backtick — sai đoạn");

  /* Kéo dài MIN/CAP/RAMP ×5 trong BẢN SAO script để 3 kịch bản có vài giây
     đo (anim gốc ~0.6s không đủ thời gian lấy mẫu). Logic giữ NGUYÊN. */
  const swaps: [string, string][] = [
    ["var MIN=600, CAP=1600, RAMP=600", "var MIN=3000, CAP=6000, RAMP=3000"],
    ["{MIN=900;CAP=2200;RAMP=900;}", "{MIN=3000;CAP=6000;RAMP=3000;}"],
    ["{MIN=750;CAP=1900;RAMP=750;}", "{MIN=3000;CAP=6000;RAMP=3000;}"],
  ];
  for (const [from, to] of swaps) {
    if (!script.includes(from)) throw new Error("harness: không khớp hằng số — " + from);
    script = script.replace(from, to);
  }

  const pre = readFileSync(path.join(ROOT, "app/components/preloader.tsx"), "utf8");
  const m = pre.match(/const PRELOADER_HTML = `([\s\S]*?)`;/);
  if (!m) throw new Error("preloader.tsx: không tìm thấy PRELOADER_HTML");

  writeFileSync(
    OUT,
    `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>PRELOADER HARNESS</title>
<script>${script}</script>
</head>
<body>
${m[1]}
<div id="app"><h1>PAGE-CONTENT</h1></div>
</body>
</html>
`,
  );
  return pathToFileURL(OUT).href;
}

let HARNESS = "";

test.beforeAll(() => {
  HARNESS = buildHarness();
});

function watchErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}

async function pct(page: Page, nth = 0): Promise<number> {
  const t = await page.locator("[data-a6-pct]").nth(nth).textContent();
  return Number(t);
}

async function armReplace(page: Page): Promise<void> {
  // Thay node 250ms SAU khi preloader xuất hiện (t0+250 < lúc kết thúc ~t0+3000).
  await page.evaluate(() => {
    const swap = () => {
      const old = document.getElementById("a6-preloader");
      if (!old || !old.parentNode) return;
      const clone = old.cloneNode(true) as HTMLElement;
      old.parentNode.replaceChild(clone, old);
    };
    const wait = () => {
      const existing = document.getElementById("a6-preloader");
      if (existing) {
        window.setTimeout(swap, 250);
        return;
      }
      const mo = new MutationObserver(() => {
        if (document.getElementById("a6-preloader")) {
          mo.disconnect();
          window.setTimeout(swap, 250);
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    };
    wait();
  });
}

async function armDuplicate(page: Page): Promise<void> {
  // Chèn node trùng (không gỡ node cũ) 250ms sau khi preloader xuất hiện.
  await page.evaluate(() => {
    const dup = () => {
      const cur = document.getElementById("a6-preloader");
      if (!cur || !cur.parentNode) return;
      const clone = cur.cloneNode(true) as HTMLElement;
      cur.parentNode.insertBefore(clone, cur.nextSibling);
    };
    const wait = () => {
      const existing = document.getElementById("a6-preloader");
      if (existing) {
        window.setTimeout(dup, 250);
        return;
      }
      const mo = new MutationObserver(() => {
        if (document.getElementById("a6-preloader")) {
          mo.disconnect();
          window.setTimeout(dup, 250);
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    };
    wait();
  });
}

test("A: preloader chạy và tự gỡ", async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto(HARNESS);
  await expect(page.locator("#a6-preloader")).toHaveCount(1);
  const p1 = await pct(page);
  await page.waitForTimeout(300);
  const p2 = await pct(page);
  expect(p2, "phần trăm phải nhảy, không đứng yên").toBeGreaterThan(p1);
  await expect(page.locator("#a6-preloader")).toHaveCount(0, { timeout: 4000 });
  await expect(page.getByText("PAGE-CONTENT")).toBeVisible();
  expect(errs).toEqual([]);
});

test("B: node bị thay giữa chừng → nối tiến trình, không treo", async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto(HARNESS);
  await expect(page.locator("#a6-preloader")).toHaveCount(1);
  await armReplace(page);
  // node thay ở t0+250; lấy 2 mẫu khi overlay vẫn đang animate (trước t0+3000).
  await page.waitForTimeout(420);
  const s1 = await pct(page);
  await page.waitForTimeout(200);
  const s2 = await pct(page);
  expect(Number.isFinite(s1) && Number.isFinite(s2), "node mới phải nhận %").toBe(true);
  expect(s2, "node mới phải tiếp tục nhảy, không kẹt").toBeGreaterThanOrEqual(s1);
  await expect(page.locator("#a6-preloader")).toHaveCount(0, { timeout: 4000 });
  await expect(page.getByText("PAGE-CONTENT")).toBeVisible();
  expect(errs).toEqual([]);
});

test("C: chèn node trùng khi đang animate → bị ẩn, không che trang", async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto(HARNESS);
  await expect(page.locator("#a6-preloader")).toHaveCount(1);
  await armDuplicate(page);
  await page.waitForTimeout(450);
  // 2 node cùng id: [0] là node gốc đang animate, [1] là bản chèn trùng.
  await expect(page.locator("#a6-preloader").nth(1)).toHaveCSS("display", "none");
  await expect(page.locator("#a6-preloader:visible")).toHaveCount(1);
  // Node gốc bị gỡ lúc bùm; bản chèn trùng vẫn ẩn trong DOM → KHÔNG còn
  // lớp phủ nào đang hiển thị che trang.
  await expect(page.locator("#a6-preloader:visible")).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByText("PAGE-CONTENT")).toBeVisible();
  expect(errs).toEqual([]);
});
