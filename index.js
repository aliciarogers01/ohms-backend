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

app.get("/add-test-band", async (req, res) => {
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
        RETURNING *;
        `,
        ["Devo", "Akron", "OH", "Test band added from backend route"]
      );
  
      res.json({
        ok: true,
        band: result.rows[0],
      });
    } catch (error) {
      console.error("Add test band failed:", error);
      res.status(500).json({
        ok: false,
        error: "Failed to add test band",
      });
    }
  });

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});