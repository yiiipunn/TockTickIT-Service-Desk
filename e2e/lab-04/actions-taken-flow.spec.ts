import {
  apiSession, apiUrl, closeSession, expect, observeBrowserFailures,
  openStaffTicket, seedTicketForRequester, signIn, test,
} from "../../client/e2e/lab-04/issue31-helpers";

test("[E2E-01, E2E-02] Staff plans, validates, reassigns, edits and completes an Action; Requester reads only own work", async ({ page, browser }) => {
  const description = `Issue 31 printer inspection ${Date.now()}`;
  const updatedDescription = `${description} and verification`;
  await signIn(page, "ari.staff@example.com", "Staff Dashboard");
  const failures = observeBrowserFailures(page);
  await openStaffTicket(page, "Shared printer produces faded pages");
  await page.getByRole("button", { name: "Plan action" }).click();
  await expect(page.getByRole("heading", { name: "Plan an Action" })).toBeVisible();
  await page.getByLabel("Action Description").fill(description);
  await page.getByLabel("Assigned to").selectOption({ label: "Ari Staff (IT Staff)" });
  await page.getByLabel("Follow-Up Required?").check();
  await page.locator(".action-editor").getByRole("button", { name: "Plan action" }).click();
  await expect(page.getByText("Enter 1 to 1000 characters when follow-up is required.")).toBeVisible();
  await page.getByLabel("Follow-up Note").fill("Confirm the new toner result with the Requester.");
  await page.getByLabel("Attachment Notes").fill("See the Ticket attachment list for the test page.");
  await page.locator(".action-editor").getByRole("button", { name: "Plan action" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Action planned." })).toBeVisible();
  const detail = page.locator(".action-detail");
  await expect(detail).toContainText(description);
  await expect(detail).toContainText("Created by");
  await expect(detail).toContainText("Ari Staff");
  const actionId = Number((await detail.textContent())?.match(/Action #(\d+)/)?.[1]);
  expect(actionId).toBeGreaterThan(0);

  await detail.getByRole("button", { name: "Reassign action" }).click();
  const assignDialog = page.getByRole("dialog", { name: "Confirm reassignment" });
  await assignDialog.getByLabel("Assigned to").selectOption({ label: "Mali Staff (IT Staff)" });
  await assignDialog.getByRole("button", { name: "Confirm reassignment" }).click();
  await expect(detail).toContainText("Mali Staff");
  await detail.getByRole("button", { name: "Edit action" }).click();
  await page.getByLabel("Action Description").fill(updatedDescription);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(detail).toContainText(updatedDescription);

  const maliPage = await browser.newPage();
  try {
    await signIn(maliPage, "mali.staff@example.com", "Staff Dashboard");
    const maliFailures = observeBrowserFailures(maliPage);
    await openStaffTicket(maliPage, "Shared printer produces faded pages");
    const row = maliPage.getByRole("row").filter({ hasText: updatedDescription });
    await row.getByRole("button", { name: "View action" }).click();
    const maliDetail = maliPage.locator(".action-detail");
    await maliDetail.getByRole("button", { name: "Start action" }).click();
    await expect(maliDetail).toContainText("In Progress");
    await maliDetail.getByRole("button", { name: "Complete action" }).click();
    const completeDialog = maliPage.getByRole("dialog", { name: "Complete Action" });
    await completeDialog.getByLabel("Result").fill("Toner test page is legible and the printer is working.");
    await completeDialog.getByRole("button", { name: "Confirm completion" }).click();
    await expect(maliDetail).toContainText("Completed");
    await expect(maliDetail).toContainText("Performed by");
    await expect(maliDetail).toContainText("Mali Staff");
    await expect(maliDetail.getByRole("heading", { name: "Action history" })).toBeVisible();
    await expect(maliDetail.getByRole("heading", { name: "Action history" }).locator(".."))
      .toContainText("Status changed from In Progress to Completed.");
    await maliPage.screenshot({ path: "../artifacts/lab-04/screenshots/issue-31/actions-taken-flow.png", fullPage: true });
    expect(maliFailures).toEqual([]);
  } finally {
    await maliPage.close();
  }

  const ploy = await browser.newPage();
  const requester = await apiSession("ploy@example.com");
  const otherRequester = await apiSession("narin@example.com");
  try {
    await signIn(ploy, "ploy@example.com", "Your Dashboard");
    await ploy.getByRole("button", { name: "My Tickets", exact: true }).click();
    await ploy.getByRole("button", { name: "View TKT-L3-000002" }).click();
    await expect(ploy.getByText(updatedDescription).first()).toBeVisible();
    await expect(ploy.getByRole("button", { name: "Plan action" })).toHaveCount(0);
    await expect(ploy.getByRole("heading", { name: "Action history" })).toHaveCount(0);
    const ownList = await requester.context.get(`${apiUrl}/api/tickets/2/actions`);
    expect(ownList.status()).toBe(200);
    const deniedWrite = await requester.write("post", `/api/staff/tickets/2/actions`, {
      actionAt: new Date().toISOString(), description: "Forbidden", assigneeId: 1,
      result: null, followUpRequired: false, followUpNote: null, attachmentNotes: null,
    });
    expect(deniedWrite.status()).toBe(403);
    expect((await requester.context.get(`${apiUrl}/api/staff/actions/${actionId}/events`)).status()).toBe(403);
    expect((await otherRequester.context.get(`${apiUrl}/api/tickets/2/actions`)).status()).toBe(404);
  } finally {
    await ploy.close();
    await closeSession(requester);
    await closeSession(otherRequester);
  }
  expect(failures).toEqual([]);
});

test("[E2E-01, E2E-04] Administrator cancellation and stale Action and Ticket edits remain recoverable", async ({ browser }) => {
  test.setTimeout(120_000);
  const requester = await apiSession("narin@example.com");
  const staff = await apiSession("ari.staff@example.com");
  const summary = `Issue 31 concurrent work ${Date.now()}`;
  const ticket = await seedTicketForRequester(requester, summary);
  const planned = await staff.write("post", `/api/staff/tickets/${ticket.id}/actions`, {
    actionAt: new Date().toISOString(), description: "Review the reported symptoms",
    result: null, assigneeId: staff.user.id, followUpRequired: false,
    followUpNote: null, attachmentNotes: null,
  });
  expect(planned.status()).toBe(201);
  const action = (await planned.json()).data;
  const claimed = await staff.write("post", `/api/staff/tickets/${ticket.id}/claim`, { expectedVersion: 1 });
  expect(claimed.status()).toBe(200);
  const first = await browser.newPage();
  const second = await browser.newPage();
  const administrator = await browser.newPage();
  try {
    await signIn(first, "ari.staff@example.com", "Staff Dashboard");
    await signIn(second, "mali.staff@example.com", "Staff Dashboard");
    await signIn(administrator, "anong.admin@example.com", "Staff Dashboard");
    const failures = [
      observeBrowserFailures(first), observeBrowserFailures(second), observeBrowserFailures(administrator),
    ];
    for (const page of [first, second, administrator]) await openStaffTicket(page, summary);

    const actionRow = (page: typeof first) => page.getByRole("row").filter({ hasText: action.description });
    await actionRow(first).getByRole("button", { name: "View action" }).click();
    await actionRow(second).getByRole("button", { name: "View action" }).click();
    await first.locator(".action-detail").getByRole("button", { name: "Edit action" }).click();
    await second.locator(".action-detail").getByRole("button", { name: "Edit action" }).click();
    await first.getByLabel("Action Description").fill("Investigate the symptoms and document the cause");
    await second.getByLabel("Action Description").fill("Second staff draft must survive a conflict");
    await first.getByRole("button", { name: "Save changes" }).click();
    await expect(first.getByRole("status").filter({ hasText: "Action changes saved." })).toBeVisible();
    await second.getByRole("button", { name: "Save changes" }).click();
    await expect(second.getByText("This action changed after you opened it.")).toBeVisible();
    await expect(second.getByLabel("Action Description")).toHaveValue("Second staff draft must survive a conflict");
    await second.getByRole("button", { name: "Use latest values" }).click();
    await expect(second.getByLabel("Action Description")).toHaveValue("Investigate the symptoms and document the cause");

    await first.getByLabel("Next Status").selectOption("OPEN");
    await second.getByLabel("Next Status").selectOption("OPEN");
    await first.getByRole("button", { name: "Update Status" }).click();
    await expect(first.getByText("Ticket status updated successfully.")).toBeVisible();
    await second.getByRole("button", { name: "Update Status" }).click();
    await expect(second.getByText("This Ticket changed after you opened it.")).toBeVisible();
    await expect(second.getByText("Current Status:").locator("..")).toContainText("Open");

    await actionRow(administrator).getByRole("button", { name: "View action" }).click();
    await administrator.locator(".action-detail").getByRole("button", { name: "Edit action" }).click();
    await administrator.getByLabel("Action Description").fill("Administrator reviewed the Action before cancellation");
    await administrator.getByRole("button", { name: "Save changes" }).click();
    await expect(administrator.getByText("Action changes saved.")).toBeVisible();
    await administrator.locator(".action-detail").getByRole("button", { name: "Cancel action" }).click();
    const cancelDialog = administrator.getByRole("dialog", { name: "Cancel Action" });
    await cancelDialog.getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(cancelDialog.getByText("Enter 1 to 500 characters.")).toBeVisible();
    await cancelDialog.getByLabel("Cancellation reason").fill("The investigation was superseded by a newer plan.");
    await cancelDialog.getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(administrator.locator(".action-detail")).toContainText("Cancelled");
    await expect(administrator.locator(".action-detail")).toContainText("Anong Administrator");
    await expect(administrator.getByRole("heading", { name: "Action history" }).locator(".."))
      .toContainText("Status changed from Planned to Cancelled.");
    await administrator.screenshot({ path: "../artifacts/lab-04/screenshots/issue-31/action-cancellation.png", fullPage: true });
    const events = await staff.context.get(`/api/staff/actions/${action.id}/events`);
    expect(events.status()).toBe(200);
    const history = (await events.json()).items as { type: string }[];
    expect(history.map((item) => item.type)).toEqual(["CREATED", "UPDATED", "UPDATED", "STATUS_CHANGED"]);
    const latest = await staff.context.get(`/api/actions/${action.id}`);
    expect((await latest.json()).data.status).toBe("CANCELLED");
    expect(failures[0]).toEqual([]);
    expect(failures[1]).toHaveLength(2);
    expect(failures[1].every((message) => message.includes("409 (Conflict)"))).toBe(true);
    expect(failures[2]).toEqual([]);
  } finally {
    await Promise.all([first.close(), second.close(), administrator.close()]);
    await Promise.all([closeSession(requester), closeSession(staff)]);
  }
});
