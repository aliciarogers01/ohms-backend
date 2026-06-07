const express = require("express");

let schemaReady = false;

function validId(id) {
  return Number.isInteger(id) && id > 0;
}

function songFields(body) {
  return {
    title: body.title,
    band_id: Number(body.band_id),
    band_name: typeof body.band_name === "string" ? body.band_name.trim() : "",
    album_id: Number(body.album_id),
    album_title: typeof body.album_title === "string" ? body.album_title.trim() : "",
    release_year: body.release_year || null,
    cover_url: body.cover_url || null,
    notes: body.notes || null,
  };
}

async function ensureSongsSchema(pool) {
  if (schemaReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bands (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      state TEXT,
      years_active TEXT,
      picture_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS albums (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      band_id INTEGER REFERENCES bands(id) ON DELETE SET NULL,
      release_year TEXT,
      cover_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS songs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      band_id INTEGER REFERENCES bands(id) ON DELETE SET NULL,
      album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
      release_year TEXT,
      cover_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  schemaReady = true;
}

async function resolveBandId(pool, bandId, bandName) {
  if (validId(bandId)) {
    return bandId;
  }

  if (!bandName) {
    return null;
  }

  const existing = await pool.query(
    `
      SELECT id
      FROM bands
      WHERE lower(name) = lower($1)
      ORDER BY id ASC
      LIMIT 1;
    `,
    [bandName],
  );

  if (existing.rows.length) {
    return existing.rows[0].id;
  }

  const created = await pool.query("INSERT INTO bands (name) VALUES ($1) RETURNING id;", [bandName]);
  return created.rows[0].id;
}

async function resolveAlbumId(pool, albumId, albumTitle, bandId, releaseYear, coverUrl) {
  if (validId(albumId)) {
    return albumId;
  }

  if (!albumTitle) {
    return null;
  }

  const existing = await pool.query(
    `
      SELECT id
      FROM albums
      WHERE lower(title) = lower($1)
      ORDER BY id ASC
      LIMIT 1;
    `,
    [albumTitle],
  );

  if (existing.rows.length) {
    return existing.rows[0].id;
  }

  const created = await pool.query(
    `
      INSERT INTO albums (title, band_id, release_year, cover_url)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `,
    [albumTitle, bandId, releaseYear, coverUrl],
  );
  return created.rows[0].id;
}

function createSongsRouter(pool) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    if (!pool) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL is not set" });
    }

    try {
      await ensureSongsSchema(pool);

      const result = await pool.query(`
        SELECT
          s.id,
          s.title,
          s.band_id,
          b.name AS band_name,
          s.album_id,
          a.title AS album_title,
          COALESCE(s.release_year, a.release_year) AS release_year,
          COALESCE(s.cover_url, a.cover_url) AS cover_url,
          s.notes,
          s.created_at
        FROM songs s
        LEFT JOIN bands b ON b.id = s.band_id
        LEFT JOIN albums a ON a.id = s.album_id
        ORDER BY s.id ASC;
      `);

      res.json({ ok: true, count: result.rows.length, songs: result.rows });
    } catch (error) {
      console.error("List songs failed:", error);
      res.status(500).json({ ok: false, error: "Failed to list songs" });
    }
  });

  router.post("/", async (req, res) => {
    const { title, band_id, band_name, album_id, album_title, release_year, cover_url, notes } = songFields(req.body);

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ ok: false, error: "Song title is required" });
    }

    if (!pool) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL is not set" });
    }

    try {
      await ensureSongsSchema(pool);
      const resolvedBandId = await resolveBandId(pool, band_id, band_name);
      const resolvedAlbumId = await resolveAlbumId(pool, album_id, album_title, resolvedBandId, release_year, cover_url);
      const result = await pool.query(
        `
          INSERT INTO songs (title, band_id, album_id, release_year, cover_url, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, title, band_id, album_id, release_year, cover_url, notes, created_at;
        `,
        [title.trim(), resolvedBandId, resolvedAlbumId, release_year, cover_url, notes],
      );

      res.status(201).json({ ok: true, song: result.rows[0] });
    } catch (error) {
      console.error("Create song failed:", error);
      res.status(500).json({ ok: false, error: "Failed to create song" });
    }
  });

  router.patch("/:id", async (req, res) => {
    const songId = Number(req.params.id);
    const { title, band_id, band_name, album_id, album_title, release_year, cover_url, notes } = songFields(req.body);

    if (!validId(songId)) {
      return res.status(400).json({ ok: false, error: "Valid song id is required" });
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ ok: false, error: "Song title is required" });
    }

    if (!pool) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL is not set" });
    }

    try {
      await ensureSongsSchema(pool);
      const resolvedBandId = await resolveBandId(pool, band_id, band_name);
      const resolvedAlbumId = await resolveAlbumId(pool, album_id, album_title, resolvedBandId, release_year, cover_url);
      const result = await pool.query(
        `
          UPDATE songs
          SET title = $1, band_id = $2, album_id = $3, release_year = $4, cover_url = $5, notes = $6
          WHERE id = $7
          RETURNING id, title, band_id, album_id, release_year, cover_url, notes, created_at;
        `,
        [title.trim(), resolvedBandId, resolvedAlbumId, release_year, cover_url, notes, songId],
      );

      if (!result.rows.length) {
        return res.status(404).json({ ok: false, error: "Song not found" });
      }

      res.json({ ok: true, song: result.rows[0] });
    } catch (error) {
      console.error("Update song failed:", error);
      res.status(500).json({ ok: false, error: "Failed to update song" });
    }
  });

  router.delete("/:id", async (req, res) => {
    const songId = Number(req.params.id);

    if (!validId(songId)) {
      return res.status(400).json({ ok: false, error: "Valid song id is required" });
    }

    if (!pool) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL is not set" });
    }

    try {
      await ensureSongsSchema(pool);
      const result = await pool.query(
        `
          DELETE FROM songs
          WHERE id = $1
          RETURNING id, title, band_id, album_id, release_year, cover_url, notes, created_at;
        `,
        [songId],
      );

      if (!result.rows.length) {
        return res.status(404).json({ ok: false, error: "Song not found" });
      }

      res.json({ ok: true, song: result.rows[0] });
    } catch (error) {
      console.error("Delete song failed:", error);
      res.status(500).json({ ok: false, error: "Failed to delete song" });
    }
  });

  return router;
}

module.exports = createSongsRouter;
