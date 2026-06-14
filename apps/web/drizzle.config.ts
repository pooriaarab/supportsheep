import { defineConfig } from "drizzle-kit";

// `generate` produces SQL from the schema; migrations are applied to D1 via
// `wrangler d1 migrations apply` (see db:migrate:* scripts), so no D1 driver
// credentials are needed here.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
});
