const express = require("express");

function createBandsRouter(pool) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "DATABASE_URL is not set",
      });
    }

    try {
      const result = await pool.query(`
        SELECT id, name, city, state, notes, created_at
        FROM bands
        ORDER BY id ASC;
      `);

      res.json({
        ok: true,
        count: result.rows.length,
        bands: result.rows,
      });
    } catch (error) {
      console.error("List bands failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to list bands",
      });
    }
  });

  router.post("/", async (req, res) => {
    const { name, city = null, state = null, notes = null } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Band name is required",
      });
    }

    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "DATABASE_URL is not set",
      });
    }

    try {
      const result = await pool.query(
        `
          INSERT INTO bands (name, city, state, notes)
          VALUES ($1, $2, $3, $4)
          RETURNING id, name, city, state, notes, created_at;
        `,
        [name.trim(), city, state, notes],
      );

      res.status(201).json({
        ok: true,
        band: result.rows[0],
      });
    } catch (error) {
      console.error("Create band failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to create band",
      });
    }
  });

  return router;
}

module.exports = createBandsRouter;
