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

describe("Login screen", () => {
  it("validates required fields and toggles password visibility", async () => {
    render(<LoginScreen onAuthenticated={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("shows a busy state and returns only the safe authenticated user", async () => {
    let resolveResponse!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    })));
    const onAuthenticated = vi.fn();
    render(<LoginScreen onAuthenticated={onAuthenticated} />);
    await userEvent.type(screen.getByLabelText("Email"), " User@Example.com ");
    await userEvent.type(screen.getByLabelText("Password"), "correct-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();

    resolveResponse(jsonResponse({ data: { user: {
      id: 7, name: "Ari Staff", email: "user@example.com", role: "IT_STAFF",
      isActive: true, mustChangePassword: false,
    }, csrfToken: "csrf-token" } }));
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(expect.objectContaining({
      name: "Ari Staff", role: "IT_STAFF",
    })));
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/login",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it.each([
    [401, "INVALID_CREDENTIALS", "The email or password is incorrect."],
    [403, "ACCOUNT_INACTIVE", "This account cannot sign in. Contact an administrator."],
    [429, "LOGIN_THROTTLED", "Too many sign-in attempts. Try again later."],
    [500, "INTERNAL_ERROR", "Unable to sign in right now. Please try again."],
  ])("shows a safe failure for HTTP %i", async (status, code, expectedMessage) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      error: { code, message: "server detail that is intentionally mapped" },
    }, status, status === 429 ? { "Retry-After": "60" } : {})));
    render(<LoginScreen onAuthenticated={vi.fn()} />);
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    await userEvent.type(email, "user@example.com");
    await userEvent.type(password, "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
    expect(email).toHaveValue("user@example.com");
    expect(password).toHaveValue("");
    await waitFor(() => expect(password).toHaveFocus());
  });
});

