const express = require("express");

function bandFields(body) {
  return {
    name: body.name,
    city: body.city || null,
    state: body.state || null,
    notes: body.notes || null,
  };
}

function validId(id) {
  return Number.isInteger(id) && id > 0;
}

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
    const { name, city, state, notes } = bandFields(req.body);

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

  router.patch("/:id", async (req, res) => {
    const bandId = Number(req.params.id);
    const { name, city, state, notes } = bandFields(req.body);

    if (!validId(bandId)) {
      return res.status(400).json({
        ok: false,
        error: "Valid band id is required",
      });
    }

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
          UPDATE bands
          SET name = $1, city = $2, state = $3, notes = $4
          WHERE id = $5
          RETURNING id, name, city, state, notes, created_at;
        `,
        [name.trim(), city, state, notes, bandId],
      );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          error: "Band not found",
        });
      }

      res.json({
        ok: true,
        band: result.rows[0],
      });
    } catch (error) {
      console.error("Update band failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to update band",
      });
    }
  });

  router.delete("/:id", async (req, res) => {
    const bandId = Number(req.params.id);

    if (!validId(bandId)) {
      return res.status(400).json({
        ok: false,
        error: "Valid band id is required",
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
          DELETE FROM bands
          WHERE id = $1
          RETURNING id, name, city, state, notes, created_at;
        `,
        [bandId],
      );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          error: "Band not found",
        });
      }

      res.json({
        ok: true,
        band: result.rows[0],
      });
    } catch (error) {
      console.error("Delete band failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to delete band",
      });
    }
  });

  return router;
}

module.exports = createBandsRouter;
