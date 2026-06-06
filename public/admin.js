const bandsList = document.querySelector("#bandsList");
const bandCount = document.querySelector("#bandCount");
const bandForm = document.querySelector("#bandForm");
const refreshButton = document.querySelector("#refreshButton");
const submitButton = document.querySelector("#submitButton");
const statusMessage = document.querySelector("#statusMessage");

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function bandLocation(band) {
  return [band.city, band.state].filter(Boolean).join(", ");
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
    const item = document.createElement("article");
    item.className = "band-item";

    const name = document.createElement("div");
    name.className = "band-name";
    name.textContent = band.name;

    const meta = document.createElement("div");
    meta.className = "band-meta";
    meta.textContent = bandLocation(band) || "Location not set";

    item.append(name, meta);

    if (band.notes) {
      const notes = document.createElement("p");
      notes.className = "band-notes";
      notes.textContent = band.notes;
      item.appendChild(notes);
    }

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

  const formData = new FormData(bandForm);
  const band = {
    name: formData.get("name").trim(),
    city: formData.get("city").trim(),
    state: formData.get("state").trim().toUpperCase(),
    notes: formData.get("notes").trim(),
  };

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

bandForm.addEventListener("submit", addBand);
refreshButton.addEventListener("click", loadBands);

loadBands();
