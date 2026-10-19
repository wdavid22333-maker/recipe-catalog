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
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'recipes'`
  );
  const cols = rows.map((r) => r.column_name);

  if (cols.length === 0) {
    // Fresh install — new schema.
    await pool.query(`
      CREATE TABLE recipes (
        id          SERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        rating      INT  NOT NULL DEFAULT 0,
        images      JSONB NOT NULL DEFAULT '[]',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  } else if (!cols.includes("body")) {
    // Migrate from the old (title/ingredients/instructions/notes) schema.
    await pool.query(`ALTER TABLE recipes ADD COLUMN body TEXT`);
    await pool.query(`ALTER TABLE recipes ADD COLUMN images JSONB NOT NULL DEFAULT '[]'`);
    await pool.query(`
      UPDATE recipes SET body =
        title || E'\n\n## Ingredients\n\n' || ingredients ||
        E'\n\n## Instructions\n\n' || instructions ||
        CASE WHEN notes <> '' THEN E'\n\n## Notes\n\n' || notes ELSE '' END
    `);
    await pool.query(`ALTER TABLE recipes ALTER COLUMN body SET NOT NULL`);
    await pool.query(`ALTER TABLE recipes DROP COLUMN ingredients`);
    await pool.query(`ALTER TABLE recipes DROP COLUMN instructions`);
    await pool.query(`ALTER TABLE recipes DROP COLUMN notes`);
  }

  await pool.query(
    `CREATE INDEX IF NOT EXISTS recipes_created_at_idx ON recipes (created_at DESC);`
  );
}