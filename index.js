const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const pool = require("./db");
const createBandsRouter = require("./routes/bands");
const createSystemRouter = require("./routes/system");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/admin/bands", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-bands.html"));
});

app.use(createSystemRouter(pool));
app.use("/bands", createBandsRouter(pool));
app.use("/list-bands", createBandsRouter(pool));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
