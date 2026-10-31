import {
  apiSession, closeSession, expect, observeBrowserFailures, openStaffTicket,
  seedTicketForRequester, signIn, test,
} from "../../client/e2e/lab-04/issue31-helpers";

test("[E2E-03] Ticket resolution gate, advisory feedback, close, reopen and ordered history", async ({ page, browser }) => {
  const requester = await apiSession("narin@example.com");
  const summary = `Issue 31 resolution path ${Date.now()}`;
  const ticket = await seedTicketForRequester(requester, summary);
  const staff = await apiSession("ari.staff@example.com");
  try {
    await signIn(page, "ari.staff@example.com", "Staff Dashboard");
    const failures = observeBrowserFailures(page);
    await openStaffTicket(page, summary);
    await page.getByRole("button", { name: "Claim Ticket" }).click();
    await expect(page.getByText("Ticket claimed successfully.")).toBeVisible();
    await page.getByLabel("Next Status").selectOption("OPEN");
    await page.getByRole("button", { name: "Update Status" }).click();
    await expect(page.getByText("Ticket status updated successfully.")).toBeVisible();

    const beforeGate = (await (await staff.context.get(`/api/staff/tickets/${ticket.id}`)).json()).data;
    const invalidTransition = await staff.write("patch", `/api/staff/tickets/${ticket.id}/status`, {
      expectedVersion: beforeGate.version, currentStatus: "OPEN", status: "CLOSED",
    });
    expect(invalidTransition.status()).toBe(409);
    const blockedResolution = await staff.write("patch", `/api/staff/tickets/${ticket.id}/status`, {
      expectedVersion: beforeGate.version, currentStatus: "OPEN", status: "RESOLVED",
    });
    expect(blockedResolution.status()).toBe(409);
    expect((await blockedResolution.json()).error.code).toBe("RESOLUTION_GATE_FAILED");
    await expect(page.getByLabel("Next Status").locator("option[value='RESOLVED']")).toHaveCount(0);

    const requesterPage = await browser.newPage();
    try {
      await signIn(requesterPage, "narin@example.com", "Your Dashboard");
      await requesterPage.getByRole("button", { name: "My Tickets", exact: true }).click();
      await requesterPage.getByRole("button", { name: `View ${ticket.ticketNumber}` }).click();
      await requesterPage.getByRole("button", { name: "Problem Appears Resolved" }).click();
      await expect(requesterPage.getByRole("button", { name: "IT has been notified" })).toBeDisabled();
      const afterAdvisory = await (await requester.context.get(`/api/tickets/${ticket.id}`)).json();
      expect(afterAdvisory.status).toBe("OPEN");
      expect(afterAdvisory.requesterResolutionIndicatedAt).not.toBeNull();
    } finally {
      await requesterPage.close();
    }

    await page.getByRole("button", { name: "Plan action" }).first().click();
    await page.getByLabel("Action Description").fill("Verify the Requester's reported fix.");
    await page.getByLabel("Assigned to").selectOption({ label: "Ari Staff (IT Staff)" });
    await page.locator(".action-editor").getByRole("button", { name: "Plan action" }).click();
    await expect(page.locator(".action-detail")).toContainText("Verify the Requester's reported fix.");
    await page.locator(".action-detail").getByRole("button", { name: "Start action" }).click();
    await page.locator(".action-detail").getByRole("button", { name: "Complete action" }).click();
    const dialog = page.getByRole("dialog", { name: "Complete Action" });
    await dialog.getByLabel("Result").fill("The issue no longer reproduces after the repair.");
    await dialog.getByRole("button", { name: "Confirm completion" }).click();
    await expect(page.locator(".action-detail")).toContainText("Completed");
    await expect(page.getByText("This Ticket is ready for formal resolution.")).toBeVisible();

    await page.getByLabel("Next Status").selectOption("RESOLVED");
    await page.getByRole("button", { name: "Resolve ticket" }).click();
    await expect(page.getByText("Ticket status updated successfully.")).toBeVisible();
    await page.getByLabel("Next Status").selectOption("CLOSED");
    await page.getByRole("button", { name: "Close ticket" }).click();
    await page.getByRole("dialog", { name: "Close ticket confirmation" })
      .getByRole("button", { name: "Confirm Closed" }).click();
    await expect(page.getByText("Ticket status updated successfully.")).toBeVisible();
    await page.getByLabel("Next Status").selectOption("REOPENED");
    await page.getByRole("button", { name: "Reopen ticket" }).click();
    await expect(page.getByText("Ticket status updated successfully.")).toBeVisible();
    const finalTicket = (await (await staff.context.get(`/api/staff/tickets/${ticket.id}`)).json()).data;
    expect(finalTicket.status).toBe("REOPENED");
    expect(finalTicket.requesterResolutionIndicatedAt).toBeNull();
    expect(finalTicket.workflowEvents.map((event: { toStatus: string }) => event.toStatus))
      .toEqual(expect.arrayContaining(["OPEN", "RESOLVED", "CLOSED", "REOPENED"]));
    await page.screenshot({ path: "../artifacts/lab-04/screenshots/issue-31/ticket-resolution.png", fullPage: true });
    expect(failures).toEqual([]);
  } finally {
    await closeSession(staff);
    await closeSession(requester);
  }
});
