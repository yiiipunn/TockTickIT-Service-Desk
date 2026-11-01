import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

export { expect, test };
export const apiUrl = "http://127.0.0.1:3100";
const origin = "http://127.0.0.1:5174";
const initialPassword = "TokTickIT-Lab3!";

function changedPassword(email: string) {
  return `E2E-${email.replace(/[^a-z]/gi, "")}!2026`;
}

export async function apiSession(email: string) {
  const context = await request.newContext({ baseURL: apiUrl });
  let currentPassword = initialPassword;
  let response = await context.post("/api/auth/login", { data: { email, password: currentPassword } });
  if (response.status() === 401) {
    currentPassword = changedPassword(email);
    response = await context.post("/api/auth/login", { data: { email, password: currentPassword } });
  }
  expect(response.status()).toBe(200);
  let data = (await response.json()).data;
  if (data.user.mustChangePassword) {
    response = await context.post("/api/auth/change-password", {
      headers: { Origin: origin, "X-CSRF-Token": data.csrfToken },
      data: {
        currentPassword,
        newPassword: changedPassword(email),
        confirmPassword: changedPassword(email),
      },
    });
    expect(response.status()).toBe(200);
    data = (await response.json()).data;
  }
  return {
    context,
    user: data.user as { id: number; name: string; role: string },
    write: (method: "post" | "patch", path: string, body: unknown) =>
      context[method](path, {
        headers: { Origin: origin, "X-CSRF-Token": data.csrfToken },
        data: body,
      }),
  };
}

export async function signIn(page: Page, email: string, heading: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(initialPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  const passwordChange = page.getByRole("heading", { name: "Password change required" });
  const landing = page.getByRole("heading", { name: /^(Your Dashboard|Staff Dashboard)$/ });
  await expect(passwordChange.or(landing).or(page.getByRole("alert"))).toBeVisible();
  if (await page.getByRole("alert").isVisible()) {
    await page.getByRole("textbox", { name: "Password" }).fill(changedPassword(email));
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(passwordChange.or(landing)).toBeVisible();
  }
  if (await passwordChange.isVisible()) {
    await page.getByLabel("Current password").fill(initialPassword);
    await page.getByRole("textbox", { name: "New password", exact: true }).fill(changedPassword(email));
    await page.getByLabel("Confirm new password").fill(changedPassword(email));
    await page.getByRole("button", { name: "Change Password" }).click();
  }
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

export async function openStaffTicket(page: Page, search: string) {
  await page.getByRole("button", { name: "Ticket Queue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await page.getByLabel("Search").fill(search);
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Open Ticket" }).first().click();
  await expect(page.getByRole("heading", { name: search, exact: false })).toBeVisible();
}

export async function seedTicketForRequester(
  session: Awaited<ReturnType<typeof apiSession>>,
  summary: string,
) {
  const categories = await session.context.get("/api/categories");
  const systems = await session.context.get("/api/related-systems");
  expect(categories.status()).toBe(200);
  expect(systems.status()).toBe(200);
  const category = (await categories.json())[0];
  const system = (await systems.json())[0];
  const response = await session.write("post", "/api/tickets", {
    categoryId: category.id,
    relatedSystemId: system.id,
    summary,
    description: "Issue #31 isolated end-to-end workflow fixture.",
    requestedPriority: "HIGH",
  });
  expect(response.status()).toBe(201);
  return await response.json() as { id: number; ticketNumber: string; status: string };
}

export function observeBrowserFailures(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    failures.push(`request: ${request.method()} ${request.url()} (${request.failure()?.errorText})`);
  });
  return failures;
}

export async function expectNoOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
}

export async function closeSession(session: { context: APIRequestContext }) {
  await session.context.dispose();
}
