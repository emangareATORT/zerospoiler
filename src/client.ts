type VideoItem = {
  id: string;
  safeTitle: string;
  publishedAt: string;
  duration: string | null;
  source: string;
};

type VideoResponse = {
  channelUrl: string;
  generatedAt: string;
  items: VideoItem[];
  blockedCount?: number;
  warning?: string;
};

const matchList = document.querySelector<HTMLDivElement>("#matchList")!;
const statusText = document.querySelector<HTMLParagraphElement>("#statusText")!;
const statusDot = document.querySelector<HTMLSpanElement>("#statusDot")!;
const refreshButton = document.querySelector<HTMLButtonElement>("#refreshButton")!;
const emptyState = document.querySelector<HTMLDivElement>("#emptyState")!;
const playerFrame = document.querySelector<HTMLDivElement>("#playerFrame")!;
const youtubePlayer = document.querySelector<HTMLIFrameElement>("#youtubePlayer")!;
const playerCover = document.querySelector<HTMLDivElement>("#playerCover")!;
const playPauseButton = document.querySelector<HTMLButtonElement>("#playPauseButton")!;
const audioButton = document.querySelector<HTMLButtonElement>("#audioButton")!;
const currentSelection = document.querySelector<HTMLDivElement>("#currentSelection")!;

let selectedVideo: VideoItem | null = null;
let isPlaying = false;
let audioEnabled = false;
let coverTimer = 0;

function setStatus(message: string, ready = false): void {
  statusText.textContent = message;
  statusDot.classList.toggle("is-ready", ready);
}

function formatTime(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function embedUrl(videoId: string, autoplay: boolean): string {
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

function renderList(items: VideoItem[], blockedCount = 0): void {
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

function selectVideo(item: VideoItem, button: HTMLButtonElement): void {
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

function playSelected(): void {
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

function toggleAudio(): void {
  audioEnabled = !audioEnabled;
  audioButton.textContent = audioEnabled ? "Audio activado" : "Audio silenciado";
  if (selectedVideo && isPlaying) {
    youtubePlayer.src = embedUrl(selectedVideo.id, true);
  }
}

async function loadVideos(): Promise<void> {
  setStatus("Buscando partidos de las últimas 24 horas...");
  refreshButton.disabled = true;
  matchList.innerHTML = "";

  try {
    const response = await fetch("/api/videos", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as VideoResponse;
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
