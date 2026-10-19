import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, initDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

// ---- Seed: the first recipe (inserted once, on an empty table) -----------
const SEED_RECIPES = [
  {
    title: "Sichuan Chili Oil × Tadka Chicken",
    ingredients: [
      "Chicken & brine",
      "• 4 boneless, skin-on chicken thighs",
      "• 4 cups cool water",
      "• 4 teaspoons salt (for the wet brine)",
      "• ~1/2 teaspoon ground coriander, for the flesh sides",
      "• Grapeseed oil — a little to start the sear, more later as needed",
      "",
      "Whole spices (Bowl 1)",
      "• 1 teaspoon coriander seeds, lightly cracked",
      "• 1/4 teaspoon whole cumin seeds",
      "",
      "Ground spices (Bowl 2)",
      "• 1/2 teaspoon ground mustard seed / mustard powder",
      "• 1/4 teaspoon turmeric",
      "",
      "Aromatics (Bowl 3)",
      "• 2 medium garlic cloves, roughly chopped small",
      "• 1 fresh green chili, sliced (some seeds possibly shaken out)",
      "• Cilantro stems, cut ~0.5–1 cm — a small pile",
      "• Scallion whites + pale greens, chopped — about the same size pile",
      "",
      "Fresh finish (Bowl 4)",
      "• Cilantro leaves, roughly chopped — a loose handful",
      "• Dark green scallion tops, sliced",
      "",
      "Finishing",
      "• Prepared Sichuan chili oil, including its chili sediment (amount not measured)",
      "• Lime juice — a modest squeeze, less than 1/4 lime",
      "• A small pinch of salt, ~1/8 teaspoon, adjusted to taste",
      "",
      "Not used: yellow onion, smoked black peppercorns, generic blended chili powders, peanut oil, soy sauce, ginger.",
    ].join("\n"),
    instructions: [
      "1. Wet brine — dissolve 4 tsp salt in 4 cups cool water. Submerge chicken and refrigerate. Intended 30–45 min; actual time wasn't reliably measured.",
      "2. Prep the four bowls above. Keep the fresh greens apart from the cooking aromatics.",
      "3. Dry and season — pat the thighs very dry. Dust flesh sides only with ~1/2 tsp ground coriander total; leave skin bare. No salt at this point.",
      "4. Sear in two batches — heat a ~9-inch stainless pan (~4 on the dial); add a thin sheen of grapeseed oil. Sear two thighs skin-side down until browned and released; raise modestly (about 5 worked better), flip to cook the flesh side. Repeat with the other two in the rendered fat. Second batch briefly hit 6 before lowering. Check thickest centers: at least 165°F / 74°C. Rest skin-side up.",
      "5. Keep the drippings — heat off briefly, retaining browned fond and rendered fat. Return to low (~2–3). Add coriander and cumin seeds, stirring until fragrant. A splash of water (~1 tbsp) loosened the golden-brown fond; a little grapeseed oil when the pan looked dry. Next run: deglaze before adding seeds may be easier.",
      "6. Bloom aromatics — add garlic, green chili, cilantro stems, scallion whites. Cook gently with a soft sizzle, keeping the garlic pale, not browned.",
      "7. Add ground spices — stir in mustard powder and turmeric over low heat until fragrant and yellow-gold. Add more grapeseed oil if it gets too dry, then turn heat off.",
      "8. Combine — slice rested chicken cross-grain into ~1/2-inch pieces, skin on. Toss into the aromatic fat off heat with resting juices. Add Sichuan chili oil gradually (initially more oil than sediment). Add cilantro leaves and scallion greens. A little more chili sediment (~1/2 tsp) noticeably improved the immediate chili flavor.",
      "9. Adjust — taste, add a modest pinch of salt, then a little lime juice for brightness. Oil-versus-sediment balance mattered more than total volume. No final high-heat cook after mixing.",
    ].join("\n"),
    notes: [
      "Cooking experiment — October 18, 2026. Amounts and timings estimated in conversation rather than measured precisely.",
      "",
      "TODO next iteration: deglaze before adding the seeds, and watch the oil-vs-sediment balance of the Sichuan chili oil.",
    ].join("\n"),
    rating: 0,
  },
];

async function seedIfEmpty() {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM recipes`);
  if (rows[0].n > 0) return;
  for (const r of SEED_RECIPES) {
    await pool.query(
      `INSERT INTO recipes (title, ingredients, instructions, notes, rating)
       VALUES ($1, $2, $3, $4, $5)`,
      [r.title, r.ingredients, r.instructions, r.notes, r.rating]
    );
  }
}

// ---- API: recipes --------------------------------------------------------
app.get("/api/recipes", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, ingredients, instructions, notes, rating, created_at, updated_at
     FROM recipes ORDER BY created_at DESC`
  );
  res.json(rows);
});

app.post("/api/recipes", async (req, res) => {
  const title = clean(req.body?.title, 200);
  const ingredients = clean(req.body?.ingredients, 50000);
  const instructions = clean(req.body?.instructions, 50000);
  const notes = clean(req.body?.notes, 50000);
  const rating = Math.max(0, Math.min(5, parseInt(req.body?.rating, 10) || 0));
  if (!title) return res.status(400).json({ error: "Recipe name is required" });
  if (!ingredients || !instructions) {
    return res.status(400).json({ error: "Ingredients and instructions are required" });
  }
  const { rows } = await pool.query(
    `INSERT INTO recipes (title, ingredients, instructions, notes, rating)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, ingredients, instructions, notes, rating, created_at, updated_at`,
    [title, ingredients, instructions, notes, rating]
  );
  res.status(201).json(rows[0]);
});

app.put("/api/recipes/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });
  const title = clean(req.body?.title, 200);
  const ingredients = clean(req.body?.ingredients, 50000);
  const instructions = clean(req.body?.instructions, 50000);
  const notes = clean(req.body?.notes, 50000);
  const rating = Math.max(0, Math.min(5, parseInt(req.body?.rating, 10) || 0));
  if (!title) return res.status(400).json({ error: "Recipe name is required" });
  const { rows } = await pool.query(
    `UPDATE recipes
     SET title = $1, ingredients = $2, instructions = $3, notes = $4, rating = $5, updated_at = now()
     WHERE id = $6
     RETURNING id, title, ingredients, instructions, notes, rating, created_at, updated_at`,
    [title, ingredients, instructions, notes, rating, id]
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