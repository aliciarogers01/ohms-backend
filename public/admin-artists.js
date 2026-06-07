const artistsList = document.querySelector("#artistsList");
const artistCount = document.querySelector("#artistCount");
const artistForm = document.querySelector("#artistForm");
const refreshButton = document.querySelector("#refreshButton");
const submitButton = document.querySelector("#submitButton");
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

  if (artist.bands && artist.bands.length) {
    const linkedBands = document.createElement("div");
    linkedBands.className = "band-members-summary";

    const bandsTitle = document.createElement("div");
    bandsTitle.className = "band-members-title";
    bandsTitle.textContent = "Bands";

    const bandsNames = document.createElement("div");
    bandsNames.className = "band-members-names";
    bandsNames.textContent = artist.bands.map((band) => band.name).join(", ");

    linkedBands.append(bandsTitle, bandsNames);
    content.appendChild(linkedBands);
  }

  const cardMain = document.createElement("div");
  cardMain.className = "band-card-main";
  cardMain.append(picture, content);

  const actions = document.createElement("div");
  actions.className = "band-actions";
  actions.append(
    createButton("Edit", "secondary-button", () => {
      editingArtistId = artist.id;
      loadArtists();
    }),
    createButton("Delete", "danger-button", () => deleteArtist(artist)),
  );

  item.append(cardMain, actions);
  return item;
}

function createEditCard(artist) {
  const item = document.createElement("article");
  item.className = "band-item edit-item";

  const form = document.createElement("form");
  form.className = "edit-form";
  form.innerHTML = `
    <label>
      <span>Name</span>
      <input name="name" type="text" autocomplete="off" required>
    </label>
    <label>
      <span>Roles</span>
      <input name="roles" type="text" placeholder="Vocals, guitar">
    </label>
    <div class="form-row">
      <label>
        <span>City</span>
        <input name="city" type="text" autocomplete="address-level2">
      </label>
      <label>
        <span>State</span>
        <input name="state" type="text" maxlength="2" autocomplete="address-level1">
      </label>
    </div>
    <div class="photo-field">
      <span>Picture</span>
      <input name="picture_url" type="hidden">
      <input id="artist_picture_file_${artist.id}" name="picture_file" type="file" accept="image/*">
      <label class="photo-button" for="artist_picture_file_${artist.id}">Select Photo</label>
      <div class="photo-preview" data-photo-preview>No photo selected</div>
    </div>
    <label>
      <span>Notes</span>
      <textarea name="notes" rows="3"></textarea>
    </label>
    <section class="form-section">
      <div class="section-header">
        <h2>Artist Bands</h2>
        <button type="button" class="secondary-button" data-add-band>Add Band</button>
      </div>
      <div class="member-list" data-bands-list></div>
    </section>
    <div class="edit-actions">
      <button type="submit">Save</button>
      <button type="button" class="secondary-button" data-cancel>Cancel</button>
    </div>
  `;

  form.elements.name.value = artist.name || "";
  form.elements.roles.value = artist.roles || "";
  form.elements.city.value = artist.city || "";
  form.elements.state.value = artist.state || "";
  form.elements.picture_url.value = artist.picture_url || "";
  form.elements.notes.value = artist.notes || "";
  connectPhotoUpload(form);
  renderArtistBands(form, artist.bands);

  form.addEventListener("submit", (event) => updateArtist(event, artist.id));
  form.querySelector("[data-add-band]").addEventListener("click", () => {
    form.querySelector("[data-bands-list]").appendChild(createBandRow());
  });
  form.querySelector("[data-cancel]").addEventListener("click", () => {
    editingArtistId = null;
    loadArtists();
  });

  item.appendChild(form);
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
    const item = artist.id === editingArtistId ? createEditCard(artist) : createDisplayCard(artist);
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
  setStatus("Adding artist...");

  try {
    const response = await fetch("/artists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(artist),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to add artist");
    }

    artistForm.reset();
    renderArtistBands(artistForm);
    setStatus("Artist added.", "success");
    await loadBands();
    await loadArtists();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function updateArtist(event, artistId) {
  event.preventDefault();

  const form = event.currentTarget;
  const artist = artistPayload(form);
  const saveButton = form.querySelector("button[type='submit']");

  saveButton.disabled = true;
  setStatus("Saving artist...");

  try {
    const response = await fetch(`/artists/${artistId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(artist),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to update artist");
    }

    editingArtistId = null;
    setStatus("Artist updated.", "success");
    await loadBands();
    await loadArtists();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    saveButton.disabled = false;
  }
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
      editingArtistId = null;
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
connectPhotoUpload(artistForm);

Promise.all([loadBands(), loadArtists()]);
