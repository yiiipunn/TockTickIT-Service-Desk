import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPrisma } from "./prisma.js";

export const app = express();

app.use(cors());
app.use(express.json());

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const ATTACHMENT_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const DEFAULT_ATTACHMENT_STORAGE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "storage",
  "attachments",
);

function getAttachmentStorageDir() {
  return process.env.ATTACHMENT_STORAGE_DIR?.trim() ||
    DEFAULT_ATTACHMENT_STORAGE_DIR;
}

function getAttachmentPath(storedFilename: string) {
  if (basename(storedFilename) !== storedFilename) {
    throw new Error("Invalid attachment storage identifier");
  }

  return resolve(getAttachmentStorageDir(), storedFilename);
}

function fileContentMatchesMimeType(file: Express.Multer.File) {
  const { buffer, mimetype } = file;

  if (mimetype === "image/jpeg") {
    return buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
  }

  if (mimetype === "image/png") {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
  }

  if (mimetype === "image/webp") {
    return buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  if (mimetype === "application/pdf") {
    return buffer.length >= 5 &&
      buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  return false;
}

function getDownloadDisposition(originalFilename: string) {
  const asciiFilename = originalFilename
    .replace(/[\r\n"\\]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_");
  const encodedFilename = encodeURIComponent(originalFilename)
    .replace(/['()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );

  return `attachment; filename="${asciiFilename || "attachment"}"; filename*=UTF-8''${encodedFilename}`;
}

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
      callback(
        new Error(
          "Unsupported file type. Allowed: JPG, JPEG, PNG, WEBP, PDF.",
        ),
      );
      return;
    }

    callback(null, true);
  },
});

function sendAttachmentError(
  res: Response,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) {
  return res.status(status).json({
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

function attachmentMetadata<T extends { storedFilename?: string }>(
  attachment: T,
) {
  const { storedFilename: _storedFilename, ...metadata } = attachment;
  return metadata;
}

class AttachmentLimitError extends Error {}

// ---------------------------------------------------------------------------
// API health check
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});

// ---------------------------------------------------------------------------
// Category list
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json(categories);
  } catch {
    res.status(500).json({
      error: "Unable to load request categories",
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 - Development Requester list
// Only active requesters are returned for the temporary requester selector.
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const requesters = await prisma.developmentRequester.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.status(200).json(requesters);
  } catch {
    res.status(500).json({
      error: "Unable to load development requesters",
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 - Related System list
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const relatedSystems = await prisma.relatedSystem.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json(relatedSystems);
  } catch {
    res.status(500).json({
      error: "Unable to load related systems",
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 - Create Ticket
// ---------------------------------------------------------------------------
app.post("/api/tickets", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    // Development Requester context is provided through this temporary header.
    // This is used for Lab 2 testing only and is not authentication.
    const requesterHeader = req.header("X-Requester-Id");

    if (!requesterHeader) {
      return res.status(400).json({
        error: "Development Requester is required",
      });
    }

    const requesterId = Number(requesterHeader);

    if (!Number.isInteger(requesterId) || requesterId <= 0) {
      return res.status(400).json({
        error: "Invalid Development Requester",
      });
    }

    // Only an active Development Requester can create a ticket.
    const requester = await prisma.developmentRequester.findFirst({
      where: {
        id: requesterId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!requester) {
      return res.status(400).json({
        error: "Invalid or inactive Development Requester",
      });
    }

    const {
      categoryId,
      relatedSystemId,
      summary,
      requestedPriority,
      description,
    } = req.body;

    // Validate Category.
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        error: "Category is required",
      });
    }

    // Validate Related System.
    if (!Number.isInteger(relatedSystemId) || relatedSystemId <= 0) {
      return res.status(400).json({
        error: "Related System is required",
      });
    }

    // Validate Summary.
    if (
      typeof summary !== "string" ||
      summary.trim().length < 1 ||
      summary.trim().length > 120
    ) {
      return res.status(400).json({
        error: "Summary must be between 1 and 120 characters",
      });
    }

    // Validate Requested Priority.
    const allowedPriorities = ["LOW", "MEDIUM", "HIGH"];

    if (
      typeof requestedPriority !== "string" ||
      !allowedPriorities.includes(requestedPriority)
    ) {
      return res.status(400).json({
        error: "Requested Priority must be LOW, MEDIUM, or HIGH",
      });
    }

    // Validate Description.
    if (
      typeof description !== "string" ||
      description.trim().length < 1 ||
      description.trim().length > 2000
    ) {
      return res.status(400).json({
        error: "Description must be between 1 and 2000 characters",
      });
    }

    // Verify that the selected Category exists.
    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      return res.status(400).json({
        error: "Invalid Category",
      });
    }

    // Verify that the selected Related System exists.
    const relatedSystem = await prisma.relatedSystem.findUnique({
      where: {
        id: relatedSystemId,
      },
      select: {
        id: true,
      },
    });

    if (!relatedSystem) {
      return res.status(400).json({
        error: "Invalid Related System",
      });
    }

    // Create the ticket inside a transaction.
    // A temporary unique value is used first because ticketNumber is required
    // and unique in the database. After PostgreSQL generates the ticket ID,
    // the official Ticket Number is generated from that ID.
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          ticketNumber: `TEMP-${randomUUID()}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: summary.trim(),
          requestedPriority,
          description: description.trim(),
          status: "NEW",
        },
      });

      const ticketNumber = `TKT-${String(created.id).padStart(6, "0")}`;

      return tx.ticket.update({
        where: {
          id: created.id,
        },
        data: {
          ticketNumber,
        },
        select: {
          id: true,
          ticketNumber: true,
          requesterId: true,
          categoryId: true,
          relatedSystemId: true,
          summary: true,
          requestedPriority: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return res.status(201).json(ticket);
  } catch {
    return res.status(500).json({
      error: "Unable to create ticket",
    });
  }
});
// ---------------------------------------------------------------------------
// Lab 2 - My Tickets
// Returns only tickets owned by the selected Development Requester.
// Supports search, filtering, sorting, and pagination.
// ---------------------------------------------------------------------------
app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    // -----------------------------------------------------------------------
    // Development Requester context
    // -----------------------------------------------------------------------
    const requesterHeader = req.header("X-Requester-Id");

    if (!requesterHeader) {
      return res.status(400).json({
        error: "Development Requester is required",
      });
    }

    const requesterId = Number(requesterHeader);

    if (!Number.isInteger(requesterId) || requesterId <= 0) {
      return res.status(400).json({
        error: "Invalid Development Requester",
      });
    }

    const requester = await prisma.developmentRequester.findFirst({
      where: {
        id: requesterId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!requester) {
      return res.status(400).json({
        error: "Invalid or inactive Development Requester",
      });
    }

    // -----------------------------------------------------------------------
    // Query parameters
    // -----------------------------------------------------------------------
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const categoryIdQuery = req.query.categoryId;
    const relatedSystemIdQuery = req.query.relatedSystemId;
    const requestedPriorityQuery = req.query.requestedPriority;
    const statusQuery = req.query.status;
    const sortByQuery = req.query.sortBy;
    const sortOrderQuery = req.query.sortOrder;
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;

    // -----------------------------------------------------------------------
    // Category filter
    // -----------------------------------------------------------------------
    let categoryId: number | undefined;

    if (categoryIdQuery !== undefined) {
      if (typeof categoryIdQuery !== "string") {
        return res.status(400).json({
          error: "Invalid Category filter",
        });
      }

      categoryId = Number(categoryIdQuery);

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({
          error: "Invalid Category filter",
        });
      }
    }

    // -----------------------------------------------------------------------
    // Related System filter
    // -----------------------------------------------------------------------
    let relatedSystemId: number | undefined;

    if (relatedSystemIdQuery !== undefined) {
      if (typeof relatedSystemIdQuery !== "string") {
        return res.status(400).json({
          error: "Invalid Related System filter",
        });
      }

      relatedSystemId = Number(relatedSystemIdQuery);

      if (!Number.isInteger(relatedSystemId) || relatedSystemId <= 0) {
        return res.status(400).json({
          error: "Invalid Related System filter",
        });
      }
    }

    // -----------------------------------------------------------------------
    // Requested Priority filter
    // -----------------------------------------------------------------------
    let requestedPriority: string | undefined;

    if (requestedPriorityQuery !== undefined) {
      if (typeof requestedPriorityQuery !== "string") {
        return res.status(400).json({
          error: "Invalid Requested Priority filter",
        });
      }

      const allowedPriorities = ["LOW", "MEDIUM", "HIGH"];

      if (!allowedPriorities.includes(requestedPriorityQuery)) {
        return res.status(400).json({
          error: "Invalid Requested Priority filter",
        });
      }

      requestedPriority = requestedPriorityQuery;
    }

    // -----------------------------------------------------------------------
    // Status filter
    // Lab 2 currently creates tickets with NEW status only.
    // -----------------------------------------------------------------------
    let status: string | undefined;

    if (statusQuery !== undefined) {
      if (typeof statusQuery !== "string" || statusQuery !== "NEW") {
        return res.status(400).json({
          error: "Invalid Status filter",
        });
      }

      status = statusQuery;
    }

    // -----------------------------------------------------------------------
    // Sorting
    // -----------------------------------------------------------------------
    const allowedSortFields = ["createdAt", "updatedAt", "ticketNumber"];

    let sortBy = "updatedAt";

    if (sortByQuery !== undefined) {
      if (
        typeof sortByQuery !== "string" ||
        !allowedSortFields.includes(sortByQuery)
      ) {
        return res.status(400).json({
          error: "Invalid sort field",
        });
      }

      sortBy = sortByQuery;
    }

    let sortOrder: "asc" | "desc" = "desc";

    if (sortOrderQuery !== undefined) {
      if (
        typeof sortOrderQuery !== "string" ||
        !["asc", "desc"].includes(sortOrderQuery)
      ) {
        return res.status(400).json({
          error: "Invalid sort order",
        });
      }

      sortOrder = sortOrderQuery as "asc" | "desc";
    }

    // -----------------------------------------------------------------------
    // Pagination
    // -----------------------------------------------------------------------
    let page = 1;

    if (pageQuery !== undefined) {
      if (typeof pageQuery !== "string") {
        return res.status(400).json({
          error: "Invalid page",
        });
      }

      page = Number(pageQuery);

      if (!Number.isInteger(page) || page <= 0) {
        return res.status(400).json({
          error: "Invalid page",
        });
      }
    }

    let pageSize = 10;

    if (pageSizeQuery !== undefined) {
      if (typeof pageSizeQuery !== "string") {
        return res.status(400).json({
          error: "Invalid page size",
        });
      }

      pageSize = Number(pageSizeQuery);

      if (![10, 20, 50].includes(pageSize)) {
        return res.status(400).json({
          error: "Page size must be 10, 20, or 50",
        });
      }
    }

    // -----------------------------------------------------------------------
    // Build ticket query
    // -----------------------------------------------------------------------
    const where = {
      requesterId,

      ...(categoryId !== undefined && {
        categoryId,
      }),

      ...(relatedSystemId !== undefined && {
        relatedSystemId,
      }),

      ...(requestedPriority !== undefined && {
        requestedPriority,
      }),

      ...(status !== undefined && {
        status,
      }),

      ...(search.length > 0 && {
        OR: [
          {
            ticketNumber: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          {
            summary: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        ],
      }),
    };

    const skip = (page - 1) * pageSize;

    // -----------------------------------------------------------------------
    // Load tickets and count
    // -----------------------------------------------------------------------
    const [tickets, totalItems] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          requesterId: true,
          summary: true,
          requestedPriority: true,
          status: true,
          createdAt: true,
          updatedAt: true,

          category: {
            select: {
              id: true,
              name: true,
            },
          },

          relatedSystem: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          {
            [sortBy]: sortOrder,
          },
          {
            id: "desc",
          },
        ],
        skip,
        take: pageSize,
      }),

      prisma.ticket.count({
        where,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    return res.status(200).json({
      items: tickets,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    });
  } catch {
    return res.status(500).json({
      error: "Unable to load tickets",
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 - Requester Ticket Detail
// Returns one ticket only when it belongs to the selected Development Requester.
// Missing tickets and cross-requester access both return 404.
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    // -----------------------------------------------------------------------
    // Development Requester context
    // -----------------------------------------------------------------------
    const requesterHeader = req.header("X-Requester-Id");

    if (!requesterHeader) {
      return res.status(400).json({
        error: "Development Requester is required",
      });
    }

    const requesterId = Number(requesterHeader);

    if (!Number.isInteger(requesterId) || requesterId <= 0) {
      return res.status(400).json({
        error: "Invalid Development Requester",
      });
    }

    const requester = await prisma.developmentRequester.findFirst({
      where: {
        id: requesterId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!requester) {
      return res.status(400).json({
        error: "Invalid or inactive Development Requester",
      });
    }

    // -----------------------------------------------------------------------
    // Ticket ID
    // -----------------------------------------------------------------------
    const ticketId = Number(req.params.id);

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    // -----------------------------------------------------------------------
    // Load owned ticket
    // Ownership is enforced directly in the query.
    // -----------------------------------------------------------------------
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        requesterId,
      },
      select: {
        id: true,
        ticketNumber: true,
        requesterId: true,
        summary: true,
        requestedPriority: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,

        category: {
          select: {
            id: true,
            name: true,
          },
        },

        relatedSystem: {
          select: {
            id: true,
            name: true,
          },
        },

        attachments: {
          select: {
            id: true,
            ticketId: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            isRemoved: true,
            removedAt: true,
            removalReason: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    return res.status(200).json(ticket);
  } catch {
    return res.status(500).json({
      error: "Unable to load ticket",
    });
  }
});


// ---------------------------------------------------------------------------
// Lab 2 - Attachment Management
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets/:id/attachments",
  async (req: Request, res: Response) => {
    try {
      await new Promise<void>((resolve, reject) => {
        attachmentUpload.single("file")(req, res, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      const prisma = getPrisma();

      const requesterHeader = req.header("X-Requester-Id");

      if (!requesterHeader) {
        return sendAttachmentError(
          res,
          400,
          "REQUESTER_REQUIRED",
          "Development Requester is required.",
        );
      }

      const requesterId = Number(requesterHeader);

      if (!Number.isInteger(requesterId) || requesterId <= 0) {
        return sendAttachmentError(
          res,
          400,
          "INVALID_REQUESTER",
          "Invalid Development Requester.",
        );
      }

      const requester = await prisma.developmentRequester.findFirst({
        where: {
          id: requesterId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!requester) {
        return sendAttachmentError(
          res,
          400,
          "INVALID_REQUESTER",
          "Invalid or inactive Development Requester.",
        );
      }

      const ticketId = Number(req.params.id);

      if (!Number.isInteger(ticketId) || ticketId <= 0) {
        return sendAttachmentError(
          res,
          404,
          "TICKET_NOT_FOUND",
          "Ticket not found.",
        );
      }

      const ticket = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
          requesterId,
        },
        select: {
          id: true,
        },
      });

      if (!ticket) {
        return sendAttachmentError(
          res,
          404,
          "TICKET_NOT_FOUND",
          "Ticket not found.",
        );
      }

      if (!req.file) {
        return sendAttachmentError(
          res,
          400,
          "VALIDATION_ERROR",
          "An attachment file is required.",
          { file: "Attachment file is required." },
        );
      }

      if (!fileContentMatchesMimeType(req.file)) {
        return sendAttachmentError(
          res,
          415,
          "UNSUPPORTED_ATTACHMENT_TYPE",
          "Attachment content does not match an allowed file type.",
        );
      }

      const storedFilename = `${randomUUID()}${ATTACHMENT_EXTENSIONS[req.file.mimetype]}`;
      const storedPath = getAttachmentPath(storedFilename);

      await fs.mkdir(getAttachmentStorageDir(), { recursive: true });
      await fs.writeFile(storedPath, req.file.buffer, { flag: "wx" });

      let attachment;

      try {
        attachment = await prisma.$transaction(async (transaction) => {
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(${ticketId})
          `;

          const activeAttachmentCount = await transaction.attachment.count({
            where: {
              ticketId,
              isRemoved: false,
            },
          });

          if (activeAttachmentCount >= 5) {
            throw new AttachmentLimitError();
          }

          return transaction.attachment.create({
            data: {
              ticketId,
              originalFilename: req.file!.originalname,
              storedFilename,
              mimeType: req.file!.mimetype,
              sizeBytes: req.file!.size,
              isRemoved: false,
            },
          });
        });
      } catch (error) {
        await fs.rm(storedPath, { force: true });
        throw error;
      }

      return res.status(201).json({ data: attachmentMetadata(attachment) });
    } catch (error) {
      if (error instanceof AttachmentLimitError) {
        return sendAttachmentError(
          res,
          409,
          "ATTACHMENT_LIMIT_REACHED",
          "This ticket already has the maximum of 5 active attachments.",
        );
      }

      if (
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
      ) {
        return sendAttachmentError(
          res,
          413,
          "ATTACHMENT_TOO_LARGE",
          "The attachment must not exceed 5 MB.",
        );
      }

      if (
        error instanceof Error &&
        error.message.startsWith("Unsupported file type")
      ) {
        return sendAttachmentError(
          res,
          415,
          "UNSUPPORTED_ATTACHMENT_TYPE",
          "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.",
        );
      }

      return sendAttachmentError(
        res,
        500,
        "INTERNAL_ERROR",
        "Unable to upload attachment.",
      );
    }
  },
);

app.get("/api/attachments/:id", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterHeader = req.header("X-Requester-Id");

    if (!requesterHeader) {
      return sendAttachmentError(
        res,
        400,
        "REQUESTER_REQUIRED",
        "Development Requester is required.",
      );
    }

    const requesterId = Number(requesterHeader);

    if (!Number.isInteger(requesterId) || requesterId <= 0) {
      return sendAttachmentError(
        res,
        400,
        "INVALID_REQUESTER",
        "Invalid Development Requester.",
      );
    }

    const requester = await prisma.developmentRequester.findFirst({
      where: { id: requesterId, isActive: true },
      select: { id: true },
    });

    if (!requester) {
      return sendAttachmentError(
        res,
        400,
        "INVALID_REQUESTER",
        "Invalid or inactive Development Requester.",
      );
    }

    const attachmentId = Number(req.params.id);

    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return sendAttachmentError(
        res,
        404,
        "ATTACHMENT_NOT_FOUND",
        "Attachment not found.",
      );
    }

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        ticket: { requesterId },
      },
      select: {
        id: true,
        ticketId: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        isRemoved: true,
        removedAt: true,
        removalReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!attachment) {
      return sendAttachmentError(
        res,
        404,
        "ATTACHMENT_NOT_FOUND",
        "Attachment not found.",
      );
    }

    return res.status(200).json({ data: attachment });
  } catch {
    return sendAttachmentError(
      res,
      500,
      "INTERNAL_ERROR",
      "Unable to load attachment.",
    );
  }
});

app.get(
  "/api/attachments/:id/download",
  async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterHeader = req.header("X-Requester-Id");

      if (!requesterHeader) {
        return sendAttachmentError(
          res,
          400,
          "REQUESTER_REQUIRED",
          "Development Requester is required.",
        );
      }

      const requesterId = Number(requesterHeader);

      if (!Number.isInteger(requesterId) || requesterId <= 0) {
        return sendAttachmentError(
          res,
          400,
          "INVALID_REQUESTER",
          "Invalid Development Requester.",
        );
      }

      const requester = await prisma.developmentRequester.findFirst({
        where: { id: requesterId, isActive: true },
        select: { id: true },
      });

      if (!requester) {
        return sendAttachmentError(
          res,
          400,
          "INVALID_REQUESTER",
          "Invalid or inactive Development Requester.",
        );
      }

      const attachmentId = Number(req.params.id);

      if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
        return sendAttachmentError(
          res,
          404,
          "ATTACHMENT_NOT_FOUND",
          "Attachment not found.",
        );
      }

      const attachment = await prisma.attachment.findFirst({
        where: {
          id: attachmentId,
          isRemoved: false,
          ticket: { requesterId },
        },
        select: {
          originalFilename: true,
          storedFilename: true,
          mimeType: true,
          sizeBytes: true,
        },
      });

      if (!attachment) {
        return sendAttachmentError(
          res,
          404,
          "ATTACHMENT_NOT_FOUND",
          "Attachment not found.",
        );
      }

      let file: Buffer;

      try {
        file = await fs.readFile(getAttachmentPath(attachment.storedFilename));
      } catch {
        return sendAttachmentError(
          res,
          404,
          "ATTACHMENT_NOT_FOUND",
          "Attachment not found.",
        );
      }

      res.set({
        "Content-Type": attachment.mimeType,
        "Content-Length": String(file.length),
        "Content-Disposition": getDownloadDisposition(
          attachment.originalFilename,
        ),
      });

      return res.status(200).send(file);
    } catch {
      return sendAttachmentError(
        res,
        500,
        "INTERNAL_ERROR",
        "Unable to download attachment.",
      );
    }
  },
);

app.delete("/api/attachments/:id", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterHeader = req.header("X-Requester-Id");

    if (!requesterHeader) {
      return sendAttachmentError(
        res,
        400,
        "REQUESTER_REQUIRED",
        "Development Requester is required.",
      );
    }

    const requesterId = Number(requesterHeader);

    if (!Number.isInteger(requesterId) || requesterId <= 0) {
      return sendAttachmentError(
        res,
        400,
        "INVALID_REQUESTER",
        "Invalid Development Requester.",
      );
    }

    const requester = await prisma.developmentRequester.findFirst({
      where: { id: requesterId, isActive: true },
      select: { id: true },
    });

    if (!requester) {
      return sendAttachmentError(
        res,
        400,
        "INVALID_REQUESTER",
        "Invalid or inactive Development Requester.",
      );
    }

    const attachmentId = Number(req.params.id);

    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return sendAttachmentError(
        res,
        404,
        "ATTACHMENT_NOT_FOUND",
        "Attachment not found.",
      );
    }

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        ticket: { requesterId },
      },
      select: { id: true, isRemoved: true },
    });

    if (!attachment) {
      return sendAttachmentError(
        res,
        404,
        "ATTACHMENT_NOT_FOUND",
        "Attachment not found.",
      );
    }

    if (attachment.isRemoved) {
      return sendAttachmentError(
        res,
        409,
        "ATTACHMENT_ALREADY_REMOVED",
        "This attachment has already been removed.",
      );
    }

    const reason = typeof req.body?.reason === "string"
      ? req.body.reason.trim()
      : "";

    if (reason.length < 1 || reason.length > 250) {
      return sendAttachmentError(
        res,
        400,
        "VALIDATION_ERROR",
        "A valid removal reason is required.",
        { reason: "Removal reason must contain 1 to 250 characters." },
      );
    }

    const removedAt = new Date();
    const result = await prisma.attachment.updateMany({
      where: { id: attachmentId, isRemoved: false },
      data: { isRemoved: true, removedAt, removalReason: reason },
    });

    if (result.count === 0) {
      return sendAttachmentError(
        res,
        409,
        "ATTACHMENT_ALREADY_REMOVED",
        "This attachment has already been removed.",
      );
    }

    const removedAttachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    return res.status(200).json({
      data: attachmentMetadata(removedAttachment!),
    });
  } catch {
    return sendAttachmentError(
      res,
      500,
      "INTERNAL_ERROR",
      "Unable to remove attachment.",
    );
  }
});

export default app;
