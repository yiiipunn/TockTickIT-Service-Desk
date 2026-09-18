import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("authentication requires an initial password change and logout revokes browser access", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "../artifacts/lab-03/screenshots/authentication/login.png", fullPage: true });
  await signIn(page, "narin@example.com", "My Tickets");
  await expect(page.getByText("Narin S.")).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  expect((await page.request.get("http://127.0.0.1:3100/api/tickets")).status()).toBe(401);
});
