import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("Administrator manages users through the protected User Management workspace", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `release-e2e-${suffix}@example.com`;
  await signIn(page, "anong.admin@example.com", "User Management");
  await page.getByLabel("Search").fill("Narin S.");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("button", { name: "Edit Narin S." }).first()).toBeVisible();
  await page.screenshot({ path: "../artifacts/lab-03/screenshots/user-management/desktop.png", fullPage: true });

  await page.getByRole("button", { name: "Create User" }).click();
  await page.getByLabel("Name *").fill("Release E2E User");
  await page.getByLabel("Email *").fill(email);
  await page.getByLabel("Role *").selectOption("IT_STAFF");
  await page.getByRole("textbox", { name: "Initial Password *", exact: true }).fill("ReleaseE2EPassword!");
  await page.getByLabel("Confirm Initial Password *").fill("ReleaseE2EPassword!");
  await page.getByRole("button", { name: "Create User" }).click();
  await expect(page.getByText("User created. They must change their initial password when they sign in.")).toBeVisible();
  await page.getByLabel("Search").fill(email);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("button", { name: "Edit Release E2E User" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Edit Release E2E User" }).click();
  await page.getByLabel("Account Status *").selectOption("false");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("User changes saved.")).toBeVisible();
});
