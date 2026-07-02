import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// Ensure env variables are loaded (Bun loads .env automatically, but let's double check)
const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Error: TURSO_DATABASE_URL is not set in environment.");
  process.exit(1);
}

console.log(`Connecting to Turso database: ${url}`);

const client = createClient({
  url,
  authToken: token,
});

const shouldReset = process.argv.includes("--reset");

if (shouldReset) {
  console.log("Resetting database (dropping all tables)...");
  try {
    await client.execute("PRAGMA foreign_keys = OFF;");
    const tablesRes = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    );
    for (const row of tablesRes.rows) {
      const tableName = row.name as string;
      console.log(`Dropping table: ${tableName}`);
      await client.execute(`DROP TABLE IF EXISTS "${tableName}";`);
    }
    console.log("Database reset complete.");
  } catch (err) {
    console.error("Error resetting database:", err);
    process.exit(1);
  }
}

try {
  const fromSource = (shouldReset || !fs.existsSync(path.join(process.cwd(), "db", "custom.db")))
    ? "--from-empty"
    : "--from-schema-datasource prisma/schema.prisma";
  const cmd = `bunx prisma migrate diff ${fromSource} --to-schema-datamodel prisma/schema.prisma --script`;
  console.log(`Executing migration diff: ${cmd}`);
  const sql = execSync(cmd, {
    encoding: "utf-8",
  });

  console.log("Applying schema to Turso DB...");
  await client.executeMultiple(sql);
  console.log("Schema applied successfully to Turso DB!");
} catch (error) {
  console.error("Error applying schema:", error);
  process.exit(1);
} finally {
  client.close();
}
