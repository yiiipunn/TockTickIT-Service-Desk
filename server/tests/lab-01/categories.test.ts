import { beforeAll, describe, it, expect } from "vitest";
import {
  createAuthenticatedTestClient,
  type AuthenticatedTestClient,
} from "../helpers/authenticated-client.js";

let api: AuthenticatedTestClient;

describe("GET /api/categories", () => {
  beforeAll(async () => {
    api = await createAuthenticatedTestClient();
  });

  it("returns the four seeded categories in id order", async () => {
    const res = await api.get("/api/categories");

    expect(res.status).toBe(200);

    expect(res.body.map((category: { name: string }) => category.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);

    const ids = res.body.map((category: { id: number }) => category.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
