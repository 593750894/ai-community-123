import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "test-results/light-mode-survey";
mkdirSync(OUT, { recursive: true });

const URL = process.env.URL ?? "http://localhost:3000";
const PAGES = [
  { slug: "home", path: "/" },
  { slug: "community", path: "/community" },
  { slug: "showcase", path: "/showcase" },
  { slug: "tools", path: "/tools" },
  { slug: "collaboration", path: "/collaboration" },
  { slug: "pricing", path: "/pricing" },
];

const browser = await chromium.launch();

async function survey(mode) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Seed theme via storage init script
  await ctx.addInitScript((m) => {
    try { window.localStorage.setItem("seedland-theme", m); } catch {}
  }, mode);

  for (const p of PAGES) {
    try {
      await page.goto(`${URL}${p.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForSelector('header a[href="/"]', { timeout: 30_000 });
      await page.waitForTimeout(800); // let lazy content settle
      // Top-of-page shot (above-the-fold)
      await page.screenshot({
        path: `${OUT}/${mode}-${p.slug}-top.png`,
        clip: { x: 0, y: 0, width: 1440, height: 900 },
      });
      // Full page shot
      await page.screenshot({
        path: `${OUT}/${mode}-${p.slug}-full.png`,
        fullPage: true,
      });
      console.log(`  ${mode} ${p.slug} OK`);
    } catch (e) {
      console.log(`  ${mode} ${p.slug} ERR: ${e.message}`);
    }
  }
  await ctx.close();
}

console.log("LIGHT survey:");
await survey("light");
console.log("DARK survey:");
await survey("dark");

await browser.close();
console.log(`\nscreenshots in ${OUT}/`);
