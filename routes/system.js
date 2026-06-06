const express = require("express");

function createSystemRouter(pool) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json({ message: "OHMS backend is running" });
  });

  router.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  router.get("/db-test", async (req, res) => {
    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "DATABASE_URL is not set",
      });
    }

    try {
      const result = await pool.query("SELECT NOW() AS now;");

      res.json({
        ok: true,
        now: result.rows[0].now,
      });
    } catch (error) {
      console.error("Database test failed:", error);
      res.status(500).json({
        ok: false,
        error: "Database connection failed",
      });
    }
  });

  return router;
}

module.exports = createSystemRouter;
