import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration files share one PostgreSQL database and create transactional fixtures.
    fileParallelism: false,
  },
});
