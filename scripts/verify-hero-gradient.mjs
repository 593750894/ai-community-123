import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "test-results/hero-gradient";
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

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

// Ensure we start fresh in dark mode
await page.evaluate(() => window.localStorage.removeItem("seedland-theme"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector('header a[href="/"]', { timeout: 30_000 });

// Find the hero h1 — it's the first h1 that contains the gradient spans
const heroH1 = page.locator("main h1").first();
await heroH1.waitFor({ timeout: 15_000 });

// Dark mode screenshots
console.log(`dark? ${await page.evaluate(() => document.documentElement.classList.contains("dark"))}`);
await page.screenshot({ path: `${OUT}/01-dark-page.png`, fullPage: false });
await heroH1.screenshot({ path: `${OUT}/02-dark-hero.png` });

// Toggle to light
const toggle = page.locator(
  'header button[aria-label="切换到亮色背景"], header button[aria-label="切换到暗色背景"]',
).first();
await toggle.click();
await page.waitForTimeout(400);

console.log(`dark? ${await page.evaluate(() => document.documentElement.classList.contains("dark"))}`);
await page.screenshot({ path: `${OUT}/03-light-page.png`, fullPage: false });
await heroH1.screenshot({ path: `${OUT}/04-light-hero.png` });

// Sample the actual rendered color of one gradient span at a few points (read-back from canvas)
const sampled = await page.evaluate(async () => {
  const span = document.querySelector("main h1 .text-gradient-brand");
  if (!span) return { error: "no gradient span" };
  const cs = window.getComputedStyle(span);
  return {
    backgroundImage: cs.backgroundImage,
    color: cs.color,
    webkitBackgroundClip: cs.webkitBackgroundClip,
  };
});
console.log("light-mode computed:", JSON.stringify(sampled, null, 2));

console.log(`\nerrors (${errors.length}):`);
for (const e of errors) console.log("  " + e);

await browser.close();
console.log(`\nscreenshots in ${OUT}/`);
