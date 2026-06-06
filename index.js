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

app.get("/setup-bands-table", async (req, res) => {
    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "DATABASE_URL is not set",
      });
    }
  
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bands (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          city TEXT,
          state TEXT DEFAULT 'OH',
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
  
      res.json({
        ok: true,
        message: "bands table is ready",
      });
    } catch (error) {
      console.error("Setup bands table failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to create bands table",
      });
    }
  });

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});