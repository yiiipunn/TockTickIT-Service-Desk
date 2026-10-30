import { expect, type Page } from "@playwright/test";

export const initialPassword = "TokTickIT-Lab3!";

function changedPassword(email: string) {
  return `E2E-${email.replace(/[^a-z]/gi, "")}!2026`;
}

export async function signIn(page: Page, email: string, expectedHeading: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(initialPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  const passwordChangeRequired = page.getByRole("heading", { name: "Password change required" });
  const signInFailure = page.getByRole("alert");
  const authenticatedLanding = page.getByRole("heading", {
    name: /^(Your Dashboard|Staff Dashboard|My Tickets|Ticket Queue|User Management)$/,
  });
  await expect(passwordChangeRequired.or(signInFailure)).toBeVisible();

  if (await signInFailure.isVisible()) {
    await page.getByRole("textbox", { name: "Password" }).fill(changedPassword(email));
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(passwordChangeRequired.or(authenticatedLanding)).toBeVisible();
  }

  if (await passwordChangeRequired.isVisible()) {
    const nextPassword = changedPassword(email);
    await page.getByLabel("Current password").fill(initialPassword);
    await page.getByRole("textbox", { name: "New password", exact: true }).fill(nextPassword);
    await page.getByLabel("Confirm new password").fill(nextPassword);
    await page.getByRole("button", { name: "Change Password" }).click();
  }

  await expect(authenticatedLanding).toBeVisible();
  if (!await page.getByRole("heading", { name: expectedHeading }).isVisible()) {
    await page.getByRole("button", { name: expectedHeading, exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: expectedHeading })).toBeVisible();
}
