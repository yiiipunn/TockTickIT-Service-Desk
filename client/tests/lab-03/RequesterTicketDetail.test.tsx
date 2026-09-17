import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";
import type { CommunicationEntry } from "../../src/api";

const user = { id: 3, name: "Narin Requester", email: "narin@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false };
const category = { id: 1, name: "Account and Access" };
const system = { id: 2, name: "Email" };
const ticket = {
  id: 101, ticketNumber: "TKT-000101", requesterId: user.id,
  summary: "Cannot sign in", description: "Sign-in fails.", requestedPriority: "MEDIUM",
  status: "OPEN", createdAt: "2026-09-11T03:00:00.000Z", updatedAt: "2026-09-11T04:00:00.000Z",
  category, relatedSystem: system, attachments: [],
};
const existing: CommunicationEntry = {
  id: 8, ticketId: ticket.id, content: '<script>alert("unsafe")</script>\nPlease help.',
  author: { id: 7, name: "Ari Staff", role: "IT_STAFF" },
  createdAt: "2026-09-11T04:30:00.000Z",
};
const created: CommunicationEntry = {
  id: 9, ticketId: ticket.id, content: "Thank you for the update.",
  author: { id: user.id, name: user.name, role: "REQUESTER" },
  createdAt: "2026-09-11T04:31:00.000Z",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function installFetch(options: {
  comments?: CommunicationEntry[];
  commentGet?: Response | Promise<Response>;
  commentPost?: Response | Promise<Response>;
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/auth/me") return Promise.resolve(response({ data: { user, csrfToken: "requester-csrf" } }));
    if (path === "/api/categories") return Promise.resolve(response([category]));
    if (path === "/api/related-systems") return Promise.resolve(response([system]));
    if (path === "/api/tickets") return Promise.resolve(response({ items: [ticket], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } }));
    if (path === "/api/tickets/101") return Promise.resolve(response({ ...ticket, internalNotes: [{ content: "SECRET INTERNAL MARKER" }] }));
    if (path === "/api/tickets/101/public-comments") {
      if (init?.method === "POST") return Promise.resolve(options.commentPost ?? response({ data: created }, 201));
      return Promise.resolve(options.commentGet ?? response({ items: options.comments ?? [existing] }));
    }
    return Promise.resolve(response({ error: { code: "UNEXPECTED", message: "Unexpected request" } }, 500));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openDetail() {
  render(<App />);
  await screen.findByRole("heading", { name: "My Tickets" });
  await userEvent.click(screen.getAllByRole("button", { name: "View TKT-000101" })[0]);
  await screen.findByRole("heading", { name: "Public Comments" });
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Requester Ticket Detail Public Comments", () => {
  it("renders public history, server author/time, and HTML-like text without exposing notes", async () => {
    const fetchMock = installFetch();
    await openDetail();
    const content = await screen.findByText((_text, element) => element?.tagName === "P" && element.textContent === existing.content);
    expect(screen.getByText("Ari Staff")).toBeInTheDocument();
    expect(screen.getByText(new Date(existing.createdAt).toLocaleString())).toBeInTheDocument();
    expect(content.tagName).toBe("P");
    expect(screen.queryByText("SECRET INTERNAL MARKER")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Internal Notes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Internal Note" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("internal-notes"))).toBe(false);
  });

  it("shows a loading state, then an empty state and a labeled composer", async () => {
    let resolveGet!: (value: Response) => void;
    installFetch({ commentGet: new Promise<Response>((resolve) => { resolveGet = resolve; }) });
    await openDetail();
    expect(screen.getByRole("status")).toHaveTextContent("Loading public comments");
    resolveGet(response({ items: [] }));
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Public Comment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post Public Comment" })).toBeInTheDocument();
  });

  it("rejects whitespace and over-length content before sending", async () => {
    const fetchMock = installFetch({ comments: [] });
    await openDetail();
    const input = await screen.findByRole("textbox", { name: "Public Comment" });
    await userEvent.type(input, "   ");
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter 1 to 2000 characters");
    expect(input).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(input);
    fireEvent.change(input, { target: { value: "x".repeat(2001) } });
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter 1 to 2000 characters");
    expect(fetchMock.mock.calls.filter(([input, init]) => String(input).includes("public-comments") && init?.method === "POST")).toHaveLength(0);
  });

  it("prevents duplicate posts and shows only the server-confirmed comment", async () => {
    let resolvePost!: (value: Response) => void;
    const fetchMock = installFetch({ comments: [], commentPost: new Promise<Response>((resolve) => { resolvePost = resolve; }) });
    await openDetail();
    const input = await screen.findByRole("textbox", { name: "Public Comment" });
    await userEvent.type(input, "Thank you for the update.");
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    expect(screen.getByRole("button", { name: "Posting Public Comment..." })).toBeDisabled();
    expect(screen.queryByText((_text, element) => element?.tagName === "P" && element.textContent === created.content)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path, init]) => String(path).includes("public-comments") && init?.method === "POST")).toHaveLength(1);
    resolvePost(response({ data: created }, 201));
    expect(await screen.findByText(created.content)).toBeInTheDocument();
    expect(screen.getByText("Public Comment posted successfully.")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/tickets/101/public-comments",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ content: created.content }), headers: expect.objectContaining({ "X-CSRF-Token": "requester-csrf" }) }),
    );
  });

  it("keeps the draft and shows failure without adding a fake comment", async () => {
    installFetch({ comments: [], commentPost: response({ error: { code: "INTERNAL_ERROR", message: "Safe failure" } }, 500) });
    await openDetail();
    const input = await screen.findByRole("textbox", { name: "Public Comment" });
    await userEvent.type(input, "Please try this update.");
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to post the Public Comment");
    expect(input).toHaveValue("Please try this update.");
    expect(screen.queryByText((_text, element) => element?.tagName === "P" && element.textContent === "Please try this update.")).not.toBeInTheDocument();
    expect(screen.queryByText("Public Comment posted successfully.")).not.toBeInTheDocument();
  });

  it("handles forbidden comment retrieval without showing a composer", async () => {
    installFetch({ commentGet: response({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403) });
    await openDetail();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("do not have access"));
    expect(screen.queryByRole("textbox", { name: "Public Comment" })).not.toBeInTheDocument();
  });
});
