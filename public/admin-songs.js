const songsList = document.querySelector("#songsList");
const songCount = document.querySelector("#songCount");
const songForm = document.querySelector("#songForm");
const refreshButton = document.querySelector("#refreshButton");
const submitButton = document.querySelector("#submitButton");
const editRecordButton = document.querySelector("#editRecordButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const deleteRecordButton = document.querySelector("#deleteRecordButton");
const statusMessage = document.querySelector("#statusMessage");
const bandsOptions = document.querySelector("#bandsOptions");
const albumsOptions = document.querySelector("#albumsOptions");

let editingSongId = null;
let selectedSong = null;
let bands = [];
let albums = [];

function findBandByName(name) {
  const normalizedName = name.trim().toLowerCase();
  return bands.find((band) => (band.name || "").trim().toLowerCase() === normalizedName);
}

function findAlbumByTitle(title) {
  const normalizedTitle = title.trim().toLowerCase();
  return albums.find((album) => (album.title || "").trim().toLowerCase() === normalizedTitle);
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function setSongFormControlsEnabled(enabled) {
  songForm.querySelectorAll("input, select, textarea").forEach((control) => {
    control.disabled = !enabled;
  });
}

function setSongFormMode(mode) {
  const selectedMode = mode === "view" || mode === "edit";
  const enabled = mode === "add" || mode === "edit";

  setSongFormControlsEnabled(enabled);
  editRecordButton.classList.toggle("hidden", !selectedMode);
  cancelEditButton.classList.toggle("hidden", !selectedMode);
  deleteRecordButton.classList.toggle("hidden", !selectedMode);
  submitButton.textContent = mode === "add" ? "Add Song" : "Save Song";
  submitButton.disabled = mode === "view";
  editRecordButton.disabled = mode === "edit";
}

function songPayload(form) {
  const formData = new FormData(form);
  const bandName = formData.get("band_name").trim();
  const albumTitle = formData.get("album_title").trim();
  const band = findBandByName(bandName);
  const album = findAlbumByTitle(albumTitle);

  return {
    title: formData.get("title").trim(),
    band_id: band ? band.id : null,
    band_name: band ? "" : bandName,
    album_id: album ? album.id : null,
    album_title: album ? "" : albumTitle,
    release_year: formData.get("release_year").trim(),
    cover_url: formData.get("cover_url").trim(),
    notes: formData.get("notes").trim(),
  };
}

async function loadBands() {
  try {
    const response = await fetch("/bands");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load bands");
    }

    bands = data.bands;
    renderBandOptions();
  } catch (error) {
    bands = [];
    renderBandOptions();
  }
}

async function loadAlbums() {
  try {
    const response = await fetch("/albums");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load albums");
    }

    albums = data.albums;
    renderAlbumOptions();
  } catch (error) {
    albums = [];
    renderAlbumOptions();
  }
}

function renderBandOptions() {
  bandsOptions.innerHTML = "";
  [...bands]
    .sort((first, second) => (first.name || "").localeCompare(second.name || "", undefined, { sensitivity: "base" }))
    .forEach((band) => {
      const option = document.createElement("option");
      option.value = band.name;
      bandsOptions.appendChild(option);
    });
}

function renderAlbumOptions() {
  albumsOptions.innerHTML = "";
  [...albums]
    .sort((first, second) => (first.title || "").localeCompare(second.title || "", undefined, { sensitivity: "base" }))
    .forEach((album) => {
      const option = document.createElement("option");
      option.value = album.title;
      option.label = album.band_name ? `${album.title} - ${album.band_name}` : album.title;
      albumsOptions.appendChild(option);
    });
}

async function uploadPhoto(file) {
  const signatureResponse = await fetch("/cloudinary/signature?folder=songs");
  const signatureData = await signatureResponse.json();

  if (!signatureResponse.ok || !signatureData.ok) {
    throw new Error(signatureData.error || "Cloudinary upload is not configured");
  }

  const uploadData = new FormData();
  uploadData.append("file", file);
  uploadData.append("api_key", signatureData.apiKey);
  uploadData.append("timestamp", signatureData.timestamp);
  uploadData.append("signature", signatureData.signature);
  uploadData.append("folder", signatureData.folder);

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`, {
    method: "POST",
    body: uploadData,
  });
  const uploadResult = await uploadResponse.json();

  if (!uploadResponse.ok || !uploadResult.secure_url) {
    throw new Error(uploadResult.error?.message || "Cover upload failed");
  }

  return uploadResult.secure_url;
}

function setPhotoPreview(preview, url) {
  preview.innerHTML = "";

  if (!url) {
    preview.textContent = "No cover selected";
    return;
  }

  const image = document.createElement("img");
  image.src = url;
  image.alt = "Selected song cover";
  preview.appendChild(image);
}

function setMainPhotoPreview(url) {
  setPhotoPreview(songForm.querySelector("[data-photo-preview]"), url);
}

function connectPhotoUpload(form) {
  const fileInput = form.querySelector("[name='cover_file']");
  const urlInput = form.querySelector("[name='cover_url']");
  const preview = form.querySelector("[data-photo-preview]");

  setPhotoPreview(preview, urlInput.value);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];

    if (!file) {
      return;
    }

    setStatus("Uploading cover...");
    fileInput.disabled = true;

    try {
      const photoUrl = await uploadPhoto(file);
      urlInput.value = photoUrl;
      setPhotoPreview(preview, photoUrl);
      setStatus("Cover uploaded.", "success");
    } catch (error) {
      fileInput.value = "";
      setStatus(error.message, "error");
    } finally {
      fileInput.disabled = false;
    }
  });
}

function createDisplayCard(song) {
  const item = document.createElement("article");
  item.className = "band-item";
  item.tabIndex = 0;
  item.addEventListener("click", () => populateSongForm(song));
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      populateSongForm(song);
    }
  });

  const picture = document.createElement("div");
  picture.className = "band-picture";

  if (song.cover_url) {
    const image = document.createElement("img");
    image.src = song.cover_url;
    image.alt = song.title;
    image.loading = "lazy";
    picture.appendChild(image);
  } else {
    picture.textContent = "No cover";
  }

  const content = document.createElement("div");
  content.className = "band-card-content";

  const title = document.createElement("div");
  title.className = "band-name";
  title.textContent = song.title;

  const bandName = document.createElement("div");
  bandName.className = "band-meta";
  bandName.textContent = song.band_name || "Band not set";

  const albumTitle = document.createElement("div");
  albumTitle.className = "band-meta";
  albumTitle.textContent = song.album_title || "Album not set";

  const year = document.createElement("div");
  year.className = "band-years";
  year.textContent = song.release_year || "Year not set";

  content.append(title, bandName, albumTitle, year);

  const cardMain = document.createElement("div");
  cardMain.className = "band-card-main";
  cardMain.append(picture, content);
  item.append(cardMain);

  return item;
}

function renderSongs(songs) {
  const sortedSongs = [...songs].sort((first, second) =>
    (first.title || "").localeCompare(second.title || "", undefined, { sensitivity: "base" }),
  );

  songCount.textContent = sortedSongs.length;
  songsList.innerHTML = "";

  if (!sortedSongs.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No songs yet.";
    songsList.appendChild(empty);
    return;
  }

  sortedSongs.forEach((song) => {
    songsList.appendChild(createDisplayCard(song));
  });
}

async function loadSongs() {
  setStatus("Loading songs...");

  try {
    const response = await fetch("/songs");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load songs");
    }

    renderSongs(data.songs);
    setStatus("Songs loaded.", "success");
  } catch (error) {
    renderSongs([]);
    setStatus(error.message, "error");
  }
}

async function addSong(event) {
  event.preventDefault();

  const song = songPayload(songForm);
  submitButton.disabled = true;
  setStatus(editingSongId ? "Saving song..." : "Adding song...");

  try {
    const wasEditing = Boolean(editingSongId);
    const url = editingSongId ? `/songs/${editingSongId}` : "/songs";
    const method = editingSongId ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(song),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to save song");
    }

    resetSongForm();
    setStatus(wasEditing ? "Song updated." : "Song added.", "success");
    await Promise.all([loadBands(), loadAlbums(), loadSongs()]);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

function populateSongForm(song) {
  editingSongId = song.id;
  selectedSong = song;
  songForm.elements.title.value = song.title || "";
  songForm.elements.band_name.value = song.band_name || "";
  songForm.elements.album_title.value = song.album_title || "";
  songForm.elements.release_year.value = song.release_year || "";
  songForm.elements.cover_url.value = song.cover_url || "";
  songForm.elements.notes.value = song.notes || "";
  setMainPhotoPreview(song.cover_url);
  setSongFormMode("view");
  setStatus(`Selected ${song.title}.`, "success");
  songForm.scrollIntoView({ behavior: "smooth", block: "start" });
  editRecordButton.focus();
}

function resetSongForm() {
  editingSongId = null;
  selectedSong = null;
  songForm.reset();
  renderBandOptions();
  renderAlbumOptions();
  setMainPhotoPreview("");
  setSongFormMode("add");
}

async function deleteSong(song) {
  const confirmed = window.confirm(`Delete ${song.title}?`);

  if (!confirmed) {
    return;
  }

  setStatus("Deleting song...");

  try {
    const response = await fetch(`/songs/${song.id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to delete song");
    }

    if (editingSongId === song.id) {
      resetSongForm();
    }

    setStatus("Song deleted.", "success");
    await Promise.all([loadAlbums(), loadSongs()]);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

songForm.addEventListener("submit", addSong);
refreshButton.addEventListener("click", () => Promise.all([loadBands(), loadAlbums(), loadSongs()]));
editRecordButton.addEventListener("click", () => {
  if (!selectedSong) {
    return;
  }

  setSongFormMode("edit");
  setStatus(`Editing ${selectedSong.title}.`, "success");
  songForm.elements.title.focus();
});
cancelEditButton.addEventListener("click", () => {
  resetSongForm();
  setStatus("Ready to add a song.");
});
deleteRecordButton.addEventListener("click", () => {
  if (selectedSong) {
    deleteSong(selectedSong);
  }
});
connectPhotoUpload(songForm);

Promise.all([loadBands(), loadAlbums(), loadSongs()]);
