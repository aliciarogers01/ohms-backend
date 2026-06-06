const express = require("express");

let schemaReady = false;

function bandFields(body) {
  return {
    name: body.name,
    city: body.city || null,
    state: body.state || null,
    years_active: body.years_active || null,
    picture_url: body.picture_url || null,
    notes: body.notes || null,
    members: memberEntries(body.members, body.member_ids),
  };
}

function validId(id) {
  return Number.isInteger(id) && id > 0;
}

function memberIds(ids) {
  if (!Array.isArray(ids)) {
    return [];
  }

  return [...new Set(ids.map((id) => Number(id)).filter(validId))];
}

function memberEntries(members, ids) {
  const existingIds = memberIds(ids).map((artistId) => ({
    artist_id: artistId,
    name: "",
  }));

  if (!Array.isArray(members)) {
    return existingIds;
  }

  const entries = members
    .map((member) => ({
      artist_id: Number(member.artist_id),
      name: typeof member.name === "string" ? member.name.trim() : "",
    }))
    .filter((member) => validId(member.artist_id) || member.name);

  return [...existingIds, ...entries];
}

async function ensureBandsSchema(pool) {
  if (schemaReady) {
    return;
  }

  await pool.query(`
    ALTER TABLE bands
    ADD COLUMN IF NOT EXISTS years_active TEXT,
    ADD COLUMN IF NOT EXISTS picture_url TEXT;
  `);

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
    CREATE TABLE IF NOT EXISTS band_members (
      band_id INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
      artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (band_id, artist_id)
    );
  `);

  schemaReady = true;
}

async function attachMembers(pool, bands) {
  if (!bands.length) {
    return bands;
  }

  const bandIds = bands.map((band) => band.id);
  const result = await pool.query(
    `
      SELECT
        bm.band_id,
        a.id,
        a.name,
        a.roles,
        a.city,
        a.state,
        a.picture_url
      FROM band_members bm
      JOIN artists a ON a.id = bm.artist_id
      WHERE bm.band_id = ANY($1::int[])
      ORDER BY a.name ASC;
    `,
    [bandIds],
  );

  const membersByBand = new Map();

  result.rows.forEach((member) => {
    const members = membersByBand.get(member.band_id) || [];
    members.push({
      id: member.id,
      name: member.name,
      roles: member.roles,
      city: member.city,
      state: member.state,
      picture_url: member.picture_url,
    });
    membersByBand.set(member.band_id, members);
  });

  return bands.map((band) => ({
    ...band,
    members: membersByBand.get(band.id) || [],
  }));
}

async function updateBandMembers(pool, bandId, ids) {
  await pool.query("DELETE FROM band_members WHERE band_id = $1;", [bandId]);

  if (!ids.length) {
    return;
  }

  await pool.query(
    `
      INSERT INTO band_members (band_id, artist_id)
      SELECT $1, id
      FROM artists
      WHERE id = ANY($2::int[])
      ON CONFLICT DO NOTHING;
    `,
    [bandId, ids],
  );
}

async function resolveBandMemberIds(pool, members) {
  const ids = new Set();

  for (const member of members) {
    if (validId(member.artist_id)) {
      ids.add(member.artist_id);
      continue;
    }

    if (!member.name) {
      continue;
    }

    const existing = await pool.query(
      `
        SELECT id
        FROM artists
        WHERE lower(name) = lower($1)
        ORDER BY id ASC
        LIMIT 1;
      `,
      [member.name],
    );

    if (existing.rows.length) {
      ids.add(existing.rows[0].id);
      continue;
    }

    const created = await pool.query(
      `
        INSERT INTO artists (name)
        VALUES ($1)
        RETURNING id;
      `,
      [member.name],
    );

    ids.add(created.rows[0].id);
  }

  return [...ids];
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
      await ensureBandsSchema(pool);

      const result = await pool.query(`
        SELECT id, name, city, state, years_active, picture_url, notes, created_at
        FROM bands
        ORDER BY id ASC;
      `);
      const bands = await attachMembers(pool, result.rows);

      res.json({
        ok: true,
        count: bands.length,
        bands,
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
    const { name, city, state, years_active, picture_url, notes, members } = bandFields(req.body);

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
      await ensureBandsSchema(pool);

      const result = await pool.query(
        `
          INSERT INTO bands (name, city, state, years_active, picture_url, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, name, city, state, years_active, picture_url, notes, created_at;
        `,
        [name.trim(), city, state, years_active, picture_url, notes],
      );
      const memberIdsToSave = await resolveBandMemberIds(pool, members);
      await updateBandMembers(pool, result.rows[0].id, memberIdsToSave);
      const bands = await attachMembers(pool, result.rows);

      res.status(201).json({
        ok: true,
        band: bands[0],
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
    const { name, city, state, years_active, picture_url, notes, members } = bandFields(req.body);

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
      await ensureBandsSchema(pool);

      const result = await pool.query(
        `
          UPDATE bands
          SET name = $1, city = $2, state = $3, years_active = $4, picture_url = $5, notes = $6
          WHERE id = $7
          RETURNING id, name, city, state, years_active, picture_url, notes, created_at;
        `,
        [name.trim(), city, state, years_active, picture_url, notes, bandId],
      );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          error: "Band not found",
        });
      }
      const memberIdsToSave = await resolveBandMemberIds(pool, members);
      await updateBandMembers(pool, bandId, memberIdsToSave);
      const bands = await attachMembers(pool, result.rows);

      res.json({
        ok: true,
        band: bands[0],
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
      await ensureBandsSchema(pool);

      const result = await pool.query(
        `
          DELETE FROM bands
          WHERE id = $1
          RETURNING id, name, city, state, years_active, picture_url, notes, created_at;
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
