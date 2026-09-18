import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const authenticatedUser = {
  id: 1,
  name: "Narin S.",
  email: "narin@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};

function installAuthenticatedRequesterFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/auth/me")) {
      return new Response(JSON.stringify({
        data: { user: authenticatedUser, csrfToken: "csrf-token" },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/api/auth/logout") && init?.method === "POST") {
      return new Response(null, { status: 204 });
    }
    const body = url.includes("/api/tickets")
      ? { items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }
      : [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authenticated requester context", () => {
  it("uses restored server identity and removes requester selection", async () => {
    const fetchMock = installAuthenticatedRequesterFetch();
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    expect(screen.getByText("Narin S.")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    expect(screen.queryByLabelText("Development Requester")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continue/i })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) =>
      String(input).endsWith("/api/requesters"),
    )).toBe(false);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers ?? {}).not.toHaveProperty("X-Requester-Id");
    }
  });

  it("logs out instead of changing requester identity", async () => {
    const fetchMock = installAuthenticatedRequesterFetch();
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("heading", { name: "Sign in to TokTickIT" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": "csrf-token" },
      }),
    );
  });
});
