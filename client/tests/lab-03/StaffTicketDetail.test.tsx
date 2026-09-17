import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../../src/StaffTicketDetail";
import type { StaffTicketDetail as StaffTicketDetailData } from "../../src/api";

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
