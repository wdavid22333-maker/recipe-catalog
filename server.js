import express from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { pool, initDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

// ---- Seed: first recipe, inserted once on an empty table -----------------
const SEED_RECIPES = [
  {
    title: "Sichuan Chili Oil × Tadka Chicken",
    body: `Cooking experiment — October 18, 2026. Four boneless, skin-on chicken thighs. Some amounts and timings were estimated in conversation rather than measured precisely.

## Ingredients

### Chicken & brine
- 4 boneless, skin-on chicken thighs
- 4 cups cool water
- 4 tsp salt (for the wet brine)
- ~1/2 tsp ground coriander, for the flesh sides
- Grapeseed oil — a little to start the sear, more later as needed

### Whole spices (Bowl 1)
- 1 tsp coriander seeds, lightly cracked
- 1/4 tsp whole cumin seeds

### Ground spices (Bowl 2)
- 1/2 tsp ground mustard seed / mustard powder
- 1/4 tsp turmeric

### Aromatics (Bowl 3)
- 2 medium garlic cloves, roughly chopped small
- 1 fresh green chili, sliced (some seeds possibly shaken out)
- Cilantro stems, cut ~0.5–1 cm — a small pile
- Scallion whites + pale greens, chopped — about the same size pile

### Fresh finish (Bowl 4)
- Cilantro leaves, roughly chopped — a loose handful
- Dark green scallion tops, sliced

### Finishing
- Prepared Sichuan chili oil, including its chili sediment (amount not measured)
- Lime juice — a modest squeeze, less than 1/4 lime
- A small pinch of salt, ~1/8 tsp, adjusted to taste

> Not used: yellow onion, smoked black peppercorns, generic blended chili powders, peanut oil, soy sauce, ginger.

## Method

1. **Wet brine** — dissolve 4 tsp salt in 4 cups cool water. Submerge chicken, refrigerate. Intended 30–45 min; actual time not reliably measured.
2. **Prep the four bowls** above. Keep the fresh greens apart from the cooking aromatics.
3. **Dry & season** — pat the thighs very dry. Dust the flesh sides only with ~1/2 tsp ground coriander total; leave skin bare. No salt yet.
4. **Sear in two batches** — heat a ~9-inch stainless pan (~4 on the dial); thin sheen of grapeseed oil. Sear two thighs skin-side down until browned and released; raise modestly (~5 worked better), flip to cook the flesh side. Repeat with the other two in the rendered fat (the second batch briefly hit 6). Check the thickest centers reach 165°F / 74°C. Rest skin-side up.
5. **Keep the drippings** — heat off briefly, retaining the browned fond and rendered fat. Return to low (~2–3). Add coriander and cumin seeds until fragrant. A splash of water (~1 tbsp) loosened the golden-brown fond; a little grapeseed oil when the pan looked dry. *Next run: deglazing before adding the seeds may be easier.*
6. **Bloom aromatics** — garlic, green chili, cilantro stems, scallion whites. Gentle sizzle, keeping the garlic pale rather than browned.
7. **Add ground spices** — mustard powder + turmeric over low until fragrant and yellow-gold. More oil if too dry, then turn the heat off.
8. **Combine** — slice rested chicken cross-grain into ~1/2-inch pieces, skin on. Toss into the aromatic fat off heat with the resting juices. Add chili oil gradually (initially more oil than sediment), then cilantro leaves + scallion greens. A little more chili sediment (~1/2 tsp) noticeably improved the immediate chili flavor.
9. **Adjust** — a pinch of salt, then a little lime juice for brightness. Oil-versus-sediment balance mattered more than total volume. No final high-heat cook after mixing.

## Notes / Next attempt

- 🍳 Attempt 1 — 2026-10-18
- TODO: deglaze before adding the seeds
- TODO: watch the oil-vs-sediment balance of the Sichuan chili oil`,
    rating: 0,
  },
];

async function seedIfEmpty() {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM recipes`);
  if (rows[0].n > 0) return;
  for (const r of SEED_RECIPES) {
    await pool.query(
      `INSERT INTO recipes (title, body, rating) VALUES ($1, $2, $3)`,
      [r.title, r.body, r.rating]
    );
  }
}

// ---- Image upload (multer -> /data/uploads) ------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8);
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
  },
});

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ALLOWED.has(ext));
  },
});

app.use("/uploads", express.static(UPLOAD_DIR));

app.post("/api/uploads", upload.array("images", 6), (req, res) => {
  const paths = (req.files || []).map((f) => `/uploads/${f.filename}`);
  res.json({ images: paths });
});

// ---- API: recipes --------------------------------------------------------
app.get("/api/recipes", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, body, rating, images, created_at, updated_at
     FROM recipes ORDER BY created_at DESC`
  );
  res.json(rows);
});

app.get("/api/recipes/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });
  const { rows } = await pool.query(
    `SELECT id, title, body, rating, images, created_at, updated_at
     FROM recipes WHERE id = $1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

app.post("/api/recipes", async (req, res) => {
  const title = clean(req.body?.title, 200);
  const body = clean(req.body?.body, 200000);
  const rating = Math.max(0, Math.min(5, parseInt(req.body?.rating, 10) || 0));
  const images = Array.isArray(req.body?.images)
    ? req.body.images.map((p) => clean(p, 300)).filter(Boolean).slice(0, 20)
    : [];
  if (!title) return res.status(400).json({ error: "Recipe name is required" });
  if (!body) return res.status(400).json({ error: "Recipe body is required" });
  const { rows } = await pool.query(
    `INSERT INTO recipes (title, body, rating, images)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, title, body, rating, images, created_at, updated_at`,
    [title, body, rating, JSON.stringify(images)]
  );
  res.status(201).json(rows[0]);
});

app.put("/api/recipes/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });
  const title = clean(req.body?.title, 200);
  const body = clean(req.body?.body, 200000);
  const rating = Math.max(0, Math.min(5, parseInt(req.body?.rating, 10) || 0));
  const images = Array.isArray(req.body?.images)
    ? req.body.images.map((p) => clean(p, 300)).filter(Boolean).slice(0, 20)
    : [];
  if (!title) return res.status(400).json({ error: "Recipe name is required" });
  if (!body) return res.status(400).json({ error: "Recipe body is required" });
  const { rows } = await pool.query(
    `UPDATE recipes
     SET title = $1, body = $2, rating = $3, images = $4::jsonb, updated_at = now()
     WHERE id = $5
     RETURNING id, title, body, rating, images, created_at, updated_at`,
    [title, body, rating, JSON.stringify(images), id]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

app.delete("/api/recipes/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });
  const { rowCount } = await pool.query(`DELETE FROM recipes WHERE id = $1`, [id]);
  if (!rowCount) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

// ---- Static frontend + SPA fallback -------------------------------------
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---- Boot ----------------------------------------------------------------
initDb()
  .then(seedIfEmpty)
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Recipe Catalog listening on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });