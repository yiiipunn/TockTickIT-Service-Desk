import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const mockRequesters = [
  {
    id: 1,
    name: "Narin S.",
    email: "narin@example.com",
  },
  {
    id: 2,
    name: "Ploy K.",
    email: "ploy@example.com",
  },
];

function mockSuccessfulRequesterFlow() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    let body: unknown;

    if (url.endsWith("/api/requesters")) {
      body = mockRequesters;
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
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});
describe("Development Requester Selection", () => {
  it("loads and displays active development requesters", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRequesters), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    render(<App />);

    expect(
      screen.getByText("Loading development requesters...")
    ).toBeInTheDocument();

    expect(
      await screen.findByLabelText("Development Requester")
    ).toBeInTheDocument();

    expect(screen.getByText(/Narin S\./)).toBeInTheDocument();
    expect(screen.getByText(/Ploy K\./)).toBeInTheDocument();
  });

  it("keeps Continue disabled until a requester is selected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRequesters), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    render(<App />);

    const select = await screen.findByRole("combobox");
    const continueButton = screen.getByRole("button", {
      name: /Continue/i,
    });

    expect(continueButton).toBeDisabled();

    await userEvent.selectOptions(select, "1");

    expect(continueButton).toBeEnabled();
  });

  it("shows the selected requester as the current requester", async () => {
    mockSuccessfulRequesterFlow();

    render(<App />);

    const select = await screen.findByRole("combobox");

    await userEvent.selectOptions(select, "2");

    await userEvent.click(
      screen.getByRole("button", {
        name: /Continue/i,
      })
    );

    await screen.findByRole("heading", { name: "My Tickets" });

    expect(screen.getByText("Requester")).toBeInTheDocument();

    expect(screen.getByText("Ploy K.")).toBeInTheDocument();
  });

  it("allows the current requester to be changed", async () => {
    mockSuccessfulRequesterFlow();

    render(<App />);

    const select = await screen.findByRole("combobox");

    await userEvent.selectOptions(select, "1");

    await userEvent.click(
      screen.getByRole("button", {
        name: /Continue/i,
      })
    );

    await screen.findByRole("heading", { name: "My Tickets" });

    await userEvent.click(
      screen.getByRole("button", {
        name: /Change/i,
      })
    );

    expect(
      await screen.findByLabelText("Development Requester")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Continue/i,
      })
    ).toBeDisabled();
  });

  it("shows an error and retry option when requesters cannot be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, {
        status: 500,
      })
    );

    render(<App />);

    expect(
      await screen.findByText("Unable to load development requesters.")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Retry",
      })
    ).toBeInTheDocument();
  });

  it("shows an empty state when no active requesters are available", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText("No active development requesters are available.")
      ).toBeInTheDocument();
    });
  });
});
