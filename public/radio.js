const nowPlaying = document.querySelector("#nowPlaying");

function trackTitle(track) {
  if (!track.title && !track.artist) {
    return "No track information";
  }

  return track.artist ? `${track.artist} - ${track.title || "Untitled"}` : track.title;
}

function formatDuration(track) {
  const milliseconds = Number(track.durationInMs);

  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return "";
  }

  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function renderTrack(track) {
  nowPlaying.innerHTML = "";

  if (!track) {
    const empty = document.createElement("p");
    empty.className = "status";
    empty.textContent = "No now playing data available.";
    nowPlaying.appendChild(empty);
    return;
  }

  const picture = document.createElement("div");
  picture.className = "now-playing-picture";

  if (track.picture) {
    const image = document.createElement("img");
    image.src = track.picture;
    image.alt = track.title || "Now playing";
    picture.appendChild(image);
  } else {
    picture.textContent = "No image";
  }

  const details = document.createElement("div");
  details.className = "now-playing-details";

  const label = document.createElement("p");
  label.className = "eyebrow";
  label.textContent = "Now Playing";

  const title = document.createElement("h2");
  title.textContent = trackTitle(track);

  const metaParts = [track.album, track.year, formatDuration(track)].filter(Boolean);
  const meta = document.createElement("p");
  meta.className = "band-meta";
  meta.textContent = metaParts.join(" | ");

  details.append(label, title, meta);

  if (track.website) {
    const link = document.createElement("a");
    link.className = "secondary-link now-playing-link";
    link.href = track.website;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Track Link";
    details.appendChild(link);
  }

  nowPlaying.append(picture, details);
}

async function loadNowPlaying() {
  try {
    const response = await fetch("/sam/now-playing");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load now playing");
    }

    renderTrack(data.track);
  } catch (error) {
    nowPlaying.innerHTML = "";
    const message = document.createElement("p");
    message.className = "status error";
    message.textContent = error.message;
    nowPlaying.appendChild(message);
  }
}

loadNowPlaying();
