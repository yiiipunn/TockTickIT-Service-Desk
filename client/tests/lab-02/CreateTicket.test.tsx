import "@testing-library/jest-dom";

import { render, screen, waitFor } from "@testing-library/react";
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

const emptyTicketList = {
  items: [],
  pagination: {
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  },
};

function isGetTicketsRequest(url: string, init?: RequestInit) {
  return (
    url.includes("/api/tickets") &&
    init?.method !== "POST"
  );
}

function mockFetchForCreateTicket(options: { attachmentError?: string } = {}) {
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

      // My Tickets is loaded after selecting a requester.
      if (isGetTicketsRequest(url, init)) {
        return {
          ok: true,
          json: async () => emptyTicketList,
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

      if (
        url.endsWith("/api/tickets/1/attachments") &&
        init?.method === "POST"
      ) {
        if (options.attachmentError) {
          return {
            ok: false,
            json: async () => ({
              error: {
                code: "ATTACHMENT_UPLOAD_FAILED",
                message: options.attachmentError,
              },
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            data: {
              id: 10,
              ticketId: 1,
              originalFilename: "evidence.pdf",
              mimeType: "application/pdf",
              sizeBytes: 8,
              isRemoved: false,
              removedAt: null,
              removalReason: null,
              createdAt: "2026-09-01T08:01:00.000Z",
              updatedAt: "2026-09-01T08:01:00.000Z",
            },
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function selectRequesterAndContinue() {
  const requesterSelect = await screen.findByLabelText(
    "Development Requester",
  );

  await userEvent.selectOptions(
    requesterSelect,
    "1",
  );

  await userEvent.click(
    screen.getByRole("button", {
      name: /Continue/i,
    }),
  );

  await userEvent.click(
    screen.getByRole("button", {
      name: "Create Ticket",
    }),
  );

  await screen.findByRole("heading", {
    name: "Create Ticket",
  });
}

function getCreateTicketCategory() {
  return screen.getByLabelText("Category", {
    selector: "#ticket-category",
  });
}

function getCreateTicketRelatedSystem() {
  return screen.getByLabelText("Related System", {
    selector: "#ticket-related-system",
  });
}

function getCreateTicketSubmitButton() {
  const button = screen
    .getByLabelText("Summary")
    .closest("form")
    ?.querySelector<HTMLButtonElement>('button[type="submit"]');

  if (!button) {
    throw new Error("Create Ticket submit button was not found");
  }

  return button;
}

async function completeRequiredTicketFields() {
  await userEvent.selectOptions(getCreateTicketCategory(), "1");
  await userEvent.selectOptions(getCreateTicketRelatedSystem(), "1");
  await userEvent.type(screen.getByLabelText("Summary"), "Network problem");
  await userEvent.type(
    screen.getByLabelText("Description"),
    "The connection keeps dropping.",
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Lab 2 - Create Ticket UI", () => {
  it(
    "shows the Create Ticket form after selecting a requester",
    async () => {
      mockFetchForCreateTicket();

      render(<App />);

      await selectRequesterAndContinue();

      expect(
        getCreateTicketCategory(),
      ).toBeInTheDocument();

      expect(
        getCreateTicketRelatedSystem(),
      ).toBeInTheDocument();

      expect(
        screen.getByLabelText("Summary"),
      ).toBeInTheDocument();

      expect(
        screen.getByLabelText("Requested Priority"),
      ).toBeInTheDocument();

      expect(
        screen.getByLabelText("Description"),
      ).toBeInTheDocument();
    },
  );

  it(
    "keeps Create Ticket disabled when required fields are empty",
    async () => {
      mockFetchForCreateTicket();

      render(<App />);

      await selectRequesterAndContinue();

      expect(
        getCreateTicketSubmitButton(),
      ).toBeDisabled();
    },
  );

  it(
    "enables Create Ticket when required fields are valid",
    async () => {
      mockFetchForCreateTicket();

      render(<App />);

      await selectRequesterAndContinue();

      await userEvent.selectOptions(
        getCreateTicketCategory(),
        "1",
      );

      await userEvent.selectOptions(
        getCreateTicketRelatedSystem(),
        "1",
      );

      await userEvent.type(
        screen.getByLabelText("Summary"),
        "Unable to connect to campus Wi-Fi",
      );

      await userEvent.type(
        screen.getByLabelText("Description"),
        "I cannot connect to the campus Wi-Fi from the engineering building.",
      );

      expect(
        getCreateTicketSubmitButton(),
      ).toBeEnabled();
    },
  );

  it(
    "creates a ticket and displays the Ticket Number",
    async () => {
      mockFetchForCreateTicket();

      render(<App />);

      await selectRequesterAndContinue();

      await userEvent.selectOptions(
        getCreateTicketCategory(),
        "1",
      );

      await userEvent.selectOptions(
        getCreateTicketRelatedSystem(),
        "1",
      );

      await userEvent.type(
        screen.getByLabelText("Summary"),
        "Unable to connect to campus Wi-Fi",
      );

      await userEvent.type(
        screen.getByLabelText("Description"),
        "I cannot connect to the campus Wi-Fi from the engineering building.",
      );

      await userEvent.click(
        getCreateTicketSubmitButton(),
      );

      expect(
        await screen.findByText(
          "Ticket created successfully",
        ),
      ).toBeInTheDocument();

      expect(
        screen.getByText("TKT-000001"),
      ).toBeInTheDocument();

      expect(
        screen.getByText("NEW"),
      ).toBeInTheDocument();
    },
  );

  it(
    "sends the selected requester in X-Requester-Id",
    async () => {
      const fetchMock = vi.fn(
        async (
          input: RequestInfo | URL,
          init?: RequestInit,
        ) => {
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

          if (isGetTicketsRequest(url, init)) {
            expect(init?.headers).toMatchObject({
              "X-Requester-Id": "1",
            });

            return {
              ok: true,
              json: async () => emptyTicketList,
            } as Response;
          }

          if (
            url.endsWith("/api/tickets") &&
            init?.method === "POST"
          ) {
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
                createdAt:
                  "2026-09-01T08:00:00.000Z",
                updatedAt:
                  "2026-09-01T08:00:00.000Z",
              }),
            } as Response;
          }

          throw new Error(`Unexpected fetch: ${url}`);
        },
      );

      vi.stubGlobal("fetch", fetchMock);

      render(<App />);

      await selectRequesterAndContinue();

      await userEvent.selectOptions(
        getCreateTicketCategory(),
        "1",
      );

      await userEvent.selectOptions(
        getCreateTicketRelatedSystem(),
        "1",
      );

      await userEvent.type(
        screen.getByLabelText("Summary"),
        "Printer issue",
      );

      await userEvent.type(
        screen.getByLabelText("Description"),
        "Printer is not responding.",
      );

      await userEvent.click(
        getCreateTicketSubmitButton(),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "http://localhost:3000/api/tickets",
          expect.objectContaining({
            method: "POST",
          }),
        );
      });
    },
  );

  it(
    "keeps entered data when ticket creation fails",
    async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async (
            input: RequestInfo | URL,
            init?: RequestInit,
          ) => {
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

            if (isGetTicketsRequest(url, init)) {
              return {
                ok: true,
                json: async () => emptyTicketList,
              } as Response;
            }

            if (
              url.endsWith("/api/tickets") &&
              init?.method === "POST"
            ) {
              return {
                ok: false,
                json: async () => ({
                  error: "Unable to create ticket",
                }),
              } as Response;
            }

            throw new Error(
              `Unexpected fetch: ${url}`,
            );
          },
        ),
      );

      render(<App />);

      await selectRequesterAndContinue();

      await userEvent.selectOptions(
        getCreateTicketCategory(),
        "1",
      );

      await userEvent.selectOptions(
        getCreateTicketRelatedSystem(),
        "1",
      );

      await userEvent.type(
        screen.getByLabelText("Summary"),
        "Network problem",
      );

      await userEvent.type(
        screen.getByLabelText("Description"),
        "The connection keeps dropping.",
      );

      await userEvent.click(
        getCreateTicketSubmitButton(),
      );

      expect(
        await screen.findByText(
          "Unable to create ticket",
        ),
      ).toBeInTheDocument();

      expect(
        screen.getByLabelText("Summary"),
      ).toHaveValue("Network problem");

      expect(
        screen.getByLabelText("Description"),
      ).toHaveValue(
        "The connection keeps dropping.",
      );
    },
  );

  it("uploads selected attachments after creating the ticket", async () => {
    const fetchMock = mockFetchForCreateTicket();
    render(<App />);

    await selectRequesterAndContinue();
    await completeRequiredTicketFields();

    const file = new File(["%PDF-1.4"], "evidence.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(screen.getByLabelText("Attachments"), file);
    await userEvent.click(getCreateTicketSubmitButton());

    expect(
      await screen.findByText("1 attachment uploaded successfully."),
    ).toBeInTheDocument();

    const uploadCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/api/tickets/1/attachments"),
    );
    expect(uploadCall).toBeDefined();
    expect(uploadCall?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: { "X-Requester-Id": "1" },
        body: expect.any(FormData),
      }),
    );
  });

  it("keeps the created ticket when an attachment upload fails", async () => {
    mockFetchForCreateTicket({
      attachmentError: "Attachment exceeds the 5 MB limit.",
    });
    render(<App />);

    await selectRequesterAndContinue();
    await completeRequiredTicketFields();

    const file = new File(["%PDF-1.4"], "evidence.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(screen.getByLabelText("Attachments"), file);
    await userEvent.click(getCreateTicketSubmitButton());

    expect(
      await screen.findByText("Ticket created successfully"),
    ).toBeInTheDocument();
    expect(screen.getByText("TKT-000001")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The ticket was created, but some attachments could not be uploaded.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "evidence.pdf: Attachment exceeds the 5 MB limit.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You can retry from Ticket Detail."),
    ).toBeInTheDocument();
  });
});
