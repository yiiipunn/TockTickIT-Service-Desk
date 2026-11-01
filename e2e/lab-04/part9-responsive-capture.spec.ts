import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  expect, observeBrowserFailures, openStaffTicket, signIn, test,
} from "../../client/e2e/lab-04/issue31-helpers";

const evidenceRoot = resolve(process.cwd(), "../artifacts/lab-04/screenshots");
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 800, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`Part 9 responsive capture: ${viewport.name}`, async ({ browser }) => {
    const staffDirectory = resolve(evidenceRoot, "staff-dashboard");
    const requesterDirectory = resolve(evidenceRoot, "requester-dashboard");
    const actionsDirectory = resolve(evidenceRoot, "actions-taken");
    for (const directory of [staffDirectory, requesterDirectory, actionsDirectory]) {
      mkdirSync(directory, { recursive: true });
    }

    const staff = await browser.newPage({ viewport });
    try {
      await signIn(staff, "ari.staff@example.com", "Staff Dashboard");
      const failures = observeBrowserFailures(staff);
      await expect(staff.getByLabel("Operational metrics")).toBeVisible();
      await staff.screenshot({ path: resolve(staffDirectory, `${viewport.name}.png`), fullPage: true });

      await openStaffTicket(staff, "Shared printer produces faded pages");
      await expect(staff.getByRole("heading", { name: /Actions Taken/ })).toBeVisible();
      await staff.screenshot({ path: resolve(actionsDirectory, `ticket-detail-${viewport.name}.png`), fullPage: true });

      await staff.getByRole("button", { name: "Plan action" }).click();
      await expect(staff.getByRole("heading", { name: "Plan an Action" })).toBeVisible();
      await staff.screenshot({ path: resolve(actionsDirectory, `form-${viewport.name}.png`), fullPage: true });

      const staffWidths = await staff.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      if (staffWidths.scroll > staffWidths.client) {
        const offenders = await staff.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("*"))
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .slice(0, 12)
          .map((element) => ({ tag: element.tagName, className: element.className,
            right: Math.round(element.getBoundingClientRect().right) })));
        console.log(`Horizontal overflow at ${viewport.name}: ${JSON.stringify(offenders)}`);
      }
      expect(staffWidths.scroll).toBeLessThanOrEqual(staffWidths.client);
      expect(failures).toEqual([]);
    } finally {
      await staff.close();
    }

    const requester = await browser.newPage({ viewport });
    try {
      await signIn(requester, "narin@example.com", "Your Dashboard");
      const failures = observeBrowserFailures(requester);
      await expect(requester.getByLabel("Your Ticket metrics")).toBeVisible();
      await requester.screenshot({ path: resolve(requesterDirectory, `${viewport.name}.png`), fullPage: true });

      await requester.getByRole("button", { name: "My Tickets", exact: true }).click();
      await expect(requester.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
      await requester.screenshot({ path: resolve(requesterDirectory, `my-tickets-${viewport.name}.png`), fullPage: true });

      const requesterWidths = await requester.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(requesterWidths.scroll).toBeLessThanOrEqual(requesterWidths.client);
      expect(failures).toEqual([]);
    } finally {
      await requester.close();
    }
  });
}
