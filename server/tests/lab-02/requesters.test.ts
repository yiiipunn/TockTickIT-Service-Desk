import { beforeAll, describe, expect, it } from "vitest";
import {
  createAuthenticatedTestClient,
  type AuthenticatedTestClient,
} from "../helpers/authenticated-client.js";

let api: AuthenticatedTestClient;

describe("removed Development Requester API", () => {
  beforeAll(async () => {
    api = await createAuthenticatedTestClient();
  });

  it("does not expose the former requester selector endpoint", async () => {
    const response = await api.get("/api/requesters");

    expect(response.status).toBe(404);
    expect(Array.isArray(response.body)).toBe(false);
  });

  it("does not restore the endpoint when a requester header is supplied", async () => {
    const response = await api
      .get("/api/requesters")
      .set("X-Requester-Id", String(api.user.id));
    expect(response.status).toBe(404);
  });
});
