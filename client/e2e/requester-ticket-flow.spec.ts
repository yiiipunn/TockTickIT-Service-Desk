import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const screenshotsDirectory = resolve(
  currentDirectory,
  "../../artifacts/lab-02/runtime-screenshots",
);
const apiBaseUrl = "http://127.0.0.1:3100";
const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const summary = `E2E network issue ${uniqueSuffix}`;

async function selectRequester(page: Page, requesterName: string) {
  const requesterSelect = page.getByLabel("Development Requester");
  await expect(requesterSelect).toBeVisible();
  const requesterValue = await requesterSelect.locator("option")
    .filter({ hasText: requesterName })
    .getAttribute("value");
  expect(requesterValue).toBeTruthy();
  await requesterSelect.selectOption(requesterValue!);
  const requesterId = await requesterSelect.inputValue();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  return requesterId;
}

async function openCreateTicket(page: Page) {
  await page.getByRole("button", {
    name: "Create Ticket",
    exact: true,
  }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
}

async function createTicket(page: Page) {
  await openCreateTicket(page);
  await page.getByLabel("Category").selectOption({ label: "Network" });
  await page.getByLabel("Related System").selectOption({
    label: "Campus Wi-Fi",
  });
  await page.getByLabel("Summary").fill(summary);
  await page.getByLabel("Description").fill(
    "This ticket is created by the Lab 2 browser integration test.",
  );

  const ticketResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/tickets") &&
    response.request().method() === "POST",
  );
  await page.locator("#ticket-summary").locator("xpath=ancestor::form")
    .getByRole("button", { name: "Create Ticket" }).click();

  const response = await ticketResponse;
  expect(response.status()).toBe(201);
  const ticket = await response.json() as { id: number };
  await expect(page.getByText("Ticket created successfully")).toBeVisible();
  return ticket.id;
}

test.describe.configure({ mode: "serial" });

test("runs the complete requester workflow and attachment lifecycle", async ({ page }) => {
  await mkdir(screenshotsDirectory, { recursive: true });
  await page.goto("/");
  const narinRequesterId = await selectRequester(page, "Narin S.");
  const ticketId = await createTicket(page);

  await page.getByRole("button", {
    name: "Back to My Tickets",
    exact: true,
  }).click();
  await expect(page.getByRole("cell", {
    name: summary,
    exact: true,
  })).toBeVisible();
  await page.screenshot({
    path: resolve(screenshotsDirectory, "my-tickets/desktop.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: /View TKT-/ }).first().click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();

  const uploadResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/tickets/${ticketId}/attachments`) &&
    response.request().method() === "POST",
  );
  await page.getByLabel("Add attachment").setInputFiles({
    name: "e2e-evidence.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nTokTickIT E2E evidence"),
  });
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  const uploaded = await uploadResponse;
  expect(uploaded.status()).toBe(201);
  const attachment = await uploaded.json() as { data: { id: number } };
  const attachmentId = attachment.data.id;
  await expect(page.getByText("Attachment uploaded successfully.")).toBeVisible();
  await expect(page.getByText("e2e-evidence.pdf")).toBeVisible();
  await page.screenshot({
    path: resolve(screenshotsDirectory, "ticket-detail/active-attachment.png"),
    fullPage: true,
  });

  const downloadResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/attachments/${attachmentId}/download`) &&
    response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await downloadResponse).status()).toBe(200);

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByLabel("Reason for removal").fill("E2E lifecycle verification");
  const removalResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/attachments/${attachmentId}`) &&
    response.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: "Confirm removal" }).click();
  expect((await removalResponse).status()).toBe(200);
  await expect(page.getByText("Attachment removed successfully.")).toBeVisible();
  await expect(page.getByText("Removed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveCount(0);
  await page.screenshot({
    path: resolve(screenshotsDirectory, "ticket-detail/removed-attachment.png"),
    fullPage: true,
  });

  const removedDownload = await page.request.get(
    `${apiBaseUrl}/api/attachments/${attachmentId}/download`,
    { headers: { "X-Requester-Id": narinRequesterId } },
  );
  expect(removedDownload.status()).toBe(404);

  await page.getByRole("button", { name: /Change/ }).click();
  const ployRequesterId = await selectRequester(page, "Ploy K.");
  await page.getByLabel("Search").fill(summary);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByText("No tickets match the current search or filters."),
  ).toBeVisible();

  const inaccessibleTicket = await page.request.get(`${apiBaseUrl}/api/tickets/${ticketId}`, {
    headers: { "X-Requester-Id": ployRequesterId },
  });
  expect(inaccessibleTicket.status()).toBe(404);
  const inaccessibleAttachment = await page.request.get(`${apiBaseUrl}/api/attachments/${attachmentId}`, {
    headers: { "X-Requester-Id": ployRequesterId },
  });
  expect(inaccessibleAttachment.status()).toBe(404);
});

test("verifies responsive Create Ticket layouts and captures evidence", async ({ page }) => {
  await mkdir(screenshotsDirectory, { recursive: true });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "tablet", width: 900, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await selectRequester(page, "Narin S.");
    await openCreateTicket(page);

    expect(await page.locator("body").evaluate((element) =>
      getComputedStyle(element).backgroundColor,
    )).toBe("rgb(245, 247, 246)");
    expect(await page.locator("nav.bg-success").evaluate((element) =>
      getComputedStyle(element).backgroundColor,
    )).toBe("rgb(0, 107, 60)");
    await expect(page.getByLabel("Summary")).toBeVisible();
    await expect(
      page.locator('button[type="submit"]', { hasText: "Create Ticket" }),
    ).toBeVisible();
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth,
    )).toBe(true);
    expect(await page.evaluate(() => {
      return Array.from(document.styleSheets).some((styleSheet) => {
        try {
          return Array.from(styleSheet.cssRules).some((rule) =>
            rule instanceof CSSStyleRule &&
            rule.selectorText === ":focus-visible" &&
            rule.style.outlineWidth === "3px"
          );
        } catch {
          return false;
        }
      });
    })).toBe(true);

    if (viewport.name === "mobile") {
      const [createTicketBox, requesterBox] = await Promise.all([
        page
          .getByLabel("Requester application navigation")
          .getByRole("button", { name: "Create Ticket", exact: true })
          .boundingBox(),
        page.locator(".requester-identity").boundingBox(),
      ]);
      expect(createTicketBox).not.toBeNull();
      expect(requesterBox).not.toBeNull();
      expect(createTicketBox!.y).toBeGreaterThanOrEqual(
        requesterBox!.y + requesterBox!.height,
      );
    }

    await page.screenshot({
      path: resolve(screenshotsDirectory, `create-ticket/${viewport.name}.png`),
      fullPage: true,
    });
  }
});
