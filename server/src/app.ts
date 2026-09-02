import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { getPrisma } from "./prisma.js";

export const app = express();

app.use(cors());
app.use(express.json());

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
          where: {
            isRemoved: false,
          },
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
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

export default app;