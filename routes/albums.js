const express = require("express");

let schemaReady = false;

function validId(id) {
  return Number.isInteger(id) && id > 0;
}

function albumFields(body) {
  return {
    title: body.title,
    band_id: Number(body.band_id),
    band_name: typeof body.band_name === "string" ? body.band_name.trim() : "",
    release_year: body.release_year || null,
    cover_url: body.cover_url || null,
    notes: body.notes || null,
    songs: songEntries(body.songs, body.song_ids),
  };
}

function songEntries(songs, ids) {
  const existingIds = Array.isArray(ids)
    ? ids.map((id) => Number(id)).filter(validId).map((songId) => ({ song_id: songId, title: "" }))
    : [];

  if (!Array.isArray(songs)) {
    return existingIds;
  }

  const entries = songs
    .map((song) => ({
      song_id: Number(song.song_id),
      title: typeof song.title === "string" ? song.title.trim() : "",
    }))
    .filter((song) => validId(song.song_id) || song.title);

  return [...existingIds, ...entries];
}

async function ensureAlbumsSchema(pool) {
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

  const created = await pool.query(
    `
      INSERT INTO bands (name)
      VALUES ($1)
      RETURNING id;
    `,
    [bandName],
  );

  return created.rows[0].id;
}

async function attachSongs(pool, albums) {
  if (!albums.length) {
    return albums;
  }

  const albumIds = albums.map((album) => album.id);
  const result = await pool.query(
    `
      SELECT id, title, band_id, album_id, release_year, cover_url
      FROM songs
      WHERE album_id = ANY($1::int[])
      ORDER BY title ASC;
    `,
    [albumIds],
  );
  const songsByAlbum = new Map();

  result.rows.forEach((song) => {
    const songs = songsByAlbum.get(song.album_id) || [];
    songs.push(song);
    songsByAlbum.set(song.album_id, songs);
  });

  return albums.map((album) => ({
    ...album,
    songs: songsByAlbum.get(album.id) || [],
  }));
}

async function resolveSongIds(pool, album, songEntriesToResolve) {
  const ids = new Set();

  for (const song of songEntriesToResolve) {
    if (validId(song.song_id)) {
      ids.add(song.song_id);
      continue;
    }

    if (!song.title) {
      continue;
    }

    const existing = await pool.query(
      `
        SELECT id
        FROM songs
        WHERE lower(title) = lower($1)
        ORDER BY id ASC
        LIMIT 1;
      `,
      [song.title],
    );

    if (existing.rows.length) {
      ids.add(existing.rows[0].id);
      continue;
    }

    const created = await pool.query(
      `
        INSERT INTO songs (title, band_id, album_id, release_year, cover_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `,
      [song.title, album.band_id, album.id, album.release_year, album.cover_url],
    );

    ids.add(created.rows[0].id);
  }

  return [...ids];
}

async function updateAlbumSongs(pool, album, songIds) {
  await pool.query("UPDATE songs SET album_id = NULL WHERE album_id = $1;", [album.id]);

  if (!songIds.length) {
    return;
  }

  await pool.query(
    `
      UPDATE songs
      SET album_id = $1,
          band_id = COALESCE(band_id, $2),
          release_year = COALESCE(release_year, $3),
          cover_url = COALESCE(cover_url, $4)
      WHERE id = ANY($5::int[]);
    `,
    [album.id, album.band_id, album.release_year, album.cover_url, songIds],
  );
}

function createAlbumsRouter(pool) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    if (!pool) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL is not set" });
    }

    try {
      await ensureAlbumsSchema(pool);

      const result = await pool.query(`
        SELECT
          a.id,
          a.title,
          a.band_id,
          b.name AS band_name,
          a.release_year,
          a.cover_url,
          a.notes,
          a.created_at
        FROM albums a
        LEFT JOIN bands b ON b.id = a.band_id
        ORDER BY a.id ASC;
      `);
      const albums = await attachSongs(pool, result.rows);

      res.json({ ok: true, count: albums.length, albums });
    } catch (error) {
      console.error("List albums failed:", error);
      res.status(500).json({ ok: false, error: "Failed to list albums" });
    }
  });

  router.post("/", async (req, res) => {
    const { title, band_id, band_name, release_year, cover_url, notes, songs } = albumFields(req.body);

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ ok: false, error: "Album title is required" });
    }

    if (!pool) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL is not set" });
    }

    try {
      await ensureAlbumsSchema(pool);
      const resolvedBandId = await resolveBandId(pool, band_id, band_name);
      const result = await pool.query(
        `
          INSERT INTO albums (title, band_id, release_year, cover_url, notes)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, title, band_id, release_year, cover_url, notes, created_at;
        `,
        [title.trim(), resolvedBandId, release_year, cover_url, notes],
      );
      const album = result.rows[0];
      const songIds = await resolveSongIds(pool, album, songs);
      await updateAlbumSongs(pool, album, songIds);
      const albums = await attachSongs(pool, [{ ...album, band_name }]);

      res.status(201).json({ ok: true, album: albums[0] });
    } catch (error) {
      console.error("Create album failed:", error);
      res.status(500).json({ ok: false, error: "Failed to create album" });
    }
  });

  router.patch("/:id", async (req, res) => {
    const albumId = Number(req.params.id);
    const { title, band_id, band_name, release_year, cover_url, notes, songs } = albumFields(req.body);

    if (!validId(albumId)) {
      return res.status(400).json({ ok: false, error: "Valid album id is required" });
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ ok: false, error: "Album title is required" });
    }

    if (!pool) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL is not set" });
    }

    try {
      await ensureAlbumsSchema(pool);
      const resolvedBandId = await resolveBandId(pool, band_id, band_name);
      const result = await pool.query(
        `
          UPDATE albums
          SET title = $1, band_id = $2, release_year = $3, cover_url = $4, notes = $5
          WHERE id = $6
          RETURNING id, title, band_id, release_year, cover_url, notes, created_at;
        `,
        [title.trim(), resolvedBandId, release_year, cover_url, notes, albumId],
      );

      if (!result.rows.length) {
        return res.status(404).json({ ok: false, error: "Album not found" });
      }

      const album = result.rows[0];
      const songIds = await resolveSongIds(pool, album, songs);
      await updateAlbumSongs(pool, album, songIds);
      const albums = await attachSongs(pool, [{ ...album, band_name }]);

      res.json({ ok: true, album: albums[0] });
    } catch (error) {
      console.error("Update album failed:", error);
      res.status(500).json({ ok: false, error: "Failed to update album" });
    }
  });

  router.delete("/:id", async (req, res) => {
    const albumId = Number(req.params.id);

    if (!validId(albumId)) {
      return res.status(400).json({ ok: false, error: "Valid album id is required" });
    }

    if (!pool) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL is not set" });
    }

    try {
      await ensureAlbumsSchema(pool);
      const result = await pool.query(
        `
          DELETE FROM albums
          WHERE id = $1
          RETURNING id, title, band_id, release_year, cover_url, notes, created_at;
        `,
        [albumId],
      );

      if (!result.rows.length) {
        return res.status(404).json({ ok: false, error: "Album not found" });
      }

      res.json({ ok: true, album: result.rows[0] });
    } catch (error) {
      console.error("Delete album failed:", error);
      res.status(500).json({ ok: false, error: "Failed to delete album" });
    }
  });

  return router;
}

module.exports = createAlbumsRouter;
