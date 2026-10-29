import { Router } from "express";
import {
  authenticationContext,
  requireRole,
  sendApiError,
} from "./auth.js";
import { getPrisma } from "./prisma.js";
import { getStaffDashboardSnapshot } from "./staff-dashboard.js";

export const dashboardsRouter = Router();

dashboardsRouter.get(
  "/dashboards/staff",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  async (req, res) => {
    res.set("Cache-Control", "no-store");

    if (Object.keys(req.query).length > 0) {
      return sendApiError(
        res,
        400,
        "INVALID_QUERY",
        "The dashboard query is invalid.",
      );
    }

    try {
      const snapshot = await getStaffDashboardSnapshot(
        getPrisma(),
        authenticationContext(res).user.id,
      );
      return res.status(200).json({ data: snapshot });
    } catch {
      return sendApiError(
        res,
        500,
        "INTERNAL_ERROR",
        "Unable to load the Staff Dashboard right now.",
      );
    }
  },
);
