const express = require("express");

let schemaReady = false;

function artistFields(body) {
  return {
    name: body.name,
    roles: body.roles || null,
    city: body.city || null,
    state: body.state || null,
    picture_url: body.picture_url || null,
    notes: body.notes || null,
  };
}

function validId(id) {
  return Number.isInteger(id) && id > 0;
}

async function ensureArtistsSchema(pool) {
  if (schemaReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS artists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      roles TEXT,
      city TEXT,
      state TEXT,
      picture_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE artists
    ADD COLUMN IF NOT EXISTS roles TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS picture_url TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  `);

  schemaReady = true;
}

function createArtistsRouter(pool) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "DATABASE_URL is not set",
      });
    }

    try {
      await ensureArtistsSchema(pool);

      const result = await pool.query(`
        SELECT id, name, roles, city, state, picture_url, notes, created_at
        FROM artists
        ORDER BY id ASC;
      `);

      res.json({
        ok: true,
        count: result.rows.length,
        artists: result.rows,
      });
    } catch (error) {
      console.error("List artists failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to list artists",
      });
    }
  });

  router.post("/", async (req, res) => {
    const { name, roles, city, state, picture_url, notes } = artistFields(req.body);

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Artist name is required",
      });
    }

    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "DATABASE_URL is not set",
      });
    }

    try {
      await ensureArtistsSchema(pool);

      const result = await pool.query(
        `
          INSERT INTO artists (name, roles, city, state, picture_url, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, name, roles, city, state, picture_url, notes, created_at;
        `,
        [name.trim(), roles, city, state, picture_url, notes],
      );

      res.status(201).json({
        ok: true,
        artist: result.rows[0],
      });
    } catch (error) {
      console.error("Create artist failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to create artist",
      });
    }
  });

  router.patch("/:id", async (req, res) => {
    const artistId = Number(req.params.id);
    const { name, roles, city, state, picture_url, notes } = artistFields(req.body);

    if (!validId(artistId)) {
      return res.status(400).json({
        ok: false,
        error: "Valid artist id is required",
      });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Artist name is required",
      });
    }

    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "DATABASE_URL is not set",
      });
    }

    try {
      await ensureArtistsSchema(pool);

      const result = await pool.query(
        `
          UPDATE artists
          SET name = $1, roles = $2, city = $3, state = $4, picture_url = $5, notes = $6
          WHERE id = $7
          RETURNING id, name, roles, city, state, picture_url, notes, created_at;
        `,
        [name.trim(), roles, city, state, picture_url, notes, artistId],
      );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          error: "Artist not found",
        });
      }

      res.json({
        ok: true,
        artist: result.rows[0],
      });
    } catch (error) {
      console.error("Update artist failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to update artist",
      });
    }
  });

  router.delete("/:id", async (req, res) => {
    const artistId = Number(req.params.id);

    if (!validId(artistId)) {
      return res.status(400).json({
        ok: false,
        error: "Valid artist id is required",
      });
    }

    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "DATABASE_URL is not set",
      });
    }

    try {
      await ensureArtistsSchema(pool);

      const result = await pool.query(
        `
          DELETE FROM artists
          WHERE id = $1
          RETURNING id, name, roles, city, state, picture_url, notes, created_at;
        `,
        [artistId],
      );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          error: "Artist not found",
        });
      }

      res.json({
        ok: true,
        artist: result.rows[0],
      });
    } catch (error) {
      console.error("Delete artist failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to delete artist",
      });
    }
  });

  return router;
}

module.exports = createArtistsRouter;
