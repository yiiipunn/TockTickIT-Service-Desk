import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketQueue from "../../src/StaffTicketQueue";

const item = {
  id: 25,
  ticketNumber: "TKT-000025",
  summary: "Cannot connect to Wi-Fi",
  requester: { id: 3, name: "Narin S.", email: "narin@example.com" },
  status: "OPEN",
  requestedPriority: "MEDIUM",
  itPriority: "HIGH",
  owner: { id: 7, name: "Ari Staff" },
  updatedAt: "2026-09-11T03:15:00.000Z",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function queue(items = [item], matching = items.length) {
  return {
    items,
    pagination: { page: 1, pageSize: 20, totalItems: matching, totalPages: matching ? 1 : 0 },
    counts: { matching, matchingUnassigned: items.filter((ticket) => ticket.owner === null).length },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("IT Staff Ticket Queue", () => {
  it("shows a named loading state while the queue is loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Ticket Queue");
  });

  it("renders approved controls, compact result data, counts, and ticket navigation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(queue())));
    const onOpenTicket = vi.fn();
    render(<StaffTicketQueue onOpenTicket={onOpenTicket} />);

    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Requested Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("IT Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("Owner")).toBeInTheDocument();
    expect(screen.getByLabelText("Owner user ID")).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === "1 matching")).toBeInTheDocument();
    expect(screen.getAllByText("TKT-000025").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Requested: Medium").length).toBeGreaterThan(0);
    expect(screen.getAllByText("IT: High").length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole("button", { name: "Open Ticket" })[0]);
    expect(onOpenTicket).toHaveBeenCalledWith(item);
  });

  it("distinguishes an empty queue from search/filter no results and offers Clear", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(queue([], 0)))
      .mockResolvedValueOnce(response(queue([], 0)));
    vi.stubGlobal("fetch", fetchMock);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "The Ticket Queue is empty" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search"), "not found");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("heading", { name: "No matching tickets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("preserves an applied search while changing pages", async () => {
    const nextPage = {
      ...queue([item], 21),
      pagination: { page: 2, pageSize: 20, totalItems: 21, totalPages: 2 },
    };
    const firstPage = {
      ...queue([item], 21),
      pagination: { page: 1, pageSize: 20, totalItems: 21, totalPages: 2 },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(queue([item], 21)))
      .mockResolvedValueOnce(response(firstPage))
      .mockResolvedValueOnce(response(nextPage));
    vi.stubGlobal("fetch", fetchMock);
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    await screen.findByRole("heading", { name: "Ticket Queue" });
    await userEvent.type(screen.getByLabelText("Search"), "Wi-Fi");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText((_, node) => node?.textContent === "Page 1 of 2");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText((_, node) => node?.textContent === "Page 2 of 2");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:3000/api/staff/tickets?search=Wi-Fi&sortBy=updatedAt&sortOrder=desc&pageSize=20&page=2",
      { credentials: "include" },
    );
  });

  it.each([
    [403, { error: { code: "FORBIDDEN", message: "Forbidden" } }, "You do not have access to the Ticket Queue."],
    [500, { error: { code: "INTERNAL_ERROR", message: "database detail" } }, "Unable to load the Ticket Queue right now."],
  ])("shows a safe failure state for HTTP %i", async (status, body, expected) => {
    vi.stubGlobal("fetch", vi.fn(async () => response(body, status)));
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
