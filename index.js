const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  : null;

app.get("/", (req, res) => {
  res.json({ message: "OHMS backend is running" });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/db-test", async (req, res) => {
  if (!pool) {
    return res.status(500).json({
      ok: false,
      error: "DATABASE_URL is not set",
    });
  }

  try {
    const result = await pool.query("SELECT NOW() AS current_time");
    res.json({
      ok: true,
      database_time: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database test failed:", error);
    res.status(500).json({
      ok: false,
      error: "Database connection failed",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});