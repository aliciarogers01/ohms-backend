const artistsList = document.querySelector("#artistsList");
const artistCount = document.querySelector("#artistCount");
const artistForm = document.querySelector("#artistForm");
const refreshButton = document.querySelector("#refreshButton");
const submitButton = document.querySelector("#submitButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const statusMessage = document.querySelector("#statusMessage");
const artistBandsList = document.querySelector("#artistBandsList");
const addBandButton = document.querySelector("#addBandButton");

let editingArtistId = null;
let bands = [];

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function artistLocation(artist) {
  return [artist.city, artist.state].filter(Boolean).join(", ");
}

function artistPayload(form) {
  const formData = new FormData(form);

  return {
    name: formData.get("name").trim(),
    roles: formData.get("roles").trim(),
    city: formData.get("city").trim(),
    state: formData.get("state").trim().toUpperCase(),
    picture_url: formData.get("picture_url").trim(),
    notes: formData.get("notes").trim(),
    bands: artistBandPayload(form),
  };
}

function artistBandPayload(form) {
  return [...form.querySelectorAll("[data-band-row]")]
    .map((row) => {
      const select = row.querySelector("[data-band-select]");
      const input = row.querySelector("[data-band-name]");
      const bandId = Number(select.value);
      const name = input.value.trim();

      return {
        band_id: validBandId(bandId) ? bandId : null,
        name,
      };
    })
    .filter((band) => band.band_id || band.name);
}

function validBandId(id) {
  return Number.isInteger(id) && id > 0;
}

async function loadBands() {
  try {
    const response = await fetch("/bands");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load bands");
    }

    bands = data.bands;
  } catch (error) {
    bands = [];
  }
}

function createBandRow(band = {}) {
  const row = document.createElement("div");
  row.className = "member-row";
  row.dataset.bandRow = "";

  const selectLabel = document.createElement("label");
  const selectText = document.createElement("span");
  selectText.textContent = "Existing Band";

  const select = document.createElement("select");
  select.dataset.bandSelect = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = bands.length ? "Select band" : "No bands yet";
  select.appendChild(emptyOption);

  bands.forEach((optionBand) => {
    const option = document.createElement("option");
    option.value = optionBand.id;
    option.textContent = optionBand.name;
    select.appendChild(option);
  });

  if (validBandId(band.id)) {
    const hasLinkedOption = [...select.options].some((option) => Number(option.value) === band.id);

    if (!hasLinkedOption) {
      const linkedOption = document.createElement("option");
      linkedOption.value = band.id;
      linkedOption.textContent = band.name;
      select.appendChild(linkedOption);
    }

    select.value = String(band.id);
  }

  selectLabel.append(selectText, select);

  const inputLabel = document.createElement("label");
  const inputText = document.createElement("span");
  inputText.textContent = "New Band";

  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = "Type name if not listed";
  input.dataset.bandName = "";

  if (!validBandId(band.id)) {
    input.value = band.name || "";
  }

  select.addEventListener("change", () => {
    if (select.value) {
      input.value = "";
    }
  });

  input.addEventListener("input", () => {
    if (input.value.trim()) {
      select.value = "";
    }
  });

  inputLabel.append(inputText, input);

  row.append(
    selectLabel,
    inputLabel,
    createButton("Remove", "secondary-button", () => {
      row.remove();
    }),
  );

  return row;
}

function addBandRow(band = {}) {
  artistBandsList.appendChild(createBandRow(band));
}

function renderArtistBands(form, linkedBands = []) {
  const list = form.querySelector("[data-bands-list]") || artistBandsList;
  list.innerHTML = "";

  linkedBands.forEach((band) => {
    list.appendChild(createBandRow(band));
  });
}

async function uploadPhoto(file) {
  const signatureResponse = await fetch("/cloudinary/signature?folder=artists");
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

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
    {
      method: "POST",
      body: uploadData,
    },
  );
  const uploadResult = await uploadResponse.json();

  if (!uploadResponse.ok || !uploadResult.secure_url) {
    throw new Error(uploadResult.error?.message || "Photo upload failed");
  }

  return uploadResult.secure_url;
}

function setPhotoPreview(preview, url) {
  preview.innerHTML = "";

  if (!url) {
    preview.textContent = "No photo selected";
    return;
  }

  const image = document.createElement("img");
  image.src = url;
  image.alt = "Selected artist photo";
  preview.appendChild(image);
}

function setMainPhotoPreview(url) {
  const preview = artistForm.querySelector("[data-photo-preview]");
  setPhotoPreview(preview, url);
}

function connectPhotoUpload(form) {
  const fileInput = form.querySelector("[name='picture_file']");
  const urlInput = form.querySelector("[name='picture_url']");
  const preview = form.querySelector("[data-photo-preview]");

  if (!fileInput || !urlInput || !preview) {
    return;
  }

  setPhotoPreview(preview, urlInput.value);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];

    if (!file) {
      return;
    }

    setStatus("Uploading photo...");
    fileInput.disabled = true;

    try {
      const photoUrl = await uploadPhoto(file);
      urlInput.value = photoUrl;
      setPhotoPreview(preview, photoUrl);
      setStatus("Photo uploaded.", "success");
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

function createDisplayCard(artist) {
  const item = document.createElement("article");
  item.className = "band-item";
  item.tabIndex = 0;
  item.addEventListener("click", () => populateArtistForm(artist));
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      populateArtistForm(artist);
    }
  });

  const picture = document.createElement("div");
  picture.className = "band-picture";

  if (artist.picture_url) {
    const image = document.createElement("img");
    image.src = artist.picture_url;
    image.alt = artist.name;
    image.loading = "lazy";
    picture.appendChild(image);
  } else {
    picture.textContent = "No image";
  }

  const content = document.createElement("div");
  content.className = "band-card-content";

  const name = document.createElement("div");
  name.className = "band-name";
  name.textContent = artist.name;

  const meta = document.createElement("div");
  meta.className = "band-meta";
  meta.textContent = artistLocation(artist) || "Location not set";

  const roles = document.createElement("div");
  roles.className = "band-years";
  roles.textContent = artist.roles || "Roles not set";

  content.append(name, roles, meta);

  const cardMain = document.createElement("div");
  cardMain.className = "band-card-main";
  cardMain.append(picture, content);

  const actions = document.createElement("div");
  actions.className = "band-actions";
  actions.append(
    createButton("Edit", "secondary-button", (event) => {
      event.stopPropagation();
      populateArtistForm(artist);
    }),
    createButton("Delete", "danger-button", (event) => {
      event.stopPropagation();
      deleteArtist(artist);
    }),
  );

  item.append(cardMain, actions);
  return item;
}

function renderArtists(artists) {
  artistCount.textContent = artists.length;
  artistsList.innerHTML = "";

  if (!artists.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No artists yet.";
    artistsList.appendChild(empty);
    return;
  }

  artists.forEach((artist) => {
    const item = createDisplayCard(artist);
    artistsList.appendChild(item);
  });
}

async function loadArtists() {
  setStatus("Loading artists...");

  try {
    const response = await fetch("/artists");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load artists");
    }

    renderArtists(data.artists);
    setStatus("Artists loaded.", "success");
  } catch (error) {
    renderArtists([]);
    setStatus(error.message, "error");
  }
}

async function addArtist(event) {
  event.preventDefault();

  const artist = artistPayload(artistForm);

  submitButton.disabled = true;
  setStatus(editingArtistId ? "Saving artist..." : "Adding artist...");

  try {
    const wasEditing = Boolean(editingArtistId);
    const url = editingArtistId ? `/artists/${editingArtistId}` : "/artists";
    const method = editingArtistId ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(artist),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to add artist");
    }

    resetArtistForm();
    setStatus(wasEditing ? "Artist updated." : "Artist added.", "success");
    await loadBands();
    await loadArtists();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

function populateArtistForm(artist) {
  editingArtistId = artist.id;
  artistForm.elements.name.value = artist.name || "";
  artistForm.elements.roles.value = artist.roles || "";
  artistForm.elements.city.value = artist.city || "";
  artistForm.elements.state.value = artist.state || "";
  artistForm.elements.picture_url.value = artist.picture_url || "";
  artistForm.elements.notes.value = artist.notes || "";
  renderArtistBands(artistForm, artist.bands);
  setMainPhotoPreview(artist.picture_url);
  submitButton.textContent = "Save Artist";
  cancelEditButton.classList.remove("hidden");
  setStatus(`Editing ${artist.name}.`, "success");
  artistForm.scrollIntoView({ behavior: "smooth", block: "start" });
  artistForm.elements.name.focus();
}

function resetArtistForm() {
  editingArtistId = null;
  artistForm.reset();
  renderArtistBands(artistForm);
  setMainPhotoPreview("");
  submitButton.textContent = "Add Artist";
  cancelEditButton.classList.add("hidden");
}

async function deleteArtist(artist) {
  const confirmed = window.confirm(`Delete ${artist.name}?`);

  if (!confirmed) {
    return;
  }

  setStatus("Deleting artist...");

  try {
    const response = await fetch(`/artists/${artist.id}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to delete artist");
    }

    if (editingArtistId === artist.id) {
      resetArtistForm();
    }

    setStatus("Artist deleted.", "success");
    await loadArtists();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

artistForm.addEventListener("submit", addArtist);
refreshButton.addEventListener("click", () => Promise.all([loadBands(), loadArtists()]));
addBandButton.addEventListener("click", () => addBandRow());
cancelEditButton.addEventListener("click", () => {
  resetArtistForm();
  setStatus("Ready to add an artist.");
});
connectPhotoUpload(artistForm);

Promise.all([loadBands(), loadArtists()]);
