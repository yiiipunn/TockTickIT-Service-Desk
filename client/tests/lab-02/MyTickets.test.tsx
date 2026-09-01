import "@testing-library/jest-dom";

import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import App from "../../src/App.js";

const requesters = [
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

const categories = [
  {
    id: 1,
    name: "Network",
  },
  {
    id: 2,
    name: "Hardware",
  },
];

const relatedSystems = [
  {
    id: 1,
    name: "Campus Wi-Fi",
  },
  {
    id: 2,
    name: "Printer",
  },
];

const requesterOneTickets = [
  {
    id: 1,
    ticketNumber: "TKT-000001",
    requesterId: 1,
    summary: "Unable to connect to Wi-Fi",
    requestedPriority: "HIGH",
    status: "NEW",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
    category: {
      id: 1,
      name: "Network",
    },
    relatedSystem: {
      id: 1,
      name: "Campus Wi-Fi",
    },
  },
  {
    id: 2,
    ticketNumber: "TKT-000002",
    requesterId: 1,
    summary: "Printer is not responding",
    requestedPriority: "MEDIUM",
    status: "NEW",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T11:00:00.000Z",
    category: {
      id: 2,
      name: "Hardware",
    },
    relatedSystem: {
      id: 2,
      name: "Printer",
    },
  },
];

function ticketListResponse(
  items = requesterOneTickets,
  page = 1,
  pageSize = 10,
  totalItems = items.length,
  totalPages = items.length === 0 ? 0 : 1,
) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

function mockBaseFetch(
  ticketHandler?: (
    url: string,
    init?: RequestInit,
  ) => Promise<Response>,
) {
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

      if (
        url.includes("/api/tickets") &&
        init?.method !== "POST"
      ) {
        if (ticketHandler) {
          return ticketHandler(url, init);
        }

        return {
          ok: true,
          json: async () => ticketListResponse(),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    },
  );

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

async function selectRequester(
  requesterId = "1",
) {
  await screen.findByText(
    /Select a requester before continuing/i,
  );

  await userEvent.selectOptions(
    screen.getByLabelText(
      "Development Requester",
    ),
    requesterId,
  );

  await userEvent.click(
    screen.getByRole("button", {
      name: "Continue",
    }),
  );

  await screen.findByRole("heading", {
    name: "My Tickets",
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Lab 2 - My Tickets UI", () => {
  it(
    "loads and displays tickets for the selected requester",
    async () => {
      mockBaseFetch();

      render(<App />);

      await selectRequester();

      expect(
        await screen.findByText("TKT-000001"),
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "Unable to connect to Wi-Fi",
        ),
      ).toBeInTheDocument();

      expect(
        screen.getByText("TKT-000002"),
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "Printer is not responding",
        ),
      ).toBeInTheDocument();
    },
  );

  it(
    "sends the selected requester in X-Requester-Id",
    async () => {
      const fetchMock = mockBaseFetch();

      render(<App />);

      await selectRequester("1");

      await waitFor(() => {
        const ticketCall =
          fetchMock.mock.calls.find(
            ([input, init]) => {
              const url = String(input);

              return (
                url.includes("/api/tickets") &&
                init?.method !== "POST"
              );
            },
          );

        expect(ticketCall).toBeDefined();

        expect(
          ticketCall?.[1]?.headers,
        ).toMatchObject({
          "X-Requester-Id": "1",
        });
      });
    },
  );

  it(
    "searches tickets by Ticket Number or Summary",
    async () => {
      const fetchMock = mockBaseFetch();

      render(<App />);

      await selectRequester();

      await userEvent.type(
        screen.getByLabelText("Search"),
        "Wi-Fi",
      );

      await userEvent.click(
        screen.getByRole("button", {
          name: "Apply",
        }),
      );

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(
            ([input]) =>
              String(input).includes(
                "search=Wi-Fi",
              ),
          ),
        ).toBe(true);
      });
    },
  );

  it(
    "applies category, system, priority, and status filters",
    async () => {
      const fetchMock = mockBaseFetch();

      render(<App />);

      await selectRequester();

      const categoryFilter =
        document.querySelector(
          "#my-ticket-category",
        ) as HTMLSelectElement;

      const systemFilter =
        document.querySelector(
          "#my-ticket-system",
        ) as HTMLSelectElement;

      const priorityFilter =
        document.querySelector(
          "#my-ticket-priority",
        ) as HTMLSelectElement;

      const statusFilter =
        document.querySelector(
          "#my-ticket-status",
        ) as HTMLSelectElement;

      expect(
        categoryFilter,
      ).toBeInTheDocument();

      expect(
        systemFilter,
      ).toBeInTheDocument();

      expect(
        priorityFilter,
      ).toBeInTheDocument();

      expect(
        statusFilter,
      ).toBeInTheDocument();

      await userEvent.selectOptions(
        categoryFilter,
        "1",
      );

      await userEvent.selectOptions(
        systemFilter,
        "1",
      );

      await userEvent.selectOptions(
        priorityFilter,
        "HIGH",
      );

      await userEvent.selectOptions(
        statusFilter,
        "NEW",
      );

      await userEvent.click(
        screen.getByRole("button", {
          name: "Apply",
        }),
      );

      await waitFor(() => {
        const urls =
          fetchMock.mock.calls.map(
            ([input]) => String(input),
          );

        expect(
          urls.some(
            (url) =>
              url.includes("categoryId=1") &&
              url.includes(
                "relatedSystemId=1",
              ) &&
              url.includes(
                "requestedPriority=HIGH",
              ) &&
              url.includes("status=NEW"),
          ),
        ).toBe(true);
      });
    },
  );

  it(
    "applies ticket sorting options",
    async () => {
      const fetchMock = mockBaseFetch();

      render(<App />);

      await selectRequester();

      await userEvent.selectOptions(
        screen.getByLabelText("Sort By"),
        "ticketNumber",
      );

      await userEvent.selectOptions(
        screen.getByLabelText("Order"),
        "asc",
      );

      await userEvent.click(
        screen.getByRole("button", {
          name: "Apply",
        }),
      );

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(
            ([input]) => {
              const url = String(input);

              return (
                url.includes(
                  "sortBy=ticketNumber",
                ) &&
                url.includes(
                  "sortOrder=asc",
                )
              );
            },
          ),
        ).toBe(true);
      });
    },
  );

  it(
    "shows an empty state when the requester has no tickets",
    async () => {
      mockBaseFetch(async () => {
        return {
          ok: true,
          json: async () =>
            ticketListResponse([]),
        } as Response;
      });

      render(<App />);

      await selectRequester();

      expect(
        await screen.findByText(
          "You have not created any tickets yet.",
        ),
      ).toBeInTheDocument();
    },
  );

  it(
    "shows a no-results state when search returns no tickets",
    async () => {
      mockBaseFetch(
        async (url) => {
          if (url.includes("search=missing")) {
            return {
              ok: true,
              json: async () =>
                ticketListResponse([]),
            } as Response;
          }

          return {
            ok: true,
            json: async () =>
              ticketListResponse(),
          } as Response;
        },
      );

      render(<App />);

      await selectRequester();

      await userEvent.type(
        screen.getByLabelText("Search"),
        "missing",
      );

      await userEvent.click(
        screen.getByRole("button", {
          name: "Apply",
        }),
      );

      expect(
        await screen.findByText(
          "No tickets match the current search or filters.",
        ),
      ).toBeInTheDocument();
    },
  );

  it(
    "shows an error and allows retry when loading tickets fails",
    async () => {
      let attempt = 0;

      mockBaseFetch(async () => {
        attempt += 1;

        if (attempt === 1) {
          return {
            ok: false,
            json: async () => ({
              error:
                "Unable to load tickets",
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () =>
            ticketListResponse(),
        } as Response;
      });

      render(<App />);

      await selectRequester();

      expect(
        await screen.findByText(
          "Unable to load tickets",
        ),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", {
          name: "Retry",
        }),
      );

      expect(
        await screen.findByText(
          "TKT-000001",
        ),
      ).toBeInTheDocument();
    },
  );

  it(
    "loads the next page when Next is clicked",
    async () => {
      const fetchMock = mockBaseFetch(
        async (url) => {
          if (url.includes("page=2")) {
            return {
              ok: true,
              json: async () =>
                ticketListResponse(
                  [
                    {
                      ...requesterOneTickets[0],
                      id: 3,
                      ticketNumber:
                        "TKT-000003",
                      summary:
                        "Second page ticket",
                    },
                  ],
                  2,
                  10,
                  11,
                  2,
                ),
            } as Response;
          }

          return {
            ok: true,
            json: async () =>
              ticketListResponse(
                requesterOneTickets,
                1,
                10,
                11,
                2,
              ),
          } as Response;
        },
      );

      render(<App />);

      await selectRequester();

      await screen.findByText(
        "TKT-000001",
      );

      await userEvent.click(
        screen.getByRole("button", {
          name: "Next",
        }),
      );

      expect(
        await screen.findByText(
          "TKT-000003",
        ),
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "Second page ticket",
        ),
      ).toBeInTheDocument();

      expect(
        fetchMock.mock.calls.some(
          ([input]) =>
            String(input).includes(
              "page=2",
            ),
        ),
      ).toBe(true);
    },
  );

  it(
    "clears requester ticket data when changing requester",
    async () => {
      mockBaseFetch();

      render(<App />);

      await selectRequester();

      expect(
        await screen.findByText(
          "TKT-000001",
        ),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", {
          name: "Change Requester",
        }),
      );

      expect(
        screen.queryByRole("heading", {
          name: "My Tickets",
        }),
      ).not.toBeInTheDocument();

      expect(
        screen.queryByText(
          "TKT-000001",
        ),
      ).not.toBeInTheDocument();

      expect(
        screen.getByLabelText(
          "Development Requester",
        ),
      ).toBeInTheDocument();
    },
  );
});