import { defineConfig } from "drizzle-kit";

// Migrations próprias do plugin, separadas do drizzle.config.ts do core (mesmo padrão de
// academy/birthdays): tabela de tracking própria pra core e plugin não competirem pelo mesmo
// cursor de "última migration aplicada".
export default defineConfig({
  schema: ["./database/schema/index.ts"],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  migrations: { schema: "novels_migrations", table: "__drizzle_migrations" },
});
