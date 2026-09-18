import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChangePasswordScreen from "../../src/ChangePasswordScreen";
import LoginScreen from "../../src/LoginScreen";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Change Password screen", () => {
  it("shows mandatory guidance, validates every field, and toggles password visibility", async () => {
    render(
      <ChangePasswordScreen
        mandatory
        onPasswordChanged={vi.fn()}
        onSessionExpired={vi.fn()}
      />,
    );
    expect(screen.getByText(/change your initial password/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(screen.getByText("Enter your current password.")).toBeInTheDocument();
    expect(screen.getByText("Enter a new password.")).toBeInTheDocument();
    expect(screen.getByText("Confirm your new password.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Current password"), "current-password");
    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "different");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(screen.getByText("Password must contain 12 to 128 characters.")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();

    const current = screen.getByLabelText("Current password");
    expect(current).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByLabelText("Show passwords"));
    expect(current).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "text");
  });

  it("submits with CSRF, announces success, and returns the rotated safe user", async () => {
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    const onPasswordChanged = vi.fn();

    render(<LoginScreen onAuthenticated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "initial-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    resolveResponse(jsonResponse({ data: { user: {
      id: 7, name: "Ari Staff", email: "user@example.com", role: "IT_STAFF",
      isActive: true, mustChangePassword: true,
    }, csrfToken: "change-csrf" } }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const { unmount } = render(
      <ChangePasswordScreen
        mandatory
        onPasswordChanged={onPasswordChanged}
        onSessionExpired={vi.fn()}
      />,
    );
    const fields = screen.getAllByLabelText(/password/i).filter((element) =>
      element.tagName === "INPUT" && element.getAttribute("type") === "password",
    );
    await userEvent.type(fields[1], "initial-password");
    await userEvent.type(fields[2], "new-password!");
    await userEvent.type(fields[3], "new-password!");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(screen.getByRole("button", { name: "Changing Password…" })).toBeDisabled();

    resolveResponse(jsonResponse({ data: { user: {
      id: 7, name: "Ari Staff", email: "user@example.com", role: "IT_STAFF",
      isActive: true, mustChangePassword: false,
    }, csrfToken: "rotated-csrf" } }));
    expect(await screen.findByRole("status")).toHaveTextContent("Password changed successfully");
    await waitFor(() => expect(onPasswordChanged).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: false }),
    ));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:3000/api/auth/change-password",
      expect.objectContaining({
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "change-csrf",
        },
      }),
    );
    unmount();
  });

  it("shows a safe current-password failure, clears that field, and restores focus", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "The current password is incorrect.",
        fields: { currentPassword: "The current password is incorrect." },
      },
    }, 401)));
    render(
      <ChangePasswordScreen
        mandatory={false}
        onPasswordChanged={vi.fn()}
        onSessionExpired={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const current = screen.getByLabelText("Current password");
    await userEvent.type(current, "wrong-password");
    await userEvent.type(screen.getByLabelText("New password"), "new-password!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-password!");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The current password is incorrect.");
    expect(current).toHaveValue("");
    await waitFor(() => expect(current).toHaveFocus());
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("returns an expired session to the authentication boundary", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      error: { code: "AUTH_REQUIRED", message: "Authentication is required." },
    }, 401)));
    const onSessionExpired = vi.fn();
    render(
      <ChangePasswordScreen
        mandatory
        onPasswordChanged={vi.fn()}
        onSessionExpired={onSessionExpired}
      />,
    );
    await userEvent.type(screen.getByLabelText("Current password"), "current-password");
    await userEvent.type(screen.getByLabelText("New password"), "new-password!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-password!");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledOnce());
  });
});
