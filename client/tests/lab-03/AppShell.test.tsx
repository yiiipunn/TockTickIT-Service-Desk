import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";

function installFetch(role = "REQUESTER", mustChangePassword = false) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/auth/me")) {
      return new Response(JSON.stringify({ data: { user: {
        id: 7,
        name: "Ari Example",
        email: "ari@example.com",
        role,
        isActive: true,
        mustChangePassword,
      }, csrfToken: "shell-csrf" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/api/auth/logout") && init?.method === "POST") {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith("/api/auth/change-password") && init?.method === "POST") {
      return new Response(JSON.stringify({ data: { user: {
        id: 7,
        name: "Ari Example",
        email: "ari@example.com",
        role,
        isActive: true,
        mustChangePassword: false,
      }, csrfToken: "rotated-shell-csrf" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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

describe("authenticated application shell", () => {
  it("restores a requester session and shows server-provided identity and role", async () => {
    installFetch();
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    expect(screen.getByText("Ari Example")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    expect(screen.queryByLabelText("Development Requester")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("blocks normal access when an initial password change is required", async () => {
    installFetch("REQUESTER", true);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Password change required" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "My Tickets" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("cannot bypass a required change on refresh and enters the requester app only after success", async () => {
    const fetchMock = installFetch("REQUESTER", true);
    render(<App />);
    await screen.findByRole("heading", { name: "Password change required" });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/tickets"))).toBe(false);

    await userEvent.type(screen.getByLabelText("Current password"), "initial-password");
    await userEvent.type(screen.getByLabelText("New password"), "new-password!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-password!");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Password changed successfully");
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/change-password",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "shell-csrf",
        },
      }),
    );
  });

  it("allows a normal user to open and cancel voluntary password change", async () => {
    installFetch("REQUESTER", false);
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByRole("heading", { name: "Change Password" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });

  it("shows a staff identity without implementing future staff navigation", async () => {
    installFetch("IT_STAFF");
    render(<App />);
    expect(await screen.findByText("IT Staff")).toBeInTheDocument();
    expect(screen.getByText("Ari Example")).toBeInTheDocument();
    expect(screen.queryByText("Ticket Queue")).not.toBeInTheDocument();
  });

  it("logs out with CSRF and returns to login", async () => {
    const fetchMock = installFetch("IT_STAFF");
    render(<App />);
    await screen.findByText("IT Staff");
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("heading", { name: "Sign in to TokTickIT" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/logout",
      expect.objectContaining({
        credentials: "include",
        headers: { "X-CSRF-Token": "shell-csrf" },
      }),
    );
  });
});
