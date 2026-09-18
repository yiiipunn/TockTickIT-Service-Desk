import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("IT Staff can search, claim, prioritize, transition, and communicate on a Ticket", async ({ page }) => {
  await signIn(page, "ari.staff@example.com", "Ticket Queue");
  await page.screenshot({ path: "../artifacts/lab-03/screenshots/staff-queue/desktop.png", fullPage: true });
  await page.getByLabel("Search").fill("Mailbox access stopped");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Open Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Mailbox access stopped after device replacement" })).toBeVisible();
  await page.getByRole("button", { name: "Claim Ticket" }).click();
  await expect(page.getByText("Ticket claimed successfully.")).toBeVisible();

  await page.getByLabel("IT Priority").selectOption("MEDIUM");
  await page.getByRole("button", { name: "Save IT Priority" }).click();
  await expect(page.getByText("IT Priority updated successfully.")).toBeVisible();
  await expect(page.getByText("Requested Priority:").locator("..")).toContainText("HIGH");

  await page.getByLabel("Next Status").selectOption("OPEN");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByText("Ticket status updated successfully.")).toBeVisible();
  await page.getByRole("textbox", { name: "Public Comment" }).fill("IT Staff E2E public update.");
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByText("IT Staff E2E public update.", { exact: true }).last()).toBeVisible();
  await page.getByRole("textbox", { name: "Internal Note" }).fill("IT Staff E2E private note.");
  await page.getByRole("button", { name: "Add Internal Note" }).click();
  await expect(page.getByText("IT Staff E2E private note.", { exact: true }).last()).toBeVisible();
  await page.screenshot({ path: "../artifacts/lab-03/screenshots/staff-ticket-detail/desktop.png", fullPage: true });

  expect((await page.request.get("http://127.0.0.1:3100/api/admin/users")).status()).toBe(403);
});
