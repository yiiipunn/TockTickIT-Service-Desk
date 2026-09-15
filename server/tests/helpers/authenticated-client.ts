import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";

const email = "lab3-regression-requester@example.com";
const password = "TokTickIT-Lab3!";
const origin = "http://localhost:5173";
let passwordHashPromise: Promise<string> | null = null;

export async function createAuthenticatedTestClient() {
  passwordHashPromise ??= hashPassword(password);
  const passwordHash = await passwordHashPromise;
  await getPrisma().user.upsert({
    where: { email },
    update: { isActive: true, mustChangePassword: false, passwordHash },
    create: {
      name: "Lab 3 Regression Requester",
      email,
      passwordHash,
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: false,
    },
  });

  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email, password });
  if (login.status !== 200) {
    throw new Error(`Unable to authenticate regression test client (${login.status})`);
  }
  const csrfToken = login.body.data.csrfToken as string;

  return {
    get: (path: string) => agent.get(path),
    head: (path: string) => agent.head(path),
    post: (path: string) => agent.post(path)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrfToken),
    put: (path: string) => agent.put(path)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrfToken),
    patch: (path: string) => agent.patch(path)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrfToken),
    delete: (path: string) => agent.delete(path)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrfToken),
  };
}

export type AuthenticatedTestClient = Awaited<
  ReturnType<typeof createAuthenticatedTestClient>
>;
