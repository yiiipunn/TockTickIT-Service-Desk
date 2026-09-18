import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { signIn } from "./helpers";

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function captureAtEveryViewport(page: Page, screen: string, state: string) {
  const directory = resolve(process.cwd(), "../artifacts/lab-03/screenshots", screen, state);
  await mkdir(directory, { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.screenshot({ path: resolve(directory, `${viewport.name}.png`), fullPage: true });
  }
}

test("captures PNG evidence for implemented Lab 3 screens and visible states", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  await captureAtEveryViewport(page, "authentication", "login-initial");

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await captureAtEveryViewport(page, "authentication", "login-validation");

  await signIn(page, "anong.admin@example.com", "User Management");
  await captureAtEveryViewport(page, "user-management", "list");

  await page.getByRole("button", { name: "Create User" }).click();
  await expect(page.getByRole("heading", { name: "Create User" })).toBeVisible();
  await captureAtEveryViewport(page, "user-management", "create");
  await page.getByRole("button", { name: "Create User" }).click();
  await captureAtEveryViewport(page, "user-management", "create-validation");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByLabel("Search").fill("Mew A.");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: "Edit Mew A." }).click();
  await expect(page.getByRole("heading", { name: "Edit User" })).toBeVisible();
  await captureAtEveryViewport(page, "user-management", "edit");

  await page.getByRole("button", { name: "Set New Initial Password" }).click();
  await expect(page.getByRole("heading", { name: "Set New Initial Password" })).toBeVisible();
  await captureAtEveryViewport(page, "user-management", "set-initial-password");

  await page.getByRole("button", { name: "Set Initial Password" }).click();
  await captureAtEveryViewport(page, "user-management", "set-initial-password-validation");
  await page.getByLabel("New Initial Password").fill("TokTickIT-Lab3!");
  await page.getByRole("button", { name: "Set Initial Password" }).click();
  await expect(page.getByText("New initial password set. Existing sessions ended and the user must change it at next sign-in.")).toBeVisible();
  await captureAtEveryViewport(page, "user-management", "set-initial-password-success");
  await page.getByRole("button", { name: "Logout" }).click();

  await page.getByLabel("Email").fill("mew@example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("TokTickIT-Lab3!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Password change required" })).toBeVisible();
  await captureAtEveryViewport(page, "authentication", "password-change-required");

  await page.getByRole("button", { name: "Change Password" }).click();
  await expect(page.getByText("Enter your current password.")).toBeVisible();
  await captureAtEveryViewport(page, "authentication", "password-change-validation");

  const requesterPassword = "EvidenceMewPassword!2026";
  await page.getByLabel("Current password").fill("TokTickIT-Lab3!");
  await page.getByRole("textbox", { name: "New password", exact: true }).fill(requesterPassword);
  await page.getByLabel("Confirm new password").fill(requesterPassword);
  await page.getByRole("button", { name: "Change Password" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await captureAtEveryViewport(page, "requester", "my-tickets");

  await page.getByRole("button", { name: "Create Ticket", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await captureAtEveryViewport(page, "requester", "create-ticket");
  await page.getByRole("button", { name: "My Tickets", exact: true }).click();

  await page.getByRole("button", { name: "View TKT-L3-000004" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await captureAtEveryViewport(page, "requester", "ticket-detail");
  await page.getByRole("textbox", { name: "Public Comment" }).fill("Requester screenshot evidence update.");
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByText("Public Comment posted successfully.")).toBeVisible();
  await captureAtEveryViewport(page, "requester", "ticket-detail-comment-success");
  await page.getByRole("button", { name: "Logout" }).click();

  await signIn(page, "kiet.staff@example.com", "Ticket Queue");
  await captureAtEveryViewport(page, "staff-ticket-queue", "ready");

  await page.getByRole("button", { name: "Open Ticket" }).first().click();
  await expect(page.getByRole("button", { name: "Back to Ticket Queue" })).toBeVisible();
  await captureAtEveryViewport(page, "staff-ticket-detail", "ready");
});
