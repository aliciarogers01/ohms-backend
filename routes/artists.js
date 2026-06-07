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
    bands: bandEntries(body.bands, body.band_ids),
  };
}

function validId(id) {
  return Number.isInteger(id) && id > 0;
}

function bandIds(ids) {
  if (!Array.isArray(ids)) {
    return [];
  }

  return [...new Set(ids.map((id) => Number(id)).filter(validId))];
}

function bandEntries(bands, ids) {
  const existingIds = bandIds(ids).map((bandId) => ({
    band_id: bandId,
    name: "",
  }));

  if (!Array.isArray(bands)) {
    return existingIds;
  }

  const entries = bands
    .map((band) => ({
      band_id: Number(band.band_id),
      name: typeof band.name === "string" ? band.name.trim() : "",
    }))
    .filter((band) => validId(band.band_id) || band.name);

  return [...existingIds, ...entries];
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
    ALTER TABLE bands
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS years_active TEXT,
    ADD COLUMN IF NOT EXISTS picture_url TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS band_members (
      band_id INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
      artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (band_id, artist_id)
    );
  `);

  schemaReady = true;
}

async function attachBands(pool, artists) {
  if (!artists.length) {
    return artists;
  }

  const artistIds = artists.map((artist) => artist.id);
  const result = await pool.query(
    `
      SELECT
        bm.artist_id,
        b.id,
        b.name,
        b.city,
        b.state,
        b.years_active,
        b.picture_url
      FROM band_members bm
      JOIN bands b ON b.id = bm.band_id
      WHERE bm.artist_id = ANY($1::int[])
      ORDER BY b.name ASC;
    `,
    [artistIds],
  );

  const bandsByArtist = new Map();

  result.rows.forEach((band) => {
    const bands = bandsByArtist.get(band.artist_id) || [];
    bands.push({
      id: band.id,
      name: band.name,
      city: band.city,
      state: band.state,
      years_active: band.years_active,
      picture_url: band.picture_url,
    });
    bandsByArtist.set(band.artist_id, bands);
  });

  return artists.map((artist) => ({
    ...artist,
    bands: bandsByArtist.get(artist.id) || [],
  }));
}

async function updateArtistBands(pool, artistId, ids) {
  await pool.query("DELETE FROM band_members WHERE artist_id = $1;", [artistId]);

  if (!ids.length) {
    return;
  }

  await pool.query(
    `
      INSERT INTO band_members (band_id, artist_id)
      SELECT id, $1
      FROM bands
      WHERE id = ANY($2::int[])
      ON CONFLICT DO NOTHING;
    `,
    [artistId, ids],
  );
}

async function resolveArtistBandIds(pool, bands) {
  const ids = new Set();

  for (const band of bands) {
    if (validId(band.band_id)) {
      ids.add(band.band_id);
      continue;
    }

    if (!band.name) {
      continue;
    }

    const existing = await pool.query(
      `
        SELECT id
        FROM bands
        WHERE lower(name) = lower($1)
        ORDER BY id ASC
        LIMIT 1;
      `,
      [band.name],
    );

    if (existing.rows.length) {
      ids.add(existing.rows[0].id);
      continue;
    }

    const created = await pool.query(
      `
        INSERT INTO bands (name)
        VALUES ($1)
        RETURNING id;
      `,
      [band.name],
    );

    ids.add(created.rows[0].id);
  }

  return [...ids];
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
      const artists = await attachBands(pool, result.rows);

      res.json({
        ok: true,
        count: artists.length,
        artists,
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
    const { name, roles, city, state, picture_url, notes, bands } = artistFields(req.body);

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
      const bandIdsToSave = await resolveArtistBandIds(pool, bands);
      await updateArtistBands(pool, result.rows[0].id, bandIdsToSave);
      const artists = await attachBands(pool, result.rows);

      res.status(201).json({
        ok: true,
        artist: artists[0],
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
    const { name, roles, city, state, picture_url, notes, bands } = artistFields(req.body);

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
      const bandIdsToSave = await resolveArtistBandIds(pool, bands);
      await updateArtistBands(pool, artistId, bandIdsToSave);
      const artists = await attachBands(pool, result.rows);

      res.json({
        ok: true,
        artist: artists[0],
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
