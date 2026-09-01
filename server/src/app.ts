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

export default app;