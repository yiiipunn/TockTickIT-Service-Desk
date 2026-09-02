import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";
import type { TicketAttachment } from "../../src/api";

const requester = { id: 1, name: "Narin S.", email: "narin@example.com" };
const category = { id: 1, name: "Hardware" };
const relatedSystem = { id: 1, name: "Printer" };
const activeAttachment: TicketAttachment = {
  id: 11,
  ticketId: 101,
  originalFilename: "printer-error.png",
  mimeType: "image/png",
  sizeBytes: 2048,
  isRemoved: false,
  removedAt: null,
  removalReason: null,
  createdAt: "2026-09-02T08:10:00.000Z",
  updatedAt: "2026-09-02T08:10:00.000Z",
};

const ticketListResponse = {
  items: [{
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
  }],
  pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function installFetchMock(options?: {
  attachments?: (typeof activeAttachment)[];
  uploadFails?: boolean;
}) {
  let attachments = options?.attachments ?? [activeAttachment];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const pathname = new URL(String(input)).pathname;

    if (pathname === "/api/requesters") return jsonResponse([requester]);
    if (pathname === "/api/categories") return jsonResponse([category]);
    if (pathname === "/api/related-systems") return jsonResponse([relatedSystem]);
    if (pathname === "/api/tickets") return jsonResponse(ticketListResponse);

    if (pathname === "/api/attachments/11/download") {
      return Promise.resolve(new Response(new Blob(["png-bytes"], {
        type: "image/png",
      }), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }));
    }

    if (pathname === "/api/tickets/101/attachments" && init?.method === "POST") {
      if (options?.uploadFails) {
        return jsonResponse({
          error: {
            code: "INTERNAL_ERROR",
            message: "Unable to upload attachment",
          },
        }, 500);
      }

      const uploaded = {
        ...activeAttachment,
        id: 12,
        originalFilename: "new-evidence.pdf",
        mimeType: "application/pdf",
      };
      attachments = [...attachments, uploaded];
      return jsonResponse({ data: uploaded }, 201);
    }

    if (pathname === "/api/attachments/11" && init?.method === "DELETE") {
      attachments = attachments.map((attachment) =>
        attachment.id === 11
          ? {
              ...attachment,
              isRemoved: true,
              removedAt: "2026-09-02T09:00:00.000Z",
              removalReason: "Uploaded the wrong file",
            }
          : attachment,
      );
      return jsonResponse({ data: attachments[0] });
    }

    if (pathname === "/api/tickets/101") {
      return jsonResponse({
        ...ticketListResponse.items[0],
        description: "The printer does not respond.",
        attachments,
      });
    }

    return jsonResponse({ error: "Unexpected request" }, 500);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openTicketDetail() {
  render(<App />);
  await screen.findByRole("option", { name: /Narin S\./i });
  fireEvent.change(screen.getByLabelText("Development Requester"), {
    target: { value: "1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
  const viewButtons = await screen.findAllByRole("button", {
    name: "View TKT-000101",
  });
  fireEvent.click(viewButtons[0]);
  await screen.findByRole("heading", { name: "Ticket Detail" });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Lab 2 - Attachment Section", () => {
  it("shows active attachment metadata and actions", async () => {
    installFetchMock();
    await openTicketDetail();

    const item = screen
      .getByText("printer-error.png")
      .closest<HTMLElement>(".list-group-item");
    expect(item).not.toBeNull();
    expect(within(item!).getByText("Active")).toBeInTheDocument();
    expect(within(item!).getByRole("button", { name: "Download" })).toBeEnabled();
    expect(within(item!).getByRole("button", { name: "Remove" })).toBeEnabled();
  });

  it("uploads a valid file using FormData and refreshes the list", async () => {
    const fetchMock = installFetchMock();
    await openTicketDetail();
    const file = new File(["%PDF-1.7"], "new-evidence.pdf", {
      type: "application/pdf",
    });

    await userEvent.upload(screen.getByLabelText("Add attachment"), file);
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("Attachment uploaded successfully.")).toBeInTheDocument();
    expect(screen.getByText("new-evidence.pdf")).toBeInTheDocument();

    const uploadCall = fetchMock.mock.calls.find(([input, init]) =>
      new URL(String(input)).pathname === "/api/tickets/101/attachments" &&
      init?.method === "POST",
    );
    expect(uploadCall).toBeDefined();
    expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData);
    expect(uploadCall?.[1]?.headers).not.toHaveProperty("Content-Type");
  });

  it("downloads an active attachment through the canonical endpoint", async () => {
    const fetchMock = installFetchMock();
    const createObjectUrl = vi.fn(() => "blob:attachment-test");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    await openTicketDetail();

    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/api/attachments/11/download",
        { headers: { "X-Requester-Id": "1" } },
      );
      expect(createObjectUrl).toHaveBeenCalled();
      expect(revokeObjectUrl).toHaveBeenCalledWith("blob:attachment-test");
    });
  });

  it("rejects invalid type and oversized files before upload", async () => {
    const fetchMock = installFetchMock();
    await openTicketDetail();
    const input = screen.getByLabelText("Add attachment");

    await userEvent.upload(
      input,
      new File(["text"], "notes.txt", { type: "text/plain" }),
      { applyAccept: false },
    );
    expect(await screen.findByText(/only JPG, JPEG, PNG, WEBP, and PDF/i)).toBeInTheDocument();

    await userEvent.upload(
      input,
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    );
    expect(await screen.findByText(/must not exceed 5 MB/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input, init]) =>
      new URL(String(input)).pathname.endsWith("/attachments") &&
      init?.method === "POST",
    )).toBe(false);
  });

  it("requires confirmation and a reason, then shows retained removed metadata", async () => {
    const fetchMock = installFetchMock();
    await openTicketDetail();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    const reason = screen.getByLabelText(/Reason for removal/i);
    expect(screen.getByText(/no longer be available for download or preview/i)).toBeInTheDocument();
    await userEvent.type(reason, "Uploaded the wrong file");
    await userEvent.click(screen.getByRole("button", { name: "Confirm removal" }));

    expect(await screen.findByText("Attachment removed successfully.")).toBeInTheDocument();
    const item = screen
      .getByText("printer-error.png")
      .closest<HTMLElement>(".list-group-item");
    expect(within(item!).getByText("Removed")).toBeInTheDocument();
    expect(within(item!).getByText(/Reason: Uploaded the wrong file/)).toBeInTheDocument();
    expect(within(item!).queryByRole("button", { name: "Download" })).not.toBeInTheDocument();

    const removeCall = fetchMock.mock.calls.find(([input, init]) =>
      new URL(String(input)).pathname === "/api/attachments/11" &&
      init?.method === "DELETE",
    );
    expect(removeCall?.[1]?.body).toBe(JSON.stringify({
      reason: "Uploaded the wrong file",
    }));
  });

  it("disables upload and explains the five-active-attachment limit", async () => {
    installFetchMock({
      attachments: Array.from({ length: 5 }, (_, index) => ({
        ...activeAttachment,
        id: index + 1,
        originalFilename: `active-${index + 1}.png`,
      })),
    });
    await openTicketDetail();

    expect(screen.getByLabelText("Add attachment")).toBeDisabled();
    expect(screen.getByText(/already has the maximum of 5 active attachments/i)).toBeInTheDocument();
  });

  it("reports an upload failure without making Ticket Detail unusable", async () => {
    installFetchMock({ uploadFails: true });
    await openTicketDetail();
    const file = new File(["%PDF-1.7"], "new-evidence.pdf", {
      type: "application/pdf",
    });

    await userEvent.upload(screen.getByLabelText("Add attachment"), file);
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("Unable to upload attachment")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
  });
});
