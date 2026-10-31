import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientDirectory = resolve(serverDirectory, "../client");
const schema = `lab4_issue31_e2e_${randomUUID().replaceAll("-", "")}`;
const envLine = readFileSync(resolve(serverDirectory, ".env"), "utf8")
  .split(/\r?\n/)
  .find((line) => line.trimStart().startsWith("DATABASE_URL="));
if (!envLine) throw new Error("server/.env must contain DATABASE_URL.");

const baseUrl = new URL(envLine.slice(envLine.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2"));
if (!["postgresql:", "postgres:"].includes(baseUrl.protocol)
  || !["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname)
  || baseUrl.searchParams.get("schema") !== "public") {
  throw new Error("Issue #31 E2E requires a local PostgreSQL URL with schema=public; refusing an unverified database.");
}

const fixtureUrl = new URL(baseUrl);
fixtureUrl.searchParams.set("schema", schema);
const admin = new PrismaClient({ datasources: { db: { url: baseUrl.toString() } } });
const fixture = new PrismaClient({ datasources: { db: { url: fixtureUrl.toString() } } });
const environment = { ...process.env, DATABASE_URL: fixtureUrl.toString() };
let apiProcess;
let clientProcess;

function run(command, args, cwd, extraEnv = {}) {
  console.log(`> ${command} ${args.join(" ")} (${cwd})`);
  const result = spawnSync(command, args, {
    cwd,
    env: { ...environment, ...extraEnv },
    stdio: "inherit",
    shell: process.platform === "win32" && command !== "node",
    timeout: command === "node" && args.includes("test") ? 240_000 : 120_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
}

async function waitFor(url, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited before ${url} was ready.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function startServers() {
  for (const url of ["http://127.0.0.1:3100/api/health", "http://127.0.0.1:5174"]) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1000) });
      throw new Error(`Port already serves ${url}; refusing to attach to an unrelated app.`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Port already serves")) throw error;
    }
  }
  apiProcess = spawn(process.execPath, ["dist/src/index.js"], {
    cwd: serverDirectory,
    env: { ...environment, PORT: "3100", CLIENT_ORIGIN: "http://127.0.0.1:5174" },
    stdio: "inherit",
    windowsHide: true,
  });
  await waitFor("http://127.0.0.1:3100/api/health", apiProcess);
  clientProcess = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5174"], {
    cwd: clientDirectory,
    env: { ...environment, VITE_API_URL: "http://127.0.0.1:3100" },
    stdio: "inherit",
    windowsHide: true,
  });
  await waitFor("http://127.0.0.1:5174", clientProcess);
}

let created = false;
try {
  console.log(`Using isolated local PostgreSQL schema ${schema}.`);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  run("npm", ["run", "build"], serverDirectory);
  run("node", ["node_modules/prisma/build/index.js", "migrate", "deploy"], serverDirectory);
  run("node", ["dist/prisma/seed.js"], serverDirectory);
  const seedCounts = async () => ({
    users: await fixture.user.count(),
    categories: await fixture.category.count(),
    systems: await fixture.relatedSystem.count(),
    tickets: await fixture.ticket.count(),
    actions: await fixture.actionTaken.count(),
    actionEvents: await fixture.actionTakenEvent.count(),
  });
  const firstSeed = await seedCounts();
  run("node", ["dist/prisma/seed.js"], serverDirectory);
  const secondSeed = await seedCounts();
  if (JSON.stringify(firstSeed) !== JSON.stringify(secondSeed)) {
    throw new Error(`Seed changed row counts on the second pass: ${JSON.stringify({ firstSeed, secondSeed })}`);
  }
  console.log(`Seed is count-idempotent: ${JSON.stringify(secondSeed)}`);
  mkdirSync(resolve(serverDirectory, "../artifacts/lab-04/screenshots/issue-31"), { recursive: true });
  await startServers();
  const lab4Args = ["node_modules/@playwright/test/cli.js", "test", "--config=playwright.issue31.config.ts"];
  if (process.env.ISSUE31_TEST_GREP) lab4Args.push("--grep", process.env.ISSUE31_TEST_GREP);
  run("node", lab4Args, clientDirectory);
  if (!process.env.ISSUE31_TEST_GREP) {
    run("node", ["node_modules/@playwright/test/cli.js", "test", "--config=playwright.issue31.config.ts",
      "authentication.spec.ts", "requester-regression.spec.ts", "staff-ticket-flow.spec.ts",
      "user-administration.spec.ts"], clientDirectory, { ISSUE31_TEST_DIR: "./e2e/lab-03" });
    const evidenceDirectory = resolve(serverDirectory, "../artifacts/lab-04/test-results/issue-31");
    mkdirSync(evidenceDirectory, { recursive: true });
    for (const name of ["issue31-playwright-results.json", "issue31-regression-results.json"]) {
      copyFileSync(resolve(serverDirectory, `../tmp/${name}`), resolve(evidenceDirectory, name));
    }
    console.log(`Copied passing browser results to ${evidenceDirectory}.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  clientProcess?.kill();
  apiProcess?.kill();
  if (created) {
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    console.log(`Removed isolated schema ${schema}.`);
  }
  await fixture.$disconnect();
  await admin.$disconnect();
}
