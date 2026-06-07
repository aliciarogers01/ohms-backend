const bandsList = document.querySelector("#bandsList");
const bandCount = document.querySelector("#bandCount");
const bandForm = document.querySelector("#bandForm");
const refreshButton = document.querySelector("#refreshButton");
const submitButton = document.querySelector("#submitButton");
const editRecordButton = document.querySelector("#editRecordButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const deleteRecordButton = document.querySelector("#deleteRecordButton");
const statusMessage = document.querySelector("#statusMessage");
const bandMembersList = document.querySelector("#bandMembersList");
const addMemberButton = document.querySelector("#addMemberButton");

let editingBandId = null;
let selectedBand = null;
let artists = [];

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function setBandFormControlsEnabled(enabled) {
  bandForm.querySelectorAll("input, select, textarea").forEach((control) => {
    control.disabled = !enabled;
  });

  addMemberButton.disabled = !enabled;
  bandMembersList.querySelectorAll("button").forEach((button) => {
    button.disabled = !enabled;
  });
}

function setBandFormMode(mode) {
  const selectedMode = mode === "view" || mode === "edit";
  const enabled = mode === "add" || mode === "edit";

  setBandFormControlsEnabled(enabled);
  editRecordButton.classList.toggle("hidden", !selectedMode);
  cancelEditButton.classList.toggle("hidden", !selectedMode);
  deleteRecordButton.classList.toggle("hidden", !selectedMode);
  submitButton.textContent = mode === "add" ? "Add Band" : "Save Band";
  submitButton.disabled = mode === "view";
  editRecordButton.disabled = mode === "edit";
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
    const hasLinkedOption = [...select.options].some((option) => Number(option.value) === member.id);

    if (!hasLinkedOption) {
      const linkedOption = document.createElement("option");
      linkedOption.value = member.id;
      linkedOption.textContent = member.name;
      select.appendChild(linkedOption);
    }

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

function setMainPhotoPreview(url) {
  const preview = bandForm.querySelector("[data-photo-preview]");
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

function createDisplayCard(band) {
  const item = document.createElement("article");
  item.className = "band-item";
  item.tabIndex = 0;
  item.addEventListener("click", () => populateBandForm(band));
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      populateBandForm(band);
    }
  });

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

  item.append(cardMain);
  return item;
}

function renderBands(bands) {
  const sortedBands = [...bands].sort((first, second) =>
    (first.name || "").localeCompare(second.name || "", undefined, { sensitivity: "base" }),
  );

  bandCount.textContent = sortedBands.length;
  bandsList.innerHTML = "";

  if (!sortedBands.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No bands yet.";
    bandsList.appendChild(empty);
    return;
  }

  sortedBands.forEach((band) => {
    const item = createDisplayCard(band);
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
  setStatus(editingBandId ? "Saving band..." : "Adding band...");

  try {
    const wasEditing = Boolean(editingBandId);
    const url = editingBandId ? `/bands/${editingBandId}` : "/bands";
    const method = editingBandId ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(band),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to add band");
    }

    resetBandForm();
    setStatus(wasEditing ? "Band updated." : "Band added.", "success");
    await loadArtists();
    await loadBands();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

function populateBandForm(band) {
  editingBandId = band.id;
  selectedBand = band;
  bandForm.elements.name.value = band.name || "";
  bandForm.elements.city.value = band.city || "";
  bandForm.elements.state.value = band.state || "";
  bandForm.elements.years_active.value = band.years_active || "";
  bandForm.elements.picture_url.value = band.picture_url || "";
  bandForm.elements.notes.value = band.notes || "";
  renderMembers(bandForm, band.members);
  setMainPhotoPreview(band.picture_url);
  setBandFormMode("view");
  setStatus(`Selected ${band.name}.`, "success");
  bandForm.scrollIntoView({ behavior: "smooth", block: "start" });
  editRecordButton.focus();
}

function resetBandForm() {
  editingBandId = null;
  selectedBand = null;
  bandForm.reset();
  renderMembers(bandForm);
  setMainPhotoPreview("");
  setBandFormMode("add");
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
      resetBandForm();
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
editRecordButton.addEventListener("click", () => {
  if (!selectedBand) {
    return;
  }

  setBandFormMode("edit");
  setStatus(`Editing ${selectedBand.name}.`, "success");
  bandForm.elements.name.focus();
});
cancelEditButton.addEventListener("click", () => {
  resetBandForm();
  setStatus("Ready to add a band.");
});
deleteRecordButton.addEventListener("click", () => {
  if (selectedBand) {
    deleteBand(selectedBand);
  }
});
connectPhotoUpload(bandForm);

Promise.all([loadArtists(), loadBands()]);
