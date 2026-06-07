const express = require("express");

const DEFAULT_STATION_ID = "143414";

function normalizeNowPlaying(track) {
  if (!track || typeof track !== "object") {
    return null;
  }

  return {
    mediaItemId: track.MediaItemId || null,
    artist: track.Artist || "",
    title: track.Title || "",
    album: track.Album || "",
    year: track.Year || "",
    picture: track.Picture || "",
    website: track.Website || "",
    duration: track.Duration || "",
    durationInMs: track.DurationInMs || null,
    datePlayed: track.DatePlayed || "",
  };
}

function createSamRouter() {
  const router = express.Router();

  router.get("/now-playing", async (req, res) => {
    const stationId = process.env.SAM_STATION_ID || DEFAULT_STATION_ID;
    const sourceUrl = `https://samcloud.spacial.com/api/history/${stationId}/0/playing`;

    try {
      const response = await fetch(sourceUrl, {
        headers: {
          Accept: "application/json",
        },
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        return res.status(401).json({
          ok: false,
          error: "SAM Cloud requires an authenticated session for now playing.",
        });
      }

      const text = await response.text();
      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch (error) {
        return res.status(502).json({
          ok: false,
          error: "SAM Cloud returned a non-JSON now playing response.",
        });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          ok: false,
          error: "SAM Cloud now playing request failed",
        });
      }

      res.json({
        ok: true,
        stationId,
        track: normalizeNowPlaying(data),
      });
    } catch (error) {
      console.error("SAM now playing failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to load SAM Cloud now playing",
      });
    }
  });

  return router;
}

module.exports = createSamRouter;
