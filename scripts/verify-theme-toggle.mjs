import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "test-results/theme-toggle";
mkdirSync(OUT, { recursive: true });

const URL = process.env.URL ?? "http://localhost:3000";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
});

console.log(`navigate ${URL}`);
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForSelector('header a[href="/"]', { timeout: 30_000 });

// Read initial theme
const initialHasDark = await page.evaluate(() =>
  document.documentElement.classList.contains("dark"),
);
console.log(`initial dark? ${initialHasDark}`);
await page.screenshot({ path: `${OUT}/01-initial.png`, fullPage: false });

// Find and click the theme toggle (sun/moon icon button in navbar)
const toggle = page.locator(
  'header button[aria-label="切换到亮色背景"], header button[aria-label="切换到暗色背景"]',
);
await toggle.first().waitFor({ timeout: 10_000 });
await toggle.first().click();
await page.waitForTimeout(300);

const afterFirstClickHasDark = await page.evaluate(() =>
  document.documentElement.classList.contains("dark"),
);
console.log(`after click 1, dark? ${afterFirstClickHasDark}`);
await page.screenshot({ path: `${OUT}/02-after-toggle.png`, fullPage: false });

// Toggle back
await toggle.first().click();
await page.waitForTimeout(300);
const afterSecondClickHasDark = await page.evaluate(() =>
  document.documentElement.classList.contains("dark"),
);
console.log(`after click 2, dark? ${afterSecondClickHasDark}`);
await page.screenshot({ path: `${OUT}/03-toggled-back.png`, fullPage: false });

// Reload to confirm persistence (set to opposite of initial first)
await toggle.first().click();
await page.waitForTimeout(300);
const beforeReload = await page.evaluate(() =>
  document.documentElement.classList.contains("dark"),
);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector('header a[href="/"]', { timeout: 30_000 });
const afterReload = await page.evaluate(() =>
  document.documentElement.classList.contains("dark"),
);
console.log(
  `persistence: before reload dark=${beforeReload}, after reload dark=${afterReload}`,
);
await page.screenshot({ path: `${OUT}/04-after-reload.png`, fullPage: false });

const lsTheme = await page.evaluate(() =>
  window.localStorage.getItem("seedland-theme"),
);
console.log(`localStorage seedland-theme = ${lsTheme}`);

console.log(`\nerrors (${errors.length}):`);
for (const e of errors) console.log("  " + e);

await browser.close();
console.log(`\nscreenshots in ${OUT}/`);

const ok =
  initialHasDark !== afterFirstClickHasDark &&
  afterFirstClickHasDark !== afterSecondClickHasDark &&
  beforeReload === afterReload &&
  lsTheme !== null;
console.log(`\nverdict: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
