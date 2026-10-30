import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const evidenceDirectory = resolve(
  process.cwd(),
  "..",
  "artifacts",
  "lab-04",
  "screenshots",
  "issue-30",
);
const apiUrl = process.env.ISSUE30_API_URL ?? "http://127.0.0.1:3100";
const initialPassword = "TokTickIT-Lab3!";

function changedPassword(email: string) {
  return `E2E-${email.replace(/[^a-z]/gi, "")}!2026`;
}

async function authenticate(page: Page, email: string, expectedHeading: string) {
  const establishedPassword = changedPassword(email);
  let currentPassword = establishedPassword;
  let login = await page.context().request.post(`${apiUrl}/api/auth/login`, {
    data: { email, password: currentPassword },
  });
  if (login.status() === 401) {
    currentPassword = initialPassword;
    login = await page.context().request.post(`${apiUrl}/api/auth/login`, {
      data: { email, password: currentPassword },
    });
  }
  expect(login.status()).toBe(200);
  const loginBody = await login.json();

  if (loginBody.data.user.mustChangePassword) {
    const change = await page.context().request.post(`${apiUrl}/api/auth/change-password`, {
      headers: {
        Origin: "http://127.0.0.1:5174",
        "X-CSRF-Token": loginBody.data.csrfToken,
      },
      data: {
        currentPassword,
        newPassword: establishedPassword,
        confirmPassword: establishedPassword,
      },
    });
    expect(change.status()).toBe(200);
  }

  await page.goto("/");
  await expect(page.getByRole("heading", { name: expectedHeading })).toBeVisible();
}

function observeBrowserFailures(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console [${message.location().url}]: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    failures.push(`request: ${request.method()} ${request.url()} (${request.failure()?.errorText})`);
  });
  return failures;
}

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

test.describe.serial("Issue #30 responsive, accessibility, and product hardening", () => {
  test("captures desktop Staff workflow and visible keyboard focus", async ({ page }) => {
    const failures = observeBrowserFailures(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticate(page, "ari.staff@example.com", "Staff Dashboard");

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: "Staff Dashboard" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Application navigation" })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.screenshot({
      path: resolve(evidenceDirectory, "desktop-responsive.png"),
      fullPage: true,
    });

    await page.keyboard.press("Tab");
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const focusedText = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
      if (focusedText === "Ticket Queue") break;
      await page.keyboard.press("Tab");
    }
    const ticketQueueButton = page.getByRole("button", { name: "Ticket Queue" });
    await expect(ticketQueueButton).toBeFocused();
    const focusStyle = await ticketQueueButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    expect(
      (focusStyle.outlineStyle !== "none" && focusStyle.outlineWidth !== "0px") ||
      focusStyle.boxShadow !== "none",
    ).toBe(true);
    await page.screenshot({
      path: resolve(evidenceDirectory, "accessibility-check.png"),
      fullPage: true,
    });

    // Playwright key presses do not alter Chromium's browser-level zoom.
    // Halving the CSS viewport exercises the equivalent 200% reflow width
    // deterministically while preserving a real browser layout check.
    const initialViewport = page.viewportSize();
    expect(initialViewport).not.toBeNull();
    await page.setViewportSize({
      width: Math.floor(initialViewport!.width / 2),
      height: Math.floor(initialViewport!.height / 2),
    });
    expect(await page.evaluate(() => window.innerWidth)).toBe(
      Math.floor(initialViewport!.width / 2),
    );
    await expectNoDocumentOverflow(page);
    await page.screenshot({
      path: resolve(evidenceDirectory, "zoom-200-reflow.png"),
      fullPage: true,
    });

    expect(failures).toEqual([]);
  });

  test("captures tablet and mobile Requester workflows without overflow", async ({ page }) => {
    const failures = observeBrowserFailures(page);
    await page.setViewportSize({ width: 800, height: 1024 });
    await authenticate(page, "narin@example.com", "Your Dashboard");

    await expect(page.getByRole("main").getByRole("heading", {
      level: 1,
      name: "Your Dashboard",
    })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.screenshot({
      path: resolve(evidenceDirectory, "tablet-responsive.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(page.getByRole("main").getByRole("heading", {
      level: 1,
      name: "My Tickets",
    })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoDocumentOverflow(page);
    await expect(page.getByLabel("Requester Tickets as cards")).toBeVisible();
    await page.screenshot({
      path: resolve(evidenceDirectory, "mobile-responsive.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 320, height: 800 });
    await expectNoDocumentOverflow(page);
    await expect(page.getByLabel("Requester Tickets as cards")).toBeVisible();
    await page.screenshot({
      path: resolve(evidenceDirectory, "mobile-320-reflow.png"),
      fullPage: true,
    });

    expect(failures).toEqual([]);
  });
});
