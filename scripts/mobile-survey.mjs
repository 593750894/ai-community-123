import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "test-results/mobile-survey";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:3000";

const PAGES = [
  { slug: "home", path: "/" },
  { slug: "community", path: "/community" },
  { slug: "showcase", path: "/showcase" },
  { slug: "tools", path: "/tools" },
];

const browser = await chromium.launch();

async function survey(mode) {
  const ctx = await browser.newContext({
    ...devices["iPhone 14"],
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript((m) => {
    try { window.localStorage.setItem("seedland-theme", m); } catch {}
  }, mode);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });

  for (const p of PAGES) {
    try {
      await page.goto(`${URL}${p.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForSelector('header a[href="/"]', { timeout: 30_000 });
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${mode}-${p.slug}.png` });
      console.log(`  ${mode} ${p.slug} OK`);
    } catch (e) {
      console.log(`  ${mode} ${p.slug} ERR: ${e.message}`);
    }
  }
  console.log(`${mode}: ${errors.length} console errors`);
  for (const e of errors) console.log("  " + e);
  await ctx.close();
}

await survey("light");
await survey("dark");
await browser.close();
console.log("done");
