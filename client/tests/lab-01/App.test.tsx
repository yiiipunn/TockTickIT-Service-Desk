import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

function installLab2ShellFetch() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    let body: unknown;

    if (url.endsWith("/api/requesters")) {
      body = [{ id: 1, name: "Narin S.", email: "narin@example.com" }];
    } else if (url.endsWith("/api/categories") ||
      url.endsWith("/api/related-systems")) {
      body = [];
    } else if (url.includes("/api/tickets")) {
      body = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
      };
    } else {
      throw new Error(`Unexpected fetch: ${url}`);
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));
}

async function openSystemStatus(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(
    await screen.findByLabelText("Development Requester"),
    "1",
  );
  await user.click(screen.getByRole("button", { name: /Continue/i }));
  await screen.findByRole("heading", { name: "My Tickets" });
  await user.click(screen.getByText("System Status"));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("App", () => {
  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", async () => {
    installLab2ShellFetch();
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Development Requester"),
    ).toBeInTheDocument();
  });

  // Issue 4 — success state
  it("shows Online and the seeded categories on success", async () => {
    installLab2ShellFetch();
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 3, name: "Software" },
        { id: 4, name: "Network" },
      ],
    });

    const user = userEvent.setup();

    render(<App />);

    await openSystemStatus(user);

    await user.click(
      screen.getByRole("button", { name: /check system/i })
    );

    expect(await screen.findByText("Online")).toBeInTheDocument();

    expect(screen.getByText("Account and Access")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
  });

  // Issue 4 — error state
  it("shows an Offline error message when the API is unavailable", async () => {
    installLab2ShellFetch();
    vi.spyOn(api, "checkSystem").mockRejectedValue(
      new Error("Unable to connect to TokTickIT API")
    );

    const user = userEvent.setup();

    render(<App />);

    await openSystemStatus(user);

    await user.click(
      screen.getByRole("button", { name: /check system/i })
    );

    expect(await screen.findByText("Offline")).toBeInTheDocument();

    expect(
      screen.getByText(/Unable to connect to the TokTickIT API/i)
    ).toBeInTheDocument();
  });
});
