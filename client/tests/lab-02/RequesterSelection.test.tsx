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
      await screen.findByText("Select a requester before continuing.")
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
      name: "Continue",
    });

    expect(continueButton).toBeDisabled();

    await userEvent.selectOptions(select, "1");

    expect(continueButton).toBeEnabled();
  });

  it("shows the selected requester as the current requester", async () => {
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

    await userEvent.selectOptions(select, "2");

    await userEvent.click(
      screen.getByRole("button", {
        name: "Continue",
      })
    );

    expect(
      screen.getByText(/Current requester:/)
    ).toBeInTheDocument();

    expect(screen.getByText("Ploy K.")).toBeInTheDocument();
    expect(screen.getByText("ploy@example.com")).toBeInTheDocument();
  });

  it("allows the current requester to be changed", async () => {
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

    await userEvent.selectOptions(select, "1");

    await userEvent.click(
      screen.getByRole("button", {
        name: "Continue",
      })
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Change Requester",
      })
    );

    expect(
      await screen.findByText("Select a requester before continuing.")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Continue",
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