import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: process.env.ISSUE30_TEST_DIR ?? "./e2e/lab-04",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: "list",
  outputDir: "../tmp/playwright-issue30",
  use: {
    baseURL: process.env.ISSUE30_BASE_URL ?? "http://127.0.0.1:5174",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
});
