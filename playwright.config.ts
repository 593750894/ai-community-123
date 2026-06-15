import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// stage 10.x 测试依赖 mock provider 跑通下单 → webhook → 退款链路。
// 源码已强制：mock 仅在 PAYMENT_MOCK_ENABLED=true 且 PAYMENT_MOCK_SECRET 显式配置时启用。
// 在 webServer.env 注入这俩，开发者不用每次都改 .env.local；
// CI / 真实部署 NEVER 该传 PAYMENT_MOCK_ENABLED=true。
const TEST_MOCK_SECRET =
  process.env.PAYMENT_MOCK_SECRET || "seedland-dev-mock-secret";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    headless: true,
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_REUSE_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          PAYMENT_MOCK_ENABLED: "true",
          PAYMENT_MOCK_SECRET: TEST_MOCK_SECRET,
        },
      },
});
