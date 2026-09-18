import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("Requester sees only their workspace and can add a public update without staff controls", async ({ page }) => {
  await signIn(page, "narin@example.com", "My Tickets");
  await expect(page.getByRole("button", { name: "Ticket Queue" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "User Management" })).toHaveCount(0);

  await page.getByRole("button", { name: "View TKT-L3-000001" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Internal Notes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Claim Ticket" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Public Comment" }).fill("Requester E2E public update.");
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByText("Public Comment posted successfully.")).toBeVisible();
  await expect(page.getByText("Requester E2E public update.", { exact: true }).last()).toBeVisible();

  expect((await page.request.get("http://127.0.0.1:3100/api/staff/tickets")).status()).toBe(403);
  expect((await page.request.get("http://127.0.0.1:3100/api/admin/users")).status()).toBe(403);
});
