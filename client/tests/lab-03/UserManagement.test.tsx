import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserManagement from "../../src/UserManagement";

const currentUser = { id: 7, name: "Administrator", email: "admin@example.com", role: "ADMINISTRATOR" as const, isActive: true, mustChangePassword: false };
const user = { id: 21, name: "Mali Requester", email: "mali@example.com", role: "REQUESTER", isActive: true, mustChangePassword: true, createdAt: "2026-09-18T00:00:00.000Z", updatedAt: "2026-09-18T00:00:00.000Z" };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function installFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(String(input), init)));
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Administrator User Management", () => {
  it("shows named loading, then safe user fields, roles, statuses, and edit actions", async () => {
    let resolve!: (response: Response) => void;
    installFetch(() => new Promise<Response>((done) => { resolve = done; }));
    render(<UserManagement currentUser={currentUser} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Users");
    resolve(response({ items: [user] }));
    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getAllByText("Mali Requester").length).toBeGreaterThan(0);
    expect(screen.getAllByText("mali@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Requester").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Edit Mali Requester" }).length).toBeGreaterThan(0);
  });

  it("searches by name/email and reports no results with Clear", async () => {
    const fetchMock = installFetch(() => response({ items: [] }));
    render(<UserManagement currentUser={currentUser} />);
    await screen.findByRole("heading", { name: "No users found" });
    await userEvent.type(screen.getByLabelText("Search"), "mali@example.com");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "REQUESTER");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("heading", { name: "No matching users" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("http://localhost:3000/api/admin/users?search=mali%40example.com&role=REQUESTER", { credentials: "include" });
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("creates one-role users and sends the initial password only to the protected endpoint", async () => {
    const created = { ...user, id: 22, name: "New Staff", email: "new.staff@example.com", role: "IT_STAFF" as const };
    const fetchMock = installFetch((url, init) => {
      if (url.includes("/api/admin/users") && init?.method === "POST") return response({ data: created }, 201);
      return response({ items: [created] });
    });
    render(<UserManagement currentUser={currentUser} />);
    await screen.findByRole("heading", { name: "User Management" });
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    await userEvent.type(screen.getByLabelText("Name *"), "New Staff");
    await userEvent.type(screen.getByLabelText("Email *"), "new.staff@example.com");
    await userEvent.selectOptions(screen.getByLabelText("Role *"), "IT_STAFF");
    await userEvent.type(screen.getByLabelText("Initial Password *"), "InitialPassword!");
    await userEvent.type(screen.getByLabelText("Confirm Initial Password *"), "InitialPassword!");
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    expect(await screen.findByRole("status")).toHaveTextContent("User created");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/admin/users", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "New Staff", email: "new.staff@example.com", role: "IT_STAFF", isActive: true, initialPassword: "InitialPassword!" }) }));
  });

  it("shows field validation and preserves entered values after a create failure", async () => {
    installFetch((url, init) => url.includes("/api/admin/users") && init?.method === "POST"
      ? response({ error: { code: "VALIDATION_ERROR", message: "Invalid", fields: { email: "Enter a valid email address." } } }, 400)
      : response({ items: [] }));
    render(<UserManagement currentUser={currentUser} />);
    await screen.findByRole("heading", { name: "User Management" });
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    await userEvent.type(screen.getByLabelText("Name *"), "New User");
    await userEvent.type(screen.getByLabelText("Email *"), "invalid");
    await userEvent.type(screen.getByLabelText("Initial Password *"), "InitialPassword!");
    await userEvent.type(screen.getByLabelText("Confirm Initial Password *"), "InitialPassword!");
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(screen.getByLabelText("Name *")).toHaveValue("New User");
    expect(screen.getByLabelText("Email *")).toHaveValue("invalid");
  });

  it("edits account data and offers the separate initial-password action", async () => {
    const changed = { ...user, name: "Mali Updated", role: "IT_STAFF" as const, isActive: false };
    let patched = false;
    const fetchMock = installFetch((url, init) => {
      if (init?.method === "PATCH") { patched = true; return response({ data: changed }); }
      return response({ items: [patched ? changed : user] });
    });
    render(<UserManagement currentUser={currentUser} />);
    await screen.findByRole("heading", { name: "User Management" });
    await userEvent.click(screen.getAllByRole("button", { name: "Edit Mali Requester" })[0]);
    expect(await screen.findByRole("heading", { name: "Edit User" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "Mali Updated" } });
    await userEvent.selectOptions(screen.getByLabelText("Role *"), "IT_STAFF");
    await userEvent.selectOptions(screen.getByLabelText("Account Status *"), "false");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent("User changes saved");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/admin/users/21", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Mali Updated", email: "mali@example.com", role: "IT_STAFF", isActive: false }) }));
  });

  it("sets a new initial password with an explanation and safe failure state", async () => {
    const fetchMock = installFetch((url, init) => {
      if (url.includes("initial-password") && init?.method === "POST") return response({ data: { userId: user.id, mustChangePassword: true } });
      return response({ items: [user] });
    });
    render(<UserManagement currentUser={currentUser} />);
    await screen.findByRole("heading", { name: "User Management" });
    await userEvent.click(screen.getAllByRole("button", { name: "Edit Mali Requester" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Set New Initial Password" }));
    expect(await screen.findByRole("heading", { name: "Set New Initial Password" })).toBeInTheDocument();
    expect(screen.getByText(/ends existing sessions/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("New Initial Password"), "ReplacementPassword!");
    await userEvent.click(screen.getByRole("button", { name: "Set Initial Password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("New initial password set");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/api/admin/users/21/initial-password", expect.objectContaining({ method: "POST", body: JSON.stringify({ initialPassword: "ReplacementPassword!" }) }));
  });
});
