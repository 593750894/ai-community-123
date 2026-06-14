import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "test-results/open-app";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:3000";

const browser = await chromium.launch();

async function snap(mode) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((m) => {
    try { window.localStorage.setItem("seedland-theme", m); } catch {}
  }, mode);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('header a[href="/"]', { timeout: 30_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${mode}.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log(`${mode}: ${errors.length} console errors`);
  for (const e of errors) console.log("  " + e);
  await ctx.close();
}

await snap("light");
await snap("dark");
await browser.close();
console.log("done");
