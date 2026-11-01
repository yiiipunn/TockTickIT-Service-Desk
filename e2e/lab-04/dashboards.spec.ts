import {
  apiSession, closeSession, expect, expectNoOverflow, observeBrowserFailures,
  seedTicketForRequester, signIn, test,
} from "../../client/e2e/lab-04/issue31-helpers";

test("[E2E-05] Staff and Requester dashboards show authoritative role-scoped data and drill into Tickets", async ({ page, browser }) => {
  const requester = await apiSession("narin@example.com");
  const staff = await apiSession("ari.staff@example.com");
  const otherRequester = await apiSession("ploy@example.com");
  const summary = `Issue 31 dashboard attention ${Date.now()}`;
  const ticket = await seedTicketForRequester(requester, summary);
  const claimed = await staff.write("post", `/api/staff/tickets/${ticket.id}/claim`, { expectedVersion: 1 });
  expect(claimed.status()).toBe(200);
  const claimedTicket = (await claimed.json()).data;
  const opened = await staff.write("patch", `/api/staff/tickets/${ticket.id}/status`, {
    expectedVersion: claimedTicket.version, currentStatus: "NEW", status: "OPEN",
  });
  expect(opened.status()).toBe(200);
  const openTicket = (await opened.json()).data;
  const waiting = await staff.write("patch", `/api/staff/tickets/${ticket.id}/status`, {
    expectedVersion: openTicket.version, currentStatus: "OPEN", status: "WAITING_FOR_REQUESTER",
  });
  expect(waiting.status()).toBe(200);

  try {
    const staffSnapshot = (await (await staff.context.get("/api/dashboards/staff")).json()).data;
    await signIn(page, "ari.staff@example.com", "Staff Dashboard");
    const failures = observeBrowserFailures(page);
    const metrics = page.getByLabel("Operational metrics");
    await expect(metrics.getByRole("button", { name: /Unassigned Open/ }).locator("strong"))
      .toHaveText(String(staffSnapshot.metrics.unassignedOpenCount));
    await expect(metrics.getByRole("button", { name: /My Open Tickets/ }).locator("strong"))
      .toHaveText(String(staffSnapshot.metrics.myOpenTicketCount));
    await expect(metrics.getByRole("button", { name: /My Active Actions/ }).locator("strong"))
      .toHaveText(String(staffSnapshot.metrics.myActiveActionsCount));
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const) {
      const label = status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      await expect(page.locator("[aria-labelledby='tickets-by-status-heading']")
        .getByRole("button", { name: new RegExp(`^${label}\\b`) }).locator("strong"))
        .toHaveText(String(staffSnapshot.metrics.countsByStatus[status]));
    }
    for (const priority of ["LOW", "MEDIUM", "HIGH"] as const) {
      const label = priority.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
      await expect(page.locator("[aria-labelledby='tickets-by-priority-heading']")
        .getByRole("button", { name: new RegExp(`^${label}\\b`) }).locator("strong"))
        .toHaveText(String(staffSnapshot.metrics.countsByItPriority[priority]));
    }
    await expect(page.getByRole("heading", { name: "Urgent Tickets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recently Updated" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Active Actions" }).first()).toBeVisible();
    await expect(page.getByText(summary).first()).toBeVisible();
    await page.screenshot({ path: "../artifacts/lab-04/screenshots/issue-31/staff-dashboard.png", fullPage: true });
    await metrics.getByRole("button", { name: /My Open Tickets/ }).click();
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await expect(page.getByText(summary).first()).toBeVisible();

    const requesterPage = await browser.newPage();
    try {
      const ownSnapshot = (await (await requester.context.get("/api/dashboards/requester")).json()).data;
      const otherSnapshot = (await (await otherRequester.context.get("/api/dashboards/requester")).json()).data;
      await signIn(requesterPage, "narin@example.com", "Your Dashboard");
      const requesterFailures = observeBrowserFailures(requesterPage);
      const ownMetrics = requesterPage.getByLabel("Your Ticket metrics");
      await expect(ownMetrics.getByRole("button", { name: /Open Tickets/ }).locator("strong"))
        .toHaveText(String(ownSnapshot.metrics.openCount));
      await expect(ownMetrics.getByRole("button", { name: /Waiting for You/ }).locator("strong"))
        .toHaveText(String(ownSnapshot.metrics.waitingForRequesterCount));
      await expect(requesterPage.getByRole("heading", { name: "Attention Required" })).toBeVisible();
      await expect(requesterPage.getByRole("heading", { name: "Recently Updated" })).toBeVisible();
      await expect(requesterPage.getByRole("heading", { name: "Recently Resolved" })).toBeVisible();
      await expect(requesterPage.getByText(summary).first()).toBeVisible();
      expect(ownSnapshot.attentionRequired.map((item: { id: number }) => item.id)).toContain(ticket.id);
      expect(otherSnapshot.attentionRequired.map((item: { id: number }) => item.id)).not.toContain(ticket.id);
      await expect(requesterPage.getByText("Shared printer produces faded pages")).toHaveCount(0);
      await requesterPage.screenshot({ path: "../artifacts/lab-04/screenshots/issue-31/requester-dashboard.png", fullPage: true });
      await ownMetrics.getByRole("button", { name: /Waiting for You/ }).click();
      await expect(requesterPage.getByRole("heading", { name: "My Tickets" })).toBeVisible();
      await expect(requesterPage.getByText(summary).first()).toBeVisible();
      await requesterPage.getByRole("button", { name: `View ${ticket.ticketNumber}` }).click();
      await expect(requesterPage.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
      await expect(requesterPage.getByText(summary)).toBeVisible();

      await requesterPage.getByRole("button", { name: "Dashboard", exact: true }).click();
      await requesterPage.setViewportSize({ width: 390, height: 844 });
      await expectNoOverflow(requesterPage);
      await requesterPage.screenshot({ path: "../artifacts/lab-04/screenshots/issue-31/responsive-mobile.png", fullPage: true });
      expect(requesterFailures).toEqual([]);
    } finally {
      await requesterPage.close();
    }
    expect(failures).toEqual([]);
  } finally {
    await closeSession(requester);
    await closeSession(staff);
    await closeSession(otherRequester);
  }
});
