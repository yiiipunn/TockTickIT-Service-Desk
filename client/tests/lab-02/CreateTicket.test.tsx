import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.js";

const requesters = [
  {
    id: 1,
    name: "Narin S.",
    email: "narin@example.com",
  },
];

const categories = [
  {
    id: 1,
    name: "Network",
  },
];

const relatedSystems = [
  {
    id: 1,
    name: "Campus Wi-Fi",
  },
];

function mockFetchForCreateTicket() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/requesters")) {
        return {
          ok: true,
          json: async () => requesters,
        } as Response;
      }

      if (url.endsWith("/api/categories")) {
        return {
          ok: true,
          json: async () => categories,
        } as Response;
      }

      if (url.endsWith("/api/related-systems")) {
        return {
          ok: true,
          json: async () => relatedSystems,
        } as Response;
      }

      if (
        url.endsWith("/api/tickets") &&
        init?.method === "POST"
      ) {
        return {
          ok: true,
          json: async () => ({
            id: 1,
            ticketNumber: "TKT-000001",
            requesterId: 1,
            categoryId: 1,
            relatedSystemId: 1,
            summary: "Unable to connect to campus Wi-Fi",
            requestedPriority: "MEDIUM",
            description:
              "I cannot connect to the campus Wi-Fi from the engineering building.",
            status: "NEW",
            createdAt: "2026-09-01T08:00:00.000Z",
            updatedAt: "2026-09-01T08:00:00.000Z",
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    })
  );
}

async function selectRequesterAndContinue() {
  await screen.findByText(/Select a requester before continuing/i);

  await userEvent.selectOptions(
    screen.getByLabelText("Development Requester"),
    "1"
  );

  await userEvent.click(
    screen.getByRole("button", {
      name: "Continue",
    })
  );

  await screen.findByRole("heading", {
    name: "Create Ticket",
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Lab 2 - Create Ticket UI", () => {
  it("shows the Create Ticket form after selecting a requester", async () => {
    mockFetchForCreateTicket();

    render(<App />);

    await selectRequesterAndContinue();

    expect(
      screen.getByLabelText("Category")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Related System")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Summary")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Requested Priority")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Description")
    ).toBeInTheDocument();
  });

  it("keeps Create Ticket disabled when required fields are empty", async () => {
    mockFetchForCreateTicket();

    render(<App />);

    await selectRequesterAndContinue();

    expect(
      screen.getByRole("button", {
        name: "Create Ticket",
      })
    ).toBeDisabled();
  });

  it("enables Create Ticket when required fields are valid", async () => {
    mockFetchForCreateTicket();

    render(<App />);

    await selectRequesterAndContinue();

    await userEvent.selectOptions(
      screen.getByLabelText("Category"),
      "1"
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Related System"),
      "1"
    );

    await userEvent.type(
      screen.getByLabelText("Summary"),
      "Unable to connect to campus Wi-Fi"
    );

    await userEvent.type(
      screen.getByLabelText("Description"),
      "I cannot connect to the campus Wi-Fi from the engineering building."
    );

    expect(
      screen.getByRole("button", {
        name: "Create Ticket",
      })
    ).toBeEnabled();
  });

  it("creates a ticket and displays the Ticket Number", async () => {
    mockFetchForCreateTicket();

    render(<App />);

    await selectRequesterAndContinue();

    await userEvent.selectOptions(
      screen.getByLabelText("Category"),
      "1"
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Related System"),
      "1"
    );

    await userEvent.type(
      screen.getByLabelText("Summary"),
      "Unable to connect to campus Wi-Fi"
    );

    await userEvent.type(
      screen.getByLabelText("Description"),
      "I cannot connect to the campus Wi-Fi from the engineering building."
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Create Ticket",
      })
    );

    expect(
      await screen.findByText("Ticket created successfully")
    ).toBeInTheDocument();

    expect(
      screen.getByText("TKT-000001")
    ).toBeInTheDocument();

    expect(
      screen.getByText("NEW")
    ).toBeInTheDocument();
  });

  it("sends the selected requester in X-Requester-Id", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/api/requesters")) {
          return {
            ok: true,
            json: async () => requesters,
          } as Response;
        }

        if (url.endsWith("/api/categories")) {
          return {
            ok: true,
            json: async () => categories,
          } as Response;
        }

        if (url.endsWith("/api/related-systems")) {
          return {
            ok: true,
            json: async () => relatedSystems,
          } as Response;
        }

        if (url.endsWith("/api/tickets")) {
          expect(init?.headers).toMatchObject({
            "Content-Type": "application/json",
            "X-Requester-Id": "1",
          });

          return {
            ok: true,
            json: async () => ({
              id: 1,
              ticketNumber: "TKT-000001",
              requesterId: 1,
              categoryId: 1,
              relatedSystemId: 1,
              summary: "Printer issue",
              requestedPriority: "MEDIUM",
              description: "Printer is not responding.",
              status: "NEW",
              createdAt: "2026-09-01T08:00:00.000Z",
              updatedAt: "2026-09-01T08:00:00.000Z",
            }),
          } as Response;
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await selectRequesterAndContinue();

    await userEvent.selectOptions(
      screen.getByLabelText("Category"),
      "1"
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Related System"),
      "1"
    );

    await userEvent.type(
      screen.getByLabelText("Summary"),
      "Printer issue"
    );

    await userEvent.type(
      screen.getByLabelText("Description"),
      "Printer is not responding."
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Create Ticket",
      })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/api/tickets",
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  it("keeps entered data when ticket creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/api/requesters")) {
          return {
            ok: true,
            json: async () => requesters,
          } as Response;
        }

        if (url.endsWith("/api/categories")) {
          return {
            ok: true,
            json: async () => categories,
          } as Response;
        }

        if (url.endsWith("/api/related-systems")) {
          return {
            ok: true,
            json: async () => relatedSystems,
          } as Response;
        }

        if (url.endsWith("/api/tickets")) {
          return {
            ok: false,
            json: async () => ({
              error: "Unable to create ticket",
            }),
          } as Response;
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    render(<App />);

    await selectRequesterAndContinue();

    await userEvent.selectOptions(
      screen.getByLabelText("Category"),
      "1"
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Related System"),
      "1"
    );

    await userEvent.type(
      screen.getByLabelText("Summary"),
      "Network problem"
    );

    await userEvent.type(
      screen.getByLabelText("Description"),
      "The connection keeps dropping."
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Create Ticket",
      })
    );

    expect(
      await screen.findByText("Unable to create ticket")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Summary")
    ).toHaveValue("Network problem");

    expect(
      screen.getByLabelText("Description")
    ).toHaveValue("The connection keeps dropping.");
  });
});