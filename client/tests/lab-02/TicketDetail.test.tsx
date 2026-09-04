import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";

const requester = {
  id: 1,
  name: "Narin S.",
  email: "narin@example.com",
};

const category = {
  id: 1,
  name: "Hardware",
};

const relatedSystem = {
  id: 1,
  name: "Printer",
};

const ticketListResponse = {
  items: [
    {
      id: 101,
      ticketNumber: "TKT-000101",
      requesterId: 1,
      summary: "Printer is not working",
      requestedPriority: "MEDIUM",
      status: "NEW",
      createdAt: "2026-09-02T08:00:00.000Z",
      updatedAt: "2026-09-02T08:30:00.000Z",
      category,
      relatedSystem,
    },
  ],
  pagination: {
    page: 1,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
  },
};

const ticketDetailResponse = {
  id: 101,
  ticketNumber: "TKT-000101",
  requesterId: 1,
  summary: "Printer is not working",
  requestedPriority: "MEDIUM",
  description:
    "The printer does not respond when I send a document.",
  status: "NEW",
  createdAt: "2026-09-02T08:00:00.000Z",
  updatedAt: "2026-09-02T08:30:00.000Z",
  category,
  relatedSystem,
  attachments: [
    {
      id: 1,
      originalFilename: "printer-error.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      createdAt: "2026-09-02T08:10:00.000Z",
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }),
  );
}

function installFetchMock(options?: {
  detailError?: boolean;
  noAttachments?: boolean;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input.toString();

      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;

      if (pathname === "/api/requesters") {
        return jsonResponse([requester]);
      }

      if (pathname === "/api/categories") {
        return jsonResponse([category]);
      }

      if (pathname === "/api/related-systems") {
        return jsonResponse([relatedSystem]);
      }

      if (pathname === "/api/tickets/101") {
        if (options?.detailError) {
          return jsonResponse(
            {
              error: "Unable to load ticket",
            },
            500,
          );
        }

        return jsonResponse({
          ...ticketDetailResponse,
          attachments: options?.noAttachments
            ? []
            : ticketDetailResponse.attachments,
        });
      }

      if (pathname === "/api/tickets") {
        return jsonResponse(ticketListResponse);
      }

      return jsonResponse(
        {
          error: "Unexpected request",
        },
        500,
      );
    }),
  );
}

async function selectRequester() {
  await screen.findByRole("option", {
    name: /Narin S\./i,
  });

  fireEvent.change(
    screen.getByLabelText("Development Requester"),
    {
      target: {
        value: "1",
      },
    },
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: /Continue/i,
    }),
  );

  await screen.findByRole("heading", {
    name: "My Tickets",
  });

  const ticketNumbers =
    await screen.findAllByText("TKT-000101");

  expect(ticketNumbers.length).toBeGreaterThan(0);
}

function openTicketDetail() {
  const viewButtons = screen.getAllByRole("button", {
    name: "View TKT-000101",
  });

  expect(viewButtons.length).toBeGreaterThan(0);

  fireEvent.click(viewButtons[0]);
}

describe("Requester Ticket Detail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens Ticket Detail from My Tickets", async () => {
    installFetchMock();

    render(<App />);

    await selectRequester();

    openTicketDetail();

    expect(
      await screen.findByRole("heading", {
        name: "Ticket Detail",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Printer is not working", {
        selector: "p",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The printer does not respond when I send a document.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Hardware", {
        selector: "div",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Printer", {
        selector: "div",
      }),
    ).toBeInTheDocument();
  });

  it("sends the selected requester in the detail request", async () => {
    installFetchMock();

    render(<App />);

    await selectRequester();

    openTicketDetail();

    await screen.findByRole("heading", {
      name: "Ticket Detail",
    });

    const fetchMock = vi.mocked(fetch);

    const detailCall = fetchMock.mock.calls.find(
      ([input]) => {
        const url =
          typeof input === "string"
            ? input
            : input.toString();

        return (
          new URL(url).pathname === "/api/tickets/101"
        );
      },
    );

    expect(detailCall).toBeDefined();

    const options = detailCall?.[1] as RequestInit;

    expect(options.headers).toEqual(
      expect.objectContaining({
        "X-Requester-Id": "1",
      }),
    );
  });

  it("displays active attachments", async () => {
    installFetchMock();

    render(<App />);

    await selectRequester();

    openTicketDetail();

    expect(
      await screen.findByText("printer-error.png"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/image\/png/i),
    ).toBeInTheDocument();
  });

  it("shows the empty attachment state", async () => {
    installFetchMock({
      noAttachments: true,
    });

    render(<App />);

    await selectRequester();

    openTicketDetail();

    expect(
      await screen.findByText(
        "No attachments for this ticket.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an error when Ticket Detail cannot be loaded", async () => {
    installFetchMock({
      detailError: true,
    });

    render(<App />);

    await selectRequester();

    openTicketDetail();

    expect(
      await screen.findByText("Unable to load ticket"),
    ).toBeInTheDocument();
  });

  it("returns from Ticket Detail to My Tickets", async () => {
    installFetchMock();

    render(<App />);

    await selectRequester();

    openTicketDetail();

    await screen.findByRole("heading", {
      name: "Ticket Detail",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Back to My Tickets/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: "Ticket Detail",
        }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("heading", {
        name: "My Tickets",
      }),
    ).toBeInTheDocument();
  });
});
