import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;

export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        // Railway internal networking doesn't need SSL; public proxy does.
        ssl: connectionString.includes("proxy.rlwy.net")
          ? { rejectUnauthorized: false }
          : false,
      }
    : {}
);

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipes (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      instructions TEXT NOT NULL,
      notes       TEXT NOT NULL DEFAULT '',
      rating      INT  NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS recipes_created_at_idx ON recipes (created_at DESC);`
  );
}