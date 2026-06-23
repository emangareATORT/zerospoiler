type VideoItem = {
  id: string;
  safeTitle: string;
  countries?: ({ name: string; flag?: string } | string)[];
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
const appShell = document.querySelector<HTMLElement>(".app-shell")!;
const emptyState = document.querySelector<HTMLDivElement>("#emptyState")!;
const playerFrame = document.querySelector<HTMLDivElement>("#playerFrame")!;
const youtubePlayer = document.querySelector<HTMLIFrameElement>("#youtubePlayer")!;
const playerCover = document.querySelector<HTMLDivElement>("#playerCover")!;
const playPauseButton = document.querySelector<HTMLButtonElement>("#playPauseButton")!;
const rewindButton = document.querySelector<HTMLButtonElement>("#rewindButton")!;
const audioButton = document.querySelector<HTMLButtonElement>("#audioButton")!;
const togglePanelButton = document.querySelector<HTMLButtonElement>("#togglePanelButton")!;
const currentSelection = document.querySelector<HTMLDivElement>("#currentSelection")!;

const COUNTRY_CODES: Record<string, string> = {
  Afganistán: "af",
  Albania: "al",
  Alemania: "de",
  Andorra: "ad",
  Angola: "ao",
  "Arabia Saudita": "sa",
  Argelia: "dz",
  Argentina: "ar",
  Armenia: "am",
  Australia: "au",
  Austria: "at",
  Azerbaiyán: "az",
  Bahamas: "bs",
  Baréin: "bh",
  Bélgica: "be",
  Belice: "bz",
  Bolivia: "bo",
  "Bosnia y Herzegovina": "ba",
  Brasil: "br",
  Bulgaria: "bg",
  "Cabo Verde": "cv",
  Camerún: "cm",
  Canadá: "ca",
  Chile: "cl",
  China: "cn",
  Colombia: "co",
  "Corea del Sur": "kr",
  "Costa Rica": "cr",
  Croacia: "hr",
  Cuba: "cu",
  Dinamarca: "dk",
  Ecuador: "ec",
  Egipto: "eg",
  "El Salvador": "sv",
  "Emiratos Árabes Unidos": "ae",
  Escocia: "gb-sct",
  Eslovaquia: "sk",
  Eslovenia: "si",
  España: "es",
  "Estados Unidos": "us",
  Finlandia: "fi",
  Francia: "fr",
  Gales: "gb-wls",
  Georgia: "ge",
  Ghana: "gh",
  Grecia: "gr",
  Guatemala: "gt",
  Haití: "ht",
  Honduras: "hn",
  Hungría: "hu",
  Inglaterra: "gb-eng",
  Irán: "ir",
  Irak: "iq",
  Irlanda: "ie",
  Islandia: "is",
  Israel: "il",
  Italia: "it",
  Jamaica: "jm",
  Japón: "jp",
  Jordania: "jo",
  Marruecos: "ma",
  México: "mx",
  Nigeria: "ng",
  Noruega: "no",
  "Nueva Zelanda": "nz",
  "Países Bajos": "nl",
  Panamá: "pa",
  Paraguay: "py",
  Perú: "pe",
  Polonia: "pl",
  Portugal: "pt",
  Qatar: "qa",
  "República Checa": "cz",
  "República Dominicana": "do",
  Rumania: "ro",
  Senegal: "sn",
  Serbia: "rs",
  Suecia: "se",
  Suiza: "ch",
  Túnez: "tn",
  Turquía: "tr",
  Ucrania: "ua",
  Uruguay: "uy",
  Venezuela: "ve",
};

let selectedVideo: VideoItem | null = null;
let isPlaying = false;
let audioEnabled = false;
let playbackStartedAt = 0;
let playbackOffsetSeconds = 0;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function countryName(country: { name: string; flag?: string } | string): string {
  return typeof country === "string" ? country : country?.name || "";
}

function countriesForItem(item: VideoItem): string[] {
  const provided = Array.isArray(item.countries) ? item.countries.map(countryName).filter(Boolean) : [];
  if (provided.length > 0) return provided;

  const safeTitle = item.safeTitle || "";
  return Object.keys(COUNTRY_CODES)
    .map((name) => ({
      name,
      index: safeTitle.search(new RegExp(`\\b${escapeRegExp(name)}\\b`, "i")),
    }))
    .filter((country) => country.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((country) => country.name);
}

function flagMarkup(name: string): string {
  const code = COUNTRY_CODES[name];
  if (!code) return "";
  return `<img class="country-flag" src="https://flagcdn.com/24x18/${code}.png" alt="" loading="lazy" decoding="async">`;
}

function titleWithCountryFlagsHtml(item: VideoItem): string {
  const countries = countriesForItem(item);
  let title = escapeHtml(item.safeTitle || "Partido seleccionado");

  countries.forEach((name) => {
    const label = `${flagMarkup(name)}<span>${escapeHtml(name)}</span>`;
    title = title.replace(new RegExp(`\\b${escapeRegExp(escapeHtml(name))}\\b`, "g"), label);
  });

  return title;
}

function selectedLabelHtml(item: VideoItem): string {
  const duration = item.duration ? ` · ${item.duration}` : "";
  return `${titleWithCountryFlagsHtml(item)}${escapeHtml(duration)}`;
}

function embedUrl(videoId: string, autoplay: boolean): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: audioEnabled ? "0" : "1",
    controls: "0",
    enablejsapi: "1",
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

function playerCommand(func: string, args: unknown[] = []): void {
  if (!youtubePlayer.contentWindow) return;
  youtubePlayer.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), "*");
}

function applyAudioPreference(): void {
  playerCommand(audioEnabled ? "unMute" : "mute");
}

function renderList(items: VideoItem[], blockedCount = 0): void {
  matchList.innerHTML = "";

  if (items.length === 0) {
    matchList.innerHTML = `<div class="status-panel"><p>${
      blockedCount > 0
        ? "Hay compactos recientes, pero YouTube no permite reproducirlos dentro de esta app sin salir a una página con riesgo de spoiler."
        : "No encontré resúmenes publicados por las fuentes configuradas en las últimas 48 horas."
    }</p></div>`;
    return;
  }

  items.forEach((item, index) => {
    const durationBadge = item.duration ? `<em class="duration-badge">${item.duration}</em>` : "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "match-card";
    button.dataset.videoId = item.id;
    button.innerHTML = `
      <strong><span>${titleWithCountryFlagsHtml(item) || `Resumen ${index + 1}`}</span>${durationBadge}</strong>
      <span>${item.source || "Fuente segura"} · ${formatTime(item.publishedAt)}</span>
      <small>Play</small>
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
  refreshButton.disabled = false;
  playPauseButton.disabled = false;
  rewindButton.disabled = false;
  audioButton.disabled = false;
  togglePanelButton.disabled = false;
  playPauseButton.textContent = "Reiniciar";
  audioButton.textContent = audioEnabled ? "Audio: ON" : "Audio: OFF";
  currentSelection.innerHTML = selectedLabelHtml(item);
  playSelected();
}

function playSelected(): void {
  if (!selectedVideo) return;
  window.clearTimeout(coverTimer);
  isPlaying = true;
  playbackOffsetSeconds = 0;
  playbackStartedAt = Date.now();
  playerCover.classList.remove("is-clear");
  youtubePlayer.src = embedUrl(selectedVideo.id, true);
  coverTimer = window.setTimeout(() => {
    playerCover.classList.add("is-clear");
  }, 2600);
  playPauseButton.textContent = "Reiniciar";
}

function toggleAudio(): void {
  audioEnabled = !audioEnabled;
  audioButton.textContent = audioEnabled ? "Audio: ON" : "Audio: OFF";
  if (selectedVideo && isPlaying) {
    applyAudioPreference();
  }
}

function rewindTenSeconds(): void {
  if (!selectedVideo || !isPlaying) return;
  const elapsedSeconds = playbackOffsetSeconds + Math.floor((Date.now() - playbackStartedAt) / 1000);
  const targetSeconds = Math.max(0, elapsedSeconds - 10);
  playbackOffsetSeconds = targetSeconds;
  playbackStartedAt = Date.now();
  playerCommand("seekTo", [targetSeconds, true]);
  applyAudioPreference();
}

function toggleMatchPanel(): void {
  const collapsed = appShell.classList.toggle("is-list-collapsed");
  togglePanelButton.textContent = collapsed ? "Lista" : "Ampliar";
}

async function loadVideos(): Promise<void> {
  setStatus("Buscando partidos de las últimas 48 horas...");
  refreshButton.disabled = true;
  matchList.innerHTML = "";

  try {
    const response = await fetch("/api/videos", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as VideoResponse;
    renderList(data.items, data.blockedCount || 0);
    setStatus(
      data.items.length > 0
        ? `${data.items.length} ${data.items.length === 1 ? "partido disponible" : "partidos disponibles"}.`
        : data.blockedCount
          ? "Hay compactos recientes, pero ninguno es reproducible en modo seguro."
          : "Lista actualizada sin compactos recientes.",
      true,
    );
  } catch {
    setStatus("No pude actualizar la lista. Revisá la conexión e intentá de nuevo.");
    matchList.innerHTML = `<div class="status-panel"><p>La app necesita conexión a YouTube para cargar las fuentes configuradas.</p></div>`;
  } finally {
    refreshButton.disabled = !selectedVideo;
  }
}

refreshButton.addEventListener("click", loadVideos);
playPauseButton.addEventListener("click", playSelected);
rewindButton.addEventListener("click", rewindTenSeconds);
audioButton.addEventListener("click", toggleAudio);
togglePanelButton.addEventListener("click", toggleMatchPanel);

void loadVideos();
