import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionsTaken from "../../src/ActionsTaken";
import type { ActionEvent, ActionTaken, AuthenticatedUser } from "../../src/api";

const staff: AuthenticatedUser = {
  id: 7,
  name: "Ari Staff",
  email: "ari@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};
const admin: AuthenticatedUser = { ...staff, id: 1, name: "Admin User", role: "ADMINISTRATOR" };
const requester: AuthenticatedUser = { ...staff, id: 3, name: "Narin Requester", role: "REQUESTER" };
const owners = [
  { id: 7, name: "Ari Staff", email: "ari@example.com", role: "IT_STAFF" as const },
  { id: 9, name: "Mali Staff", email: "mali@example.com", role: "IT_STAFF" as const },
  { id: 1, name: "Admin User", email: "admin@example.com", role: "ADMINISTRATOR" as const },
];

const planned: ActionTaken = {
  id: 41,
  ticketId: 25,
  actionAt: "2026-10-24T03:30:00.000Z",
  description: "Replace the expired wireless profile.",
  result: null,
  status: "PLANNED",
  assignee: { id: 7, name: "Ari Staff", role: "IT_STAFF", isActive: true },
  createdBy: { id: 9, name: "Mali Staff", role: "IT_STAFF" },
  performedBy: null,
  followUpRequired: true,
  followUpNote: "Confirm stability tomorrow.",
  attachmentNotes: "See wifi-diagnostics.pdf.",
  completedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  version: 2,
  createdAt: "2026-10-23T08:30:00.000Z",
  updatedAt: "2026-10-23T09:00:00.000Z",
};
const inProgress: ActionTaken = {
  ...planned,
  id: 42,
  actionAt: "2026-10-23T03:30:00.000Z",
  description: "Verify both wireless networks.",
  followUpRequired: false,
  followUpNote: null,
  status: "IN_PROGRESS",
  version: 4,
};
const completed: ActionTaken = {
  ...planned,
  id: 40,
  actionAt: "2026-10-22T03:30:00.000Z",
  description: "Capture initial diagnostics.",
  result: "Diagnostics captured successfully.",
  status: "COMPLETED",
  performedBy: { id: 7, name: "Ari Staff", role: "IT_STAFF" },
  completedAt: "2026-10-22T04:00:00.000Z",
  followUpRequired: false,
  followUpNote: null,
  version: 3,
};
const event: ActionEvent = {
  id: 90,
  type: "CREATED",
  actor: { id: 9, name: "Mali Staff", role: "IT_STAFF" },
  fromStatus: null,
  toStatus: "PLANNED",
  fromAssignee: null,
  toAssignee: { id: 7, name: "Ari Staff" },
  createdAt: "2026-10-23T08:30:00.000Z",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type FetchOptions = {
  items?: ActionTaken[];
  pagination?: { page: number; pageSize: number; totalItems: number; totalPages: number };
  getActions?: (call: number) => Response | Promise<Response>;
  detail?: ActionTaken | ((call: number) => ActionTaken);
  events?: ActionEvent[];
  create?: Response | Promise<Response>;
  update?: Response | Promise<Response>;
  assign?: Response | Promise<Response>;
  transition?: Response | Promise<Response>;
  owners?: Response | Promise<Response>;
};

function installFetch(options: FetchOptions = {}) {
  let listCalls = 0;
  let detailCalls = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (url.pathname === "/api/staff/eligible-owners") {
      return Promise.resolve(options.owners ?? response({ items: owners }));
    }
    if (url.pathname === "/api/tickets/25/actions" && method === "GET") {
      listCalls += 1;
      if (options.getActions) return Promise.resolve(options.getActions(listCalls));
      const items = options.items ?? [planned, completed];
      return Promise.resolve(response({
        items,
        pagination: options.pagination ?? { page: Number(url.searchParams.get("page")), pageSize: Number(url.searchParams.get("pageSize")), totalItems: items.length, totalPages: items.length ? 1 : 0 },
      }));
    }
    if (url.pathname === "/api/staff/tickets/25/actions" && method === "POST") {
      return Promise.resolve(options.create ?? response({ data: { ...planned, id: 44 } }, 201));
    }
    const actionMatch = url.pathname.match(/^\/api\/actions\/(\d+)$/);
    if (actionMatch && method === "GET") {
      detailCalls += 1;
      const base = Number(actionMatch[1]) === 42 ? inProgress : Number(actionMatch[1]) === 40 ? completed : planned;
      const detail = typeof options.detail === "function" ? options.detail(detailCalls) : options.detail ?? base;
      return Promise.resolve(response({ data: detail }));
    }
    if (url.pathname.match(/^\/api\/staff\/actions\/\d+\/events$/) && method === "GET") {
      return Promise.resolve(response({ items: options.events ?? [event] }));
    }
    if (url.pathname.match(/^\/api\/staff\/actions\/\d+$/) && method === "PATCH") {
      return Promise.resolve(options.update ?? response({ data: { ...planned, description: "Updated description", version: 3 } }));
    }
    if (url.pathname.match(/^\/api\/staff\/actions\/\d+\/assignee$/) && method === "PATCH") {
      return Promise.resolve(options.assign ?? response({ data: { ...planned, assignee: { id: 9, name: "Mali Staff", role: "IT_STAFF", isActive: true }, version: 3 } }));
    }
    if (url.pathname.match(/^\/api\/staff\/actions\/\d+\/status$/) && method === "PATCH") {
      return Promise.resolve(options.transition ?? response({ data: { ...planned, status: "IN_PROGRESS", version: 3 } }));
    }
    return Promise.resolve(response({ error: { code: "UNEXPECTED", message: `Unexpected ${method} ${url.pathname}` } }, 500));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderActions(user: AuthenticatedUser = staff, status = "OPEN") {
  return render(<ActionsTaken
    ticketId={25}
    ticketNumber="TKT-000025"
    ticketStatus={status}
    ticketOwnerName="Mali Staff"
    currentUser={user}
  />);
}

async function openAction(name = planned.description) {
  const row = await screen.findByRole("row", { name: new RegExp(name) });
  await userEvent.click(within(row).getByRole("button", { name: "View action" }));
  await screen.findByRole("heading", { name: "Action Detail" });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Actions Taken list and role behavior (UI-ACT-01, AC-03/04/21)", () => {
  it("renders deterministic Action fields, history details, responsive table/cards, and pagination", async () => {
    const fetchMock = installFetch({ pagination: { page: 1, pageSize: 20, totalItems: 22, totalPages: 2 } });
    renderActions();
    expect(await screen.findByRole("heading", { name: /Actions Taken \(22\)/ })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(document.querySelectorAll(".action-mobile-card")).toHaveLength(2);
    const row = screen.getByRole("row", { name: new RegExp(planned.description) });
    expect(row).toHaveTextContent("Planned");
    expect(row).toHaveTextContent("Ari Staff");
    expect(row).toHaveTextContent("Not completed");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("page=2&pageSize=20"))).toBe(true));
  });

  it("shows named loading and empty states without stale rows", async () => {
    let resolveList!: (value: Response) => void;
    installFetch({ getActions: () => new Promise<Response>((resolve) => { resolveList = resolve; }) });
    renderActions();
    expect(screen.getByRole("status")).toHaveTextContent("Loading Actions Taken");
    resolveList(response({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }));
    expect(await screen.findByText("No Actions Taken have been recorded for this Ticket.")).toBeInTheDocument();
  });

  it("keeps the Requester view read-only and never requests protected history or assignees", async () => {
    const fetchMock = installFetch();
    renderActions(requester);
    await openAction();
    expect(screen.getByText(/Confirm stability tomorrow\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Plan action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Action history" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("eligible-owners") || String(input).includes("/events"))).toBe(false);
  });

  it("shows Staff controls and Administrator override controls only for non-terminal Actions", async () => {
    const assignedElsewhere = { ...planned, assignee: { ...planned.assignee, id: 9, name: "Mali Staff" } };
    installFetch({ items: [assignedElsewhere], detail: assignedElsewhere });
    const view = renderActions(staff);
    await openAction();
    expect(screen.getByRole("button", { name: "Edit action" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start action" })).not.toBeInTheDocument();
    view.unmount();
    installFetch({ items: [assignedElsewhere], detail: assignedElsewhere });
    renderActions(admin);
    await openAction();
    expect(screen.getByRole("button", { name: "Start action" })).toBeInTheDocument();
  });
});

describe("Action create and edit (UI-ACT-02/03, AC-05/10/22/26)", () => {
  it("validates required create fields and the conditional Follow-up Note before sending", async () => {
    const fetchMock = installFetch();
    renderActions();
    await screen.findByRole("heading", { name: /Actions Taken/ });
    await userEvent.click(screen.getByRole("button", { name: "Plan action" }));
    const formElement = screen.getByRole("heading", { name: "Plan an Action" }).closest("form");
    if (!formElement) throw new Error("Plan form not found");
    const form = within(formElement);
    await userEvent.clear(form.getByLabelText(/Action Description/));
    await userEvent.click(form.getByLabelText("Follow-Up Required?"));
    await userEvent.click(form.getByRole("button", { name: "Plan action" }));
    expect(form.getByText("Enter 1 to 2000 characters.")).toBeInTheDocument();
    expect(form.getByText("Enter 1 to 1000 characters when follow-up is required.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("creates through the real endpoint, refreshes the list, and never sends creator or performer identity", async () => {
    const created = { ...planned, id: 44, description: "Plan replacement work." };
    const fetchMock = installFetch({
      getActions: (call) => response({ items: call === 1 ? [planned] : [created, planned], pagination: { page: 1, pageSize: 20, totalItems: call === 1 ? 1 : 2, totalPages: 1 } }),
      create: response({ data: created }, 201),
    });
    renderActions();
    await userEvent.click(await screen.findByRole("button", { name: "Plan action" }));
    const formElement = screen.getByRole("heading", { name: "Plan an Action" }).closest("form")!;
    const form = within(formElement);
    await userEvent.type(form.getByLabelText(/Action Description/), "Plan replacement work.");
    await userEvent.selectOptions(form.getByLabelText(/Assigned to/), "9");
    await userEvent.click(form.getByRole("button", { name: "Plan action" }));
    expect(await screen.findByText("Action planned.")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe("http://localhost:3000/api/staff/tickets/25/actions");
    const body = JSON.parse(String(post?.[1]?.body));
    expect(body.assigneeId).toBe(9);
    expect(body).not.toHaveProperty("createdById");
    expect(body).not.toHaveProperty("performedById");
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/tickets/25/actions?")).length).toBeGreaterThanOrEqual(2);
  });

  it("prevents duplicate creation while the request is pending", async () => {
    let resolveCreate!: (value: Response) => void;
    const fetchMock = installFetch({ create: new Promise<Response>((resolve) => { resolveCreate = resolve; }) });
    renderActions();
    await userEvent.click(await screen.findByRole("button", { name: "Plan action" }));
    const formElement = screen.getByRole("heading", { name: "Plan an Action" }).closest("form")!;
    const form = within(formElement);
    await userEvent.type(form.getByLabelText(/Action Description/), "One request only");
    await userEvent.click(form.getByRole("button", { name: "Plan action" }));
    const saving = form.getByRole("button", { name: "Planning…" });
    expect(saving).toBeDisabled();
    await userEvent.click(saving);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    resolveCreate(response({ data: { ...planned, id: 44 } }, 201));
    expect(await screen.findByText("Action planned.")).toBeInTheDocument();
  });

  it("edits with expectedVersion and preserves the draft after a recoverable server failure", async () => {
    const fetchMock = installFetch({ update: response({ error: { code: "INTERNAL_ERROR", message: "Safe failure" } }, 500) });
    renderActions();
    await openAction();
    await userEvent.click(screen.getByRole("button", { name: "Edit action" }));
    const description = screen.getByLabelText(/Action Description/);
    await userEvent.clear(description);
    await userEvent.type(description, "Retained edited draft");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Safe failure");
    expect(description).toHaveValue("Retained edited draft");
    const patchCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/staff/actions/41") && init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({ expectedVersion: 2, description: "Retained edited draft" });
  });

  it("preserves the edit draft on a stale conflict and offers explicit latest values", async () => {
    const latest = { ...planned, version: 3, description: "New server description", updatedAt: "2026-10-24T10:00:00.000Z" };
    installFetch({ update: response({ error: { code: "ACTION_VERSION_CONFLICT", message: "Changed", current: { version: 3 } } }, 409), detail: (call) => call === 1 ? planned : latest });
    renderActions();
    await openAction();
    await userEvent.click(screen.getByRole("button", { name: "Edit action" }));
    const description = screen.getByLabelText(/Action Description/);
    await userEvent.clear(description);
    await userEvent.type(description, "My unsaved draft");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/This action changed after you opened it/)).toBeInTheDocument();
    expect(description).toHaveValue("My unsaved draft");
    await userEvent.click(screen.getByRole("button", { name: "Use latest values" }));
    expect(description).toHaveValue("New server description");
  });
});

describe("Assignment and lifecycle (UI-ACT-02, AC-06/07/08/09)", () => {
  it("confirms reassignment by name and sends the dedicated versioned request", async () => {
    const fetchMock = installFetch();
    renderActions();
    await openAction();
    await userEvent.click(screen.getByRole("button", { name: "Reassign action" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Ari Staff");
    await userEvent.selectOptions(screen.getByLabelText("Assigned to"), "9");
    await userEvent.click(screen.getByRole("button", { name: "Confirm reassignment" }));
    expect(await screen.findByText("Action reassigned.")).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/api/staff/actions/41/assignee"));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedVersion: 2, assigneeId: 9 });
  });

  it("reports an inactive assignee rejection without changing the confirmed display", async () => {
    installFetch({ assign: response({ error: { code: "INELIGIBLE_ASSIGNEE", message: "Private detail" } }, 400) });
    renderActions();
    await openAction();
    await userEvent.click(screen.getByRole("button", { name: "Reassign action" }));
    await userEvent.selectOptions(screen.getByLabelText("Assigned to"), "9");
    await userEvent.click(screen.getByRole("button", { name: "Confirm reassignment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("inactive or no longer eligible");
    expect(screen.getByRole("dialog")).toHaveTextContent("Ari Staff");
  });

  it("starts an assigned planned Action with only status and expectedVersion", async () => {
    const fetchMock = installFetch();
    renderActions();
    await openAction();
    await userEvent.click(screen.getByRole("button", { name: "Start action" }));
    expect(await screen.findByText("Action started.")).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/api/staff/actions/41/status"));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedVersion: 2, status: "IN_PROGRESS" });
  });

  it("validates and completes an in-progress Action without spoofing the performer", async () => {
    const completedResponse = { ...inProgress, status: "COMPLETED" as const, result: "Both networks work.", performedBy: { id: 7, name: "Ari Staff", role: "IT_STAFF" as const }, completedAt: "2026-10-24T04:00:00.000Z", version: 5 };
    const fetchMock = installFetch({ items: [inProgress], transition: response({ data: completedResponse }) });
    renderActions();
    await openAction(inProgress.description);
    await userEvent.click(screen.getByRole("button", { name: "Complete action" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm completion" }));
    expect(within(dialog).getByText("Enter a Result before completing this Action.")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Result/), "Both networks work.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm completion" }));
    expect(await screen.findByText("Action completed.")).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/api/staff/actions/42/status"));
    const body = JSON.parse(String(call?.[1]?.body));
    expect(body).toMatchObject({ expectedVersion: 4, status: "COMPLETED", result: "Both networks work." });
    expect(body).not.toHaveProperty("performedById");
  });

  it("requires a cancellation reason and sends explicit confirmation", async () => {
    const fetchMock = installFetch({ transition: response({ data: { ...planned, status: "CANCELLED", cancelledAt: "2026-10-24T04:00:00.000Z", cancelledBy: planned.createdBy, cancellationReason: "Duplicate plan", version: 3 } }) });
    renderActions();
    await openAction();
    await userEvent.click(screen.getByRole("button", { name: "Cancel action" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm cancellation" }));
    expect(within(dialog).getByText("Enter 1 to 500 characters.")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Cancellation reason/), "Duplicate plan");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm cancellation" }));
    expect(await screen.findByText("Action cancelled.")).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/api/staff/actions/41/status"));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedVersion: 2, status: "CANCELLED", confirmed: true, cancellationReason: "Duplicate plan" });
  });
});

describe("safe failures, keyboard, and accessibility (UI-ACT-03/UI-A11Y-01)", () => {
  it.each([
    [401, "UNAUTHENTICATED", "Your session has expired. Sign in again."],
    [403, "FORBIDDEN", "You do not have access to Actions Taken for this Ticket."],
    [404, "TICKET_NOT_FOUND", "This Ticket is unavailable or you do not have access."],
    [500, "INTERNAL_ERROR", "Unable to load Actions Taken right now."],
  ])("shows a safe retry state for %s without protected data", async (status, code, message) => {
    installFetch({ getActions: () => response({ error: { code, message: "private stack/path" } }, status) });
    renderActions(requester);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("private stack/path")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("supports Escape, modal focus, and focus return for cancellation", async () => {
    installFetch();
    renderActions();
    await openAction();
    const invoke = screen.getByRole("button", { name: "Cancel action" });
    invoke.focus();
    await userEvent.click(invoke);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: "Close dialog" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(invoke).toHaveFocus();
  });

  it("hides creation for a terminal Ticket and retains non-color status text", async () => {
    installFetch({ items: [completed] });
    renderActions(staff, "CLOSED");
    expect(await screen.findAllByText("Completed")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Plan action" })).not.toBeInTheDocument();
  });
});
