import { defineConfig, devices } from "@playwright/test";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).searchParams.get("schema")?.startsWith("lab4_issue31_e2e_")) {
  throw new Error("Run Issue #31 browser tests through server/scripts/run-issue31-e2e.mjs.");
}

export default defineConfig({
  testDir: process.env.ISSUE31_TEST_DIR ?? "../e2e/lab-04",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: process.env.ISSUE31_TEST_DIR
    ? "../tmp/issue31-regression-results.json"
    : "../tmp/issue31-playwright-results.json" }]],
  outputDir: "../tmp/playwright-issue31",
  use: {
    baseURL: "http://127.0.0.1:5174",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
