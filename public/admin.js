const bandsList = document.querySelector("#bandsList");
const bandCount = document.querySelector("#bandCount");
const bandForm = document.querySelector("#bandForm");
const refreshButton = document.querySelector("#refreshButton");
const submitButton = document.querySelector("#submitButton");
const statusMessage = document.querySelector("#statusMessage");
const bandMembersList = document.querySelector("#bandMembersList");
const addMemberButton = document.querySelector("#addMemberButton");

let editingBandId = null;
let artists = [];

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function bandLocation(band) {
  return [band.city, band.state].filter(Boolean).join(", ");
}

function bandPayload(form) {
  const formData = new FormData(form);

  return {
    name: formData.get("name").trim(),
    city: formData.get("city").trim(),
    state: formData.get("state").trim().toUpperCase(),
    years_active: formData.get("years_active").trim(),
    picture_url: formData.get("picture_url").trim(),
    notes: formData.get("notes").trim(),
    members: memberPayload(form),
  };
}

function memberPayload(form) {
  return [...form.querySelectorAll("[data-member-row]")]
    .map((row) => {
      const select = row.querySelector("[data-member-select]");
      const input = row.querySelector("[data-member-name]");
      const artistId = Number(select.value);
      const name = input.value.trim();

      return {
        artist_id: validArtistId(artistId) ? artistId : null,
        name,
      };
    })
    .filter((member) => member.artist_id || member.name);
}

function validArtistId(id) {
  return Number.isInteger(id) && id > 0;
}

async function loadArtists() {
  try {
    const response = await fetch("/artists");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load artists");
    }

    artists = data.artists;
  } catch (error) {
    artists = [];
  }
}

function createMemberRow(member = {}) {
  const row = document.createElement("div");
  row.className = "member-row";
  row.dataset.memberRow = "";

  const selectLabel = document.createElement("label");
  const selectText = document.createElement("span");
  selectText.textContent = "Existing Artist";

  const select = document.createElement("select");
  select.dataset.memberSelect = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = artists.length ? "Select artist" : "No artists yet";
  select.appendChild(emptyOption);

  artists.forEach((artist) => {
    const option = document.createElement("option");
    option.value = artist.id;
    option.textContent = artist.name;
    select.appendChild(option);
  });

  if (validArtistId(member.id)) {
    select.value = String(member.id);
  }

  selectLabel.append(selectText, select);

  const inputLabel = document.createElement("label");
  const inputText = document.createElement("span");
  inputText.textContent = "New Artist";

  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = "Type name if not listed";
  input.dataset.memberName = "";

  if (!validArtistId(member.id)) {
    input.value = member.name || "";
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

function addMemberRow(member = {}) {
  bandMembersList.appendChild(createMemberRow(member));
}

function renderMembers(form, members = []) {
  const list = form.querySelector("[data-members-list]") || bandMembersList;
  list.innerHTML = "";

  members.forEach((member) => {
    list.appendChild(createMemberRow(member));
  });
}

async function uploadPhoto(file) {
  const signatureResponse = await fetch("/cloudinary/signature");
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
  image.alt = "Selected band photo";
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

function createDisplayCard(band) {
  const item = document.createElement("article");
  item.className = "band-item";

  const picture = document.createElement("div");
  picture.className = "band-picture";

  if (band.picture_url) {
    const image = document.createElement("img");
    image.src = band.picture_url;
    image.alt = band.name;
    image.loading = "lazy";
    picture.appendChild(image);
  } else {
    picture.textContent = "No image";
  }

  const content = document.createElement("div");
  content.className = "band-card-content";

  const name = document.createElement("div");
  name.className = "band-name";
  name.textContent = band.name;

  const meta = document.createElement("div");
  meta.className = "band-meta";
  meta.textContent = bandLocation(band) || "Location not set";

  const years = document.createElement("div");
  years.className = "band-years";
  years.textContent = band.years_active || "Years active not set";

  content.append(name, meta, years);

  const cardMain = document.createElement("div");
  cardMain.className = "band-card-main";
  cardMain.append(picture, content);

  const actions = document.createElement("div");
  actions.className = "band-actions";
  actions.append(
    createButton("Edit", "secondary-button", () => {
      editingBandId = band.id;
      loadBands();
    }),
    createButton("Delete", "danger-button", () => deleteBand(band)),
  );

  item.append(cardMain, actions);
  return item;
}

function createEditCard(band) {
  const item = document.createElement("article");
  item.className = "band-item edit-item";

  const form = document.createElement("form");
  form.className = "edit-form";
  form.innerHTML = `
    <label>
      <span>Name</span>
      <input name="name" type="text" autocomplete="off" required>
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
    <div class="form-row">
      <label>
        <span>Years Active</span>
        <input name="years_active" type="text" placeholder="1973-present">
      </label>
      <div class="photo-field">
        <span>Picture</span>
        <input name="picture_url" type="hidden">
        <input id="picture_file_${band.id}" name="picture_file" type="file" accept="image/*">
        <label class="photo-button" for="picture_file_${band.id}">Select Photo</label>
        <div class="photo-preview" data-photo-preview>No photo selected</div>
      </div>
    </div>
    <label>
      <span>Notes</span>
      <textarea name="notes" rows="3"></textarea>
    </label>
    <section class="form-section">
      <div class="section-header">
        <h2>Band Members</h2>
        <button type="button" class="secondary-button" data-add-member>Add Artist</button>
      </div>
      <div class="member-list" data-members-list></div>
    </section>
    <div class="edit-actions">
      <button type="submit">Save</button>
      <button type="button" class="secondary-button" data-cancel>Cancel</button>
    </div>
  `;

  form.elements.name.value = band.name || "";
  form.elements.city.value = band.city || "";
  form.elements.state.value = band.state || "";
  form.elements.years_active.value = band.years_active || "";
  form.elements.picture_url.value = band.picture_url || "";
  form.elements.notes.value = band.notes || "";
  connectPhotoUpload(form);
  renderMembers(form, band.members);

  form.addEventListener("submit", (event) => updateBand(event, band.id));
  form.querySelector("[data-add-member]").addEventListener("click", () => {
    form.querySelector("[data-members-list]").appendChild(createMemberRow());
  });
  form.querySelector("[data-cancel]").addEventListener("click", () => {
    editingBandId = null;
    loadBands();
  });

  item.appendChild(form);
  return item;
}

function renderBands(bands) {
  bandCount.textContent = bands.length;
  bandsList.innerHTML = "";

  if (!bands.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No bands yet.";
    bandsList.appendChild(empty);
    return;
  }

  bands.forEach((band) => {
    const item = band.id === editingBandId ? createEditCard(band) : createDisplayCard(band);
    bandsList.appendChild(item);
  });
}

async function loadBands() {
  setStatus("Loading bands...");

  try {
    const response = await fetch("/bands");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load bands");
    }

    renderBands(data.bands);
    setStatus("Bands loaded.", "success");
  } catch (error) {
    renderBands([]);
    setStatus(error.message, "error");
  }
}

async function addBand(event) {
  event.preventDefault();

  const band = bandPayload(bandForm);

  submitButton.disabled = true;
  setStatus("Adding band...");

  try {
    const response = await fetch("/bands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(band),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to add band");
    }

    bandForm.reset();
    renderMembers(bandForm);
    setStatus("Band added.", "success");
    await loadArtists();
    await loadBands();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function updateBand(event, bandId) {
  event.preventDefault();

  const form = event.currentTarget;
  const band = bandPayload(form);
  const saveButton = form.querySelector("button[type='submit']");

  saveButton.disabled = true;
  setStatus("Saving band...");

  try {
    const response = await fetch(`/bands/${bandId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(band),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to update band");
    }

    editingBandId = null;
    setStatus("Band updated.", "success");
    await loadBands();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    saveButton.disabled = false;
  }
}

async function deleteBand(band) {
  const confirmed = window.confirm(`Delete ${band.name}?`);

  if (!confirmed) {
    return;
  }

  setStatus("Deleting band...");

  try {
    const response = await fetch(`/bands/${band.id}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to delete band");
    }

    if (editingBandId === band.id) {
      editingBandId = null;
    }

    setStatus("Band deleted.", "success");
    await loadBands();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

bandForm.addEventListener("submit", addBand);
refreshButton.addEventListener("click", loadBands);
addMemberButton.addEventListener("click", () => addMemberRow());
connectPhotoUpload(bandForm);

Promise.all([loadArtists(), loadBands()]);
