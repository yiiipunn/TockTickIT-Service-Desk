import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../../src/StaffTicketDetail";
import type { CommunicationEntry, StaffTicketDetail as StaffTicketDetailData } from "../../src/api";

const staff = { id: 7, name: "Ari Staff", email: "ari@example.com", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false };
const requester = { ...staff, role: "REQUESTER" as const };
const eligibleOwners = [
  { id: staff.id, name: staff.name, email: staff.email, role: "IT_STAFF" as const },
  { id: 9, name: "Mali Staff", email: "mali@example.com", role: "IT_STAFF" as const },
];
const unassigned: StaffTicketDetailData = {
  id: 25, ticketNumber: "TKT-000025", summary: "Cannot connect", description: "The connection fails after login.",
  requester: { id: 3, name: "Narin", email: "narin@example.com" }, category: { id: 1, name: "Network" }, relatedSystem: { id: 1, name: "Wi-Fi" },
  status: "OPEN", requestedPriority: "MEDIUM", itPriority: "HIGH", owner: null, ownerAssignedAt: null,
  requesterResolutionIndicatedAt: null, createdAt: "2026-09-11T03:00:00.000Z", updatedAt: "2026-09-11T03:15:00.000Z", attachments: [],
  publicComments: [], internalNotes: [],
  allowedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"],
};
const publicEntry: CommunicationEntry = {
  id: 50, ticketId: 25, content: "Public update from Requester",
  author: { id: 3, name: "Narin", role: "REQUESTER" }, createdAt: "2026-09-11T04:00:00.000Z",
};
const internalEntry: CommunicationEntry = {
  id: 51, ticketId: 25, content: '<script>alert("private")</script>',
  author: { id: staff.id, name: staff.name, role: "IT_STAFF" }, createdAt: "2026-09-11T04:01:00.000Z",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function detail(ticket = unassigned) {
  return { data: ticket };
}

function installFetch(ticket = unassigned, mutation?: Response | Promise<Response>) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response(detail(ticket)))
    .mockResolvedValueOnce(response({ items: eligibleOwners }));
  if (mutation) fetchMock.mockImplementationOnce(() => mutation);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("IT Staff Ticket Detail assignment", () => {
  it("shows Claim Ticket for an unassigned Ticket to IT Staff and updates ownership after success", async () => {
    const assigned = { ...unassigned, owner: { id: staff.id, name: staff.name }, ownerAssignedAt: "2026-09-12T03:15:00.000Z" };
    installFetch(unassigned, response(detail(assigned)));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Claim Ticket" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Claim Ticket" }));
    expect(await screen.findByText("Ticket claimed successfully.")).toBeInTheDocument();
    expect(screen.getByText("Ari Staff")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim Ticket" })).not.toBeInTheDocument();
  });

  it("shows the current owner and Reassign control for an assigned Ticket", async () => {
    const assigned = { ...unassigned, owner: { id: staff.id, name: staff.name }, ownerAssignedAt: "2026-09-12T03:15:00.000Z" };
    installFetch(assigned);
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    expect(await screen.findByText("Ari Staff")).toBeInTheDocument();
    expect(screen.getByLabelText("Reassign Ticket")).toHaveValue(String(staff.id));
    expect(screen.getByRole("button", { name: "Reassign Ticket" })).toBeDisabled();
  });

  it("does not expose Claim or Reassign to a Requester", async () => {
    installFetch();
    render(<StaffTicketDetail ticketId={25} currentUser={requester} onBack={vi.fn()} />);
    await screen.findByText("Unassigned");
    expect(screen.queryByRole("button", { name: "Claim Ticket" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Assign Ticket|Reassign Ticket/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Internal Notes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Internal Note" })).not.toBeInTheDocument();
  });

  it("keeps ownership unchanged and shows safe feedback when Claim fails", async () => {
    installFetch(unassigned, response({ error: { code: "OWNER_CONFLICT", message: "detail" } }, 409));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Claim Ticket" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("assigned before your claim");
    expect(screen.getByRole("button", { name: "Claim Ticket" })).toBeInTheDocument();
  });

  it("prevents duplicate claims while saving", async () => {
    let resolveClaim!: (value: Response) => void;
    const fetchMock = installFetch(unassigned, new Promise<Response>((resolve) => { resolveClaim = resolve; }));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Claim Ticket" }));
    const saving = screen.getByRole("button", { name: "Claiming Ticket…" });
    expect(saving).toBeDisabled();
    await userEvent.click(saving);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    resolveClaim(response(detail({ ...unassigned, owner: { id: staff.id, name: staff.name }, ownerAssignedAt: "2026-09-12T03:15:00.000Z" })));
    await waitFor(() => expect(screen.getByText("Ari Staff")).toBeInTheDocument());
  });

  it("reassigns to an eligible active IT Staff user and updates the displayed owner", async () => {
    const assigned = { ...unassigned, owner: { id: staff.id, name: staff.name }, ownerAssignedAt: "2026-09-12T03:15:00.000Z" };
    const reassigned = { ...unassigned, owner: { id: 9, name: "Mali Staff" }, ownerAssignedAt: "2026-09-12T04:15:00.000Z" };
    const fetchMock = installFetch(assigned, response(detail(reassigned)));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.selectOptions(await screen.findByLabelText("Reassign Ticket"), "9");
    await userEvent.click(screen.getByRole("button", { name: "Reassign Ticket" }));
    expect(await screen.findByText("Ticket reassigned successfully.")).toBeInTheDocument();
    expect(screen.getByText("Mali Staff")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:3000/api/staff/tickets/25/owner",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ ownerId: 9 }) }),
    );
  });

  it("does not falsely update ownership when reassignment fails", async () => {
    const assigned = { ...unassigned, owner: { id: staff.id, name: staff.name }, ownerAssignedAt: "2026-09-12T03:15:00.000Z" };
    installFetch(assigned, response({ error: { code: "VALIDATION_ERROR", message: "detail" } }, 400));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.selectOptions(await screen.findByLabelText("Reassign Ticket"), "9");
    await userEvent.click(screen.getByRole("button", { name: "Reassign Ticket" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("selected assignee is no longer available");
    expect(screen.getByText("Ari Staff")).toBeInTheDocument();
    expect(screen.queryByText("Mali Staff")).not.toBeInTheDocument();
  });

  it("prevents duplicate reassignment while saving", async () => {
    const assigned = { ...unassigned, owner: { id: staff.id, name: staff.name }, ownerAssignedAt: "2026-09-12T03:15:00.000Z" };
    let resolveAssignment!: (value: Response) => void;
    const fetchMock = installFetch(assigned, new Promise<Response>((resolve) => { resolveAssignment = resolve; }));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.selectOptions(await screen.findByLabelText("Reassign Ticket"), "9");
    await userEvent.click(screen.getByRole("button", { name: "Reassign Ticket" }));
    const saving = screen.getByRole("button", { name: "Saving Assignment…" });
    expect(saving).toBeDisabled();
    await userEvent.click(saving);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    resolveAssignment(response(detail({ ...unassigned, owner: { id: 9, name: "Mali Staff" }, ownerAssignedAt: "2026-09-12T04:15:00.000Z" })));
    await waitFor(() => expect(screen.getByText("Mali Staff")).toBeInTheDocument());
  });
});

describe("IT Staff Ticket priority and status", () => {
  it("shows Requested Priority as read-only and the current editable IT Priority", async () => {
    installFetch();
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    expect(await screen.findByLabelText("IT Priority")).toHaveValue("HIGH");
    expect(screen.getByText("Requested Priority:").parentElement).toHaveTextContent("MEDIUM");
    expect(screen.getByText("Current IT Priority:").parentElement).toHaveTextContent("HIGH");
    expect(screen.getByRole("button", { name: "Save IT Priority" })).toBeDisabled();
  });

  it("saves IT Priority from the server response without changing Requested Priority", async () => {
    const fetchMock = installFetch(unassigned, response(detail({ ...unassigned, itPriority: "LOW" })));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.selectOptions(await screen.findByLabelText("IT Priority"), "LOW");
    await userEvent.click(screen.getByRole("button", { name: "Save IT Priority" }));
    expect(await screen.findByText("IT Priority updated successfully.")).toBeInTheDocument();
    expect(screen.getByText("Current IT Priority:").parentElement).toHaveTextContent("LOW");
    expect(screen.getByText("Requested Priority:").parentElement).toHaveTextContent("MEDIUM");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:3000/api/staff/tickets/25/it-priority",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ itPriority: "LOW" }) }),
    );
  });

  it("keeps the confirmed IT Priority after a failed save and prevents duplicate submission", async () => {
    let resolvePriority!: (value: Response) => void;
    const fetchMock = installFetch(unassigned, new Promise<Response>((resolve) => { resolvePriority = resolve; }));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.selectOptions(await screen.findByLabelText("IT Priority"), "LOW");
    await userEvent.click(screen.getByRole("button", { name: "Save IT Priority" }));
    expect(screen.getByRole("button", { name: "Saving IT Priority…" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    resolvePriority(response({ error: { code: "INTERNAL_ERROR", message: "private detail" } }, 500));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to update IT Priority");
    expect(screen.getByText("Current IT Priority:").parentElement).toHaveTextContent("HIGH");
    expect(screen.queryByText("IT Priority updated successfully.")).not.toBeInTheDocument();
  });

  it("shows only server-allowed next statuses and updates after a confirmed response", async () => {
    const fetchMock = installFetch(unassigned, response(detail({ ...unassigned, status: "WAITING_FOR_REQUESTER", allowedTransitions: ["CANCELLED"] })));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    const next = await screen.findByLabelText("Next Status");
    expect(screen.getByText("Current Status:").parentElement).toHaveTextContent("Open");
    expect(next).toHaveTextContent("Waiting for Requester");
    expect(next).not.toHaveTextContent("Resolved");
    await userEvent.selectOptions(next, "WAITING_FOR_REQUESTER");
    await userEvent.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByText("Ticket status updated successfully.")).toBeInTheDocument();
    expect(screen.getByText("Current Status:").parentElement).toHaveTextContent("Waiting for Requester");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:3000/api/staff/tickets/25/status",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ currentStatus: "OPEN", status: "WAITING_FOR_REQUESTER", confirmed: false }) }),
    );
  });

  it("keeps the current status after a failed transition and prevents duplicate submission", async () => {
    let resolveStatus!: (value: Response) => void;
    const fetchMock = installFetch(unassigned, new Promise<Response>((resolve) => { resolveStatus = resolve; }));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.selectOptions(await screen.findByLabelText("Next Status"), "WAITING_FOR_REQUESTER");
    await userEvent.click(screen.getByRole("button", { name: "Update Status" }));
    expect(screen.getByRole("button", { name: "Saving Status…" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    resolveStatus(response({ error: { code: "INTERNAL_ERROR", message: "private detail" } }, 500));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to update the Ticket status");
    expect(screen.getByText("Current Status:").parentElement).toHaveTextContent("Open");
    expect(screen.queryByText("Ticket status updated successfully.")).not.toBeInTheDocument();
  });

  it("reloads authoritative status after a conflict without showing a successful update", async () => {
    const fetchMock = installFetch(unassigned, response({ error: { code: "STATUS_CONFLICT", message: "private detail" } }, 409));
    fetchMock.mockResolvedValueOnce(response(detail({ ...unassigned, status: "RESOLVED", allowedTransitions: ["CLOSED", "REOPENED"] })));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.selectOptions(await screen.findByLabelText("Next Status"), "WAITING_FOR_REQUESTER");
    await userEvent.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("status changed");
    await waitFor(() => expect(screen.getByText("Current Status:").parentElement).toHaveTextContent("Resolved"));
    expect(screen.queryByText("Ticket status updated successfully.")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("requires confirmation before cancellation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const fetchMock = installFetch(unassigned, response(detail({ ...unassigned, status: "CANCELLED", allowedTransitions: [] })));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.selectOptions(await screen.findByLabelText("Next Status"), "CANCELLED");
    await userEvent.click(screen.getByRole("button", { name: "Update Status" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByText("Ticket status updated successfully.")).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:3000/api/staff/tickets/25/status",
      expect.objectContaining({ body: JSON.stringify({ currentStatus: "OPEN", status: "CANCELLED", confirmed: true }) }),
    );
  });

  it("does not expose priority or status controls to a Requester", async () => {
    installFetch();
    render(<StaffTicketDetail ticketId={25} currentUser={requester} onBack={vi.fn()} />);
    await screen.findByText("Requested Priority:");
    expect(screen.queryByLabelText("IT Priority")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Next Status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update Status" })).not.toBeInTheDocument();
  });
});

describe("IT Staff Ticket communication", () => {
  it("shows public comments and visibly private notes with server author/time and plain text", async () => {
    installFetch({ ...unassigned, publicComments: [publicEntry], internalNotes: [internalEntry] });
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Public Comments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Internal Notes" })).toBeInTheDocument();
    expect(screen.getByText("Visible to Requester and IT Staff")).toBeInTheDocument();
    expect(screen.getByText("Private to IT Staff and Administrators")).toBeInTheDocument();
    expect(screen.getByText(publicEntry.content)).toBeInTheDocument();
    expect(screen.getByText(internalEntry.content).tagName).toBe("P");
    expect(screen.getByText(new Date(internalEntry.createdAt).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText("Ari Staff")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim Ticket" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save IT Priority" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update Status" })).toBeInTheDocument();
  });

  it("posts public and internal entries through separate endpoints after server confirmation", async () => {
    const postedPublic = { ...publicEntry, id: 52, content: "Staff public message", author: { id: staff.id, name: staff.name, role: "IT_STAFF" as const } };
    const postedInternal = { ...internalEntry, id: 53, content: "Private diagnosis" };
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(response({ data: postedPublic }, 201));
    fetchMock.mockResolvedValueOnce(response({ data: postedInternal }, 201));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await userEvent.type(await screen.findByRole("textbox", { name: "Public Comment" }), "Staff public message");
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    expect(await screen.findByText("Staff public message")).toBeInTheDocument();
    expect(screen.getByText("Public Comment posted successfully.")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Internal Note" }), "Private diagnosis");
    await userEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));
    expect(await screen.findByText("Private diagnosis")).toBeInTheDocument();
    expect(screen.getByText("Internal Note added successfully.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/tickets/25/public-comments",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ content: "Staff public message" }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/staff/tickets/25/internal-notes",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ content: "Private diagnosis" }) }),
    );
  });

  it("validates both composers before sending and keeps their labels distinct", async () => {
    const fetchMock = installFetch();
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    await screen.findByRole("textbox", { name: "Public Comment" });
    await userEvent.type(screen.getByRole("textbox", { name: "Public Comment" }), "  ");
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Internal Note" }), "  ");
    await userEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));
    expect(screen.getAllByText("Enter 1 to 2000 characters of plain text.")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("prevents duplicate internal-note submissions and retains the draft on failure", async () => {
    let resolveNote!: (value: Response) => void;
    const fetchMock = installFetch();
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveNote = resolve; }));
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    const input = await screen.findByRole("textbox", { name: "Internal Note" });
    await userEvent.type(input, "Private draft");
    await userEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));
    expect(screen.getByRole("button", { name: "Adding Internal Note..." })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    resolveNote(response({ error: { code: "INTERNAL_ERROR", message: "Safe failure" } }, 500));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to add the Internal Note");
    expect(input).toHaveValue("Private draft");
    expect(screen.queryByText("Internal Note added successfully.")).not.toBeInTheDocument();
  });

  it("shows separate empty states without treating them as errors", async () => {
    installFetch();
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} />);
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
    expect(screen.getByText("No internal notes yet.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
