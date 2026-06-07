const albumsList = document.querySelector("#albumsList");
const albumCount = document.querySelector("#albumCount");
const albumForm = document.querySelector("#albumForm");
const refreshButton = document.querySelector("#refreshButton");
const submitButton = document.querySelector("#submitButton");
const editRecordButton = document.querySelector("#editRecordButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const deleteRecordButton = document.querySelector("#deleteRecordButton");
const statusMessage = document.querySelector("#statusMessage");
const albumSongsList = document.querySelector("#albumSongsList");
const addSongButton = document.querySelector("#addSongButton");
const bandsOptions = document.querySelector("#bandsOptions");
const songsOptions = document.querySelector("#songsOptions");

let editingAlbumId = null;
let selectedAlbum = null;
let bands = [];
let songs = [];

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function validId(id) {
  return Number.isInteger(id) && id > 0;
}

function findBandByName(name) {
  const normalizedName = name.trim().toLowerCase();
  return bands.find((band) => (band.name || "").trim().toLowerCase() === normalizedName);
}

function findSongByTitle(title) {
  const normalizedTitle = title.trim().toLowerCase();
  return songs.find((song) => (song.title || "").trim().toLowerCase() === normalizedTitle);
}

function setAlbumFormControlsEnabled(enabled) {
  albumForm.querySelectorAll("input, select, textarea").forEach((control) => {
    control.disabled = !enabled;
  });

  addSongButton.disabled = !enabled;
  albumSongsList.querySelectorAll("button").forEach((button) => {
    button.disabled = !enabled;
  });
}

function setAlbumFormMode(mode) {
  const selectedMode = mode === "view" || mode === "edit";
  const enabled = mode === "add" || mode === "edit";

  setAlbumFormControlsEnabled(enabled);
  editRecordButton.classList.toggle("hidden", !selectedMode);
  cancelEditButton.classList.toggle("hidden", !selectedMode);
  deleteRecordButton.classList.toggle("hidden", !selectedMode);
  submitButton.textContent = mode === "add" ? "Add Album" : "Save Album";
  submitButton.disabled = mode === "view";
  editRecordButton.disabled = mode === "edit";
}

function albumPayload(form) {
  const formData = new FormData(form);
  const bandName = formData.get("band_name").trim();
  const band = findBandByName(bandName);

  return {
    title: formData.get("title").trim(),
    band_id: band ? band.id : null,
    band_name: band ? "" : bandName,
    release_year: formData.get("release_year").trim(),
    cover_url: formData.get("cover_url").trim(),
    notes: formData.get("notes").trim(),
    songs: songPayload(form),
  };
}

function songPayload(form) {
  return [...form.querySelectorAll("[data-song-row]")]
    .map((row) => {
      const input = row.querySelector("[data-song-title]");
      const title = input.value.trim();
      const song = findSongByTitle(title);

      return {
        song_id: song ? song.id : null,
        title: song ? "" : title,
      };
    })
    .filter((song) => song.song_id || song.title);
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

async function loadSongs() {
  try {
    const response = await fetch("/songs");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load songs");
    }

    songs = data.songs;
    renderSongOptions();
  } catch (error) {
    songs = [];
    renderSongOptions();
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

function renderSongOptions() {
  songsOptions.innerHTML = "";
  [...songs]
    .sort((first, second) => (first.title || "").localeCompare(second.title || "", undefined, { sensitivity: "base" }))
    .forEach((song) => {
      const option = document.createElement("option");
      option.value = song.title;
      songsOptions.appendChild(option);
    });
}

function createSongRow(song = {}) {
  const row = document.createElement("div");
  row.className = "member-row";
  row.dataset.songRow = "";

  const inputLabel = document.createElement("label");
  const inputText = document.createElement("span");
  inputText.textContent = "Song";

  const input = document.createElement("input");
  input.type = "text";
  input.setAttribute("list", "songsOptions");
  input.autocomplete = "off";
  input.placeholder = "Type a song title";
  input.dataset.songTitle = "";
  input.value = song.title || "";

  inputLabel.append(inputText, input);

  row.append(
    inputLabel,
    createButton("Remove", "secondary-button", () => {
      row.remove();
    }),
  );

  return row;
}

function renderAlbumSongs(albumSongs = []) {
  albumSongsList.innerHTML = "";

  albumSongs.forEach((song) => {
    albumSongsList.appendChild(createSongRow(song));
  });
}

function addSongRow(song = {}) {
  albumSongsList.appendChild(createSongRow(song));
}

async function uploadPhoto(file) {
  const signatureResponse = await fetch("/cloudinary/signature?folder=albums");
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
  image.alt = "Selected album cover";
  preview.appendChild(image);
}

function setMainPhotoPreview(url) {
  setPhotoPreview(albumForm.querySelector("[data-photo-preview]"), url);
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

function createButton(text, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", handler);
  return button;
}

function createDisplayCard(album) {
  const item = document.createElement("article");
  item.className = "band-item";
  item.tabIndex = 0;
  item.addEventListener("click", () => populateAlbumForm(album));
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      populateAlbumForm(album);
    }
  });

  const picture = document.createElement("div");
  picture.className = "band-picture";

  if (album.cover_url) {
    const image = document.createElement("img");
    image.src = album.cover_url;
    image.alt = album.title;
    image.loading = "lazy";
    picture.appendChild(image);
  } else {
    picture.textContent = "No cover";
  }

  const content = document.createElement("div");
  content.className = "band-card-content";

  const title = document.createElement("div");
  title.className = "band-name";
  title.textContent = album.title;

  const bandName = document.createElement("div");
  bandName.className = "band-meta";
  bandName.textContent = album.band_name || "Band not set";

  const year = document.createElement("div");
  year.className = "band-years";
  year.textContent = album.release_year || "Year not set";

  content.append(title, bandName, year);

  const cardMain = document.createElement("div");
  cardMain.className = "band-card-main";
  cardMain.append(picture, content);
  item.append(cardMain);

  return item;
}

function renderAlbums(albums) {
  const sortedAlbums = [...albums].sort((first, second) =>
    (first.title || "").localeCompare(second.title || "", undefined, { sensitivity: "base" }),
  );

  albumCount.textContent = sortedAlbums.length;
  albumsList.innerHTML = "";

  if (!sortedAlbums.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No albums yet.";
    albumsList.appendChild(empty);
    return;
  }

  sortedAlbums.forEach((album) => {
    albumsList.appendChild(createDisplayCard(album));
  });
}

async function loadAlbums() {
  setStatus("Loading albums...");

  try {
    const response = await fetch("/albums");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load albums");
    }

    renderAlbums(data.albums);
    setStatus("Albums loaded.", "success");
  } catch (error) {
    renderAlbums([]);
    setStatus(error.message, "error");
  }
}

async function addAlbum(event) {
  event.preventDefault();

  const album = albumPayload(albumForm);
  submitButton.disabled = true;
  setStatus(editingAlbumId ? "Saving album..." : "Adding album...");

  try {
    const wasEditing = Boolean(editingAlbumId);
    const url = editingAlbumId ? `/albums/${editingAlbumId}` : "/albums";
    const method = editingAlbumId ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(album),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to save album");
    }

    resetAlbumForm();
    setStatus(wasEditing ? "Album updated." : "Album added.", "success");
    await Promise.all([loadBands(), loadSongs(), loadAlbums()]);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

function populateAlbumForm(album) {
  editingAlbumId = album.id;
  selectedAlbum = album;
  albumForm.elements.title.value = album.title || "";
  albumForm.elements.band_name.value = album.band_name || "";
  albumForm.elements.release_year.value = album.release_year || "";
  albumForm.elements.cover_url.value = album.cover_url || "";
  albumForm.elements.notes.value = album.notes || "";
  renderAlbumSongs(album.songs);
  setMainPhotoPreview(album.cover_url);
  setAlbumFormMode("view");
  setStatus(`Selected ${album.title}.`, "success");
  albumForm.scrollIntoView({ behavior: "smooth", block: "start" });
  editRecordButton.focus();
}

function resetAlbumForm() {
  editingAlbumId = null;
  selectedAlbum = null;
  albumForm.reset();
  renderBandOptions();
  renderAlbumSongs();
  setMainPhotoPreview("");
  setAlbumFormMode("add");
}

async function deleteAlbum(album) {
  const confirmed = window.confirm(`Delete ${album.title}?`);

  if (!confirmed) {
    return;
  }

  setStatus("Deleting album...");

  try {
    const response = await fetch(`/albums/${album.id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to delete album");
    }

    if (editingAlbumId === album.id) {
      resetAlbumForm();
    }

    setStatus("Album deleted.", "success");
    await Promise.all([loadSongs(), loadAlbums()]);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

albumForm.addEventListener("submit", addAlbum);
refreshButton.addEventListener("click", () => Promise.all([loadBands(), loadSongs(), loadAlbums()]));
addSongButton.addEventListener("click", () => addSongRow());
editRecordButton.addEventListener("click", () => {
  if (!selectedAlbum) {
    return;
  }

  setAlbumFormMode("edit");
  setStatus(`Editing ${selectedAlbum.title}.`, "success");
  albumForm.elements.title.focus();
});
cancelEditButton.addEventListener("click", () => {
  resetAlbumForm();
  setStatus("Ready to add an album.");
});
deleteRecordButton.addEventListener("click", () => {
  if (selectedAlbum) {
    deleteAlbum(selectedAlbum);
  }
});
connectPhotoUpload(albumForm);

Promise.all([loadBands(), loadSongs(), loadAlbums()]);
