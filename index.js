const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const pool = require("./db");
const createAlbumsRouter = require("./routes/albums");
const createArtistsRouter = require("./routes/artists");
const createBandsRouter = require("./routes/bands");
const createCloudinaryRouter = require("./routes/cloudinary");
const createSongsRouter = require("./routes/songs");
const createSystemRouter = require("./routes/system");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/admin/bands", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-bands.html"));
});

app.get("/admin/artists", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-artists.html"));
});

app.get("/admin/albums", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-albums.html"));
});

app.get("/admin/songs", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-songs.html"));
});

app.use(createSystemRouter(pool));
app.use("/albums", createAlbumsRouter(pool));
app.use("/artists", createArtistsRouter(pool));
app.use("/bands", createBandsRouter(pool));
app.use("/cloudinary", createCloudinaryRouter());
app.use("/songs", createSongsRouter(pool));
app.use("/list-bands", createBandsRouter(pool));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
