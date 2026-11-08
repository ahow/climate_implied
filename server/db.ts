import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

function openDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set for database operations");
  return drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });
}
// Pure calculation imports must not require CI to possess database credentials.
// Actual queries still fail explicitly when configuration is missing.
let connection: ReturnType<typeof openDatabase> | undefined;
export const db = new Proxy({} as ReturnType<typeof openDatabase>, {
  get(_target, property) {
    const instance = connection ??= openDatabase();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
