import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("User Management remains usable at desktop, tablet, and mobile widths", async ({ page }) => {
  await signIn(page, "anong.admin@example.com", "User Management");
  for (const viewport of [
    { width: 1440, height: 1000, name: "desktop" },
    { width: 820, height: 1180, name: "tablet" },
    { width: 390, height: 844, name: "mobile" },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create User" })).toBeVisible();
    await page.screenshot({ path: `../artifacts/lab-03/screenshots/user-management/${viewport.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "Create User" }).click();
    await expect(page.getByRole("heading", { name: "Create User" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Cancel" }).click();
  }
});
