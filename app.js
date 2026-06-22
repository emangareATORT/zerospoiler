const matchList = document.querySelector("#matchList");
const statusText = document.querySelector("#statusText");
const statusDot = document.querySelector("#statusDot");
const refreshButton = document.querySelector("#refreshButton");
const emptyState = document.querySelector("#emptyState");
const playerFrame = document.querySelector("#playerFrame");
const youtubePlayer = document.querySelector("#youtubePlayer");
const playerCover = document.querySelector("#playerCover");
const playPauseButton = document.querySelector("#playPauseButton");
const audioButton = document.querySelector("#audioButton");
const currentSelection = document.querySelector("#currentSelection");

let selectedVideo = null;
let isPlaying = false;
let audioEnabled = false;
let coverTimer = 0;

function setStatus(message, ready = false) {
  statusText.textContent = message;
  statusDot.classList.toggle("is-ready", ready);
}

function formatTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function embedUrl(videoId, autoplay) {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: audioEnabled ? "0" : "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    iv_load_policy: "3",
    fs: "0",
    disablekb: "1",
    origin: window.location.origin,
  });

  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

function renderList(items, blockedCount = 0) {
  matchList.innerHTML = "";

  if (items.length === 0) {
    matchList.innerHTML = `<div class="status-panel"><p>${
      blockedCount > 0
        ? "Hay compactos recientes, pero YouTube no permite reproducirlos dentro de esta app sin salir a una página con riesgo de spoiler."
        : "No encontré resúmenes publicados por las fuentes configuradas en las últimas 24 horas."
    }</p></div>`;
    return;
  }

  items.forEach((item, index) => {
    const durationText = item.duration ? ` · duración ${item.duration}` : "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "match-card";
    button.dataset.videoId = item.id;
    button.innerHTML = `
      <strong>${item.safeTitle || `Resumen ${index + 1}`}</strong>
      <span>${item.source || "Fuente segura"} · ${formatTime(item.publishedAt)}${durationText} · resumen ${index + 1}</span>
      <small>Seleccionar y reproducir</small>
    `;
    button.addEventListener("click", () => selectVideo(item, button));
    matchList.appendChild(button);
  });
}

function selectVideo(item, button) {
  selectedVideo = item;
  document.querySelectorAll(".match-card").forEach((card) => card.classList.remove("is-selected"));
  button.classList.add("is-selected");
  emptyState.classList.add("is-hidden");
  playerFrame.classList.remove("is-hidden");
  playPauseButton.disabled = false;
  audioButton.disabled = false;
  playPauseButton.textContent = "Reiniciar resumen";
  audioButton.textContent = audioEnabled ? "Audio activado" : "Audio silenciado";
  currentSelection.textContent = item.safeTitle || "Partido seleccionado";
  playSelected();
}

function playSelected() {
  if (!selectedVideo) return;
  window.clearTimeout(coverTimer);
  isPlaying = true;
  playerCover.classList.remove("is-clear");
  youtubePlayer.src = embedUrl(selectedVideo.id, true);
  coverTimer = window.setTimeout(() => {
    playerCover.classList.add("is-clear");
  }, 2600);
  playPauseButton.textContent = "Reiniciar resumen";
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  audioButton.textContent = audioEnabled ? "Audio activado" : "Audio silenciado";
  if (selectedVideo && isPlaying) {
    youtubePlayer.src = embedUrl(selectedVideo.id, true);
  }
}

async function loadVideos() {
  setStatus("Buscando partidos de las últimas 24 horas...");
  refreshButton.disabled = true;
  matchList.innerHTML = "";

  try {
    const response = await fetch("/api/videos", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderList(data.items, data.blockedCount || 0);
    setStatus(
      data.items.length > 0
        ? `${data.items.length} ${data.items.length === 1 ? "resumen disponible" : "resúmenes disponibles"}.`
        : data.blockedCount
          ? "Hay compactos recientes, pero ninguno es reproducible en modo seguro."
          : "Lista actualizada sin compactos recientes.",
      true,
    );
  } catch {
    setStatus("No pude actualizar la lista. Revisá la conexión e intentá de nuevo.");
    matchList.innerHTML = `<div class="status-panel"><p>La app necesita conexión a YouTube para cargar las fuentes configuradas.</p></div>`;
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadVideos);
playPauseButton.addEventListener("click", playSelected);
audioButton.addEventListener("click", toggleAudio);

void loadVideos();
