import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const schema = process.argv[2];
if (!/^lab4_issue31_e2e_[a-f0-9]{32}$/.test(schema ?? "")) {
  throw new Error("Specify the exact generated Issue #31 schema name.");
}
const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const line = readFileSync(resolve(serverDirectory, ".env"), "utf8")
  .split(/\r?\n/).find((item) => item.trimStart().startsWith("DATABASE_URL="));
if (!line) throw new Error("server/.env must contain DATABASE_URL.");
const url = new URL(line.slice(line.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2"));
if (!["postgresql:", "postgres:"].includes(url.protocol)
  || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  || url.searchParams.get("schema") !== "public") {
  throw new Error("Refusing to clean a nonlocal or nonpublic base database.");
}
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  console.log(`Removed isolated schema ${schema}.`);
} finally {
  await prisma.$disconnect();
}
