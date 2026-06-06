const bandsList = document.querySelector("#bandsList");
const bandCount = document.querySelector("#bandCount");
const bandForm = document.querySelector("#bandForm");
const refreshButton = document.querySelector("#refreshButton");
const submitButton = document.querySelector("#submitButton");
const statusMessage = document.querySelector("#statusMessage");

let editingBandId = null;

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
    notes: formData.get("notes").trim(),
  };
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

  const content = document.createElement("div");

  const name = document.createElement("div");
  name.className = "band-name";
  name.textContent = band.name;

  const meta = document.createElement("div");
  meta.className = "band-meta";
  meta.textContent = bandLocation(band) || "Location not set";

  content.append(name, meta);

  if (band.notes) {
    const notes = document.createElement("p");
    notes.className = "band-notes";
    notes.textContent = band.notes;
    content.appendChild(notes);
  }

  const actions = document.createElement("div");
  actions.className = "band-actions";
  actions.append(
    createButton("Edit", "secondary-button", () => {
      editingBandId = band.id;
      loadBands();
    }),
    createButton("Delete", "danger-button", () => deleteBand(band)),
  );

  item.append(content, actions);
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
    <label>
      <span>Notes</span>
      <textarea name="notes" rows="3"></textarea>
    </label>
    <div class="edit-actions">
      <button type="submit">Save</button>
      <button type="button" class="secondary-button" data-cancel>Cancel</button>
    </div>
  `;

  form.elements.name.value = band.name || "";
  form.elements.city.value = band.city || "";
  form.elements.state.value = band.state || "";
  form.elements.notes.value = band.notes || "";

  form.addEventListener("submit", (event) => updateBand(event, band.id));
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
    setStatus("Band added.", "success");
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

loadBands();
