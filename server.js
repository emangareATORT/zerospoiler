import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT || "4173", 10);
const ROOT = process.cwd();
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const CHANNELS = [
  {
    handle: "dsportsok",
    label: "DSports",
    url: "https://www.youtube.com/@dsportsok",
  },
  {
    handle: "ESPNFans",
    label: "ESPN Fans",
    url: "https://www.youtube.com/@ESPNFans",
  },
];

const channelIdCache = new Map();
let responseCache = null;
let responseCacheAt = 0;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function decodeJsonString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value.replace(/\\u0026/g, "&").replace(/\\"/g, '"');
  }
}

const COUNTRY_NAMES = [
  "Afganistán",
  "Albania",
  "Alemania",
  "Andorra",
  "Angola",
  "Arabia Saudita",
  "Argelia",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaiyán",
  "Bahamas",
  "Baréin",
  "Bélgica",
  "Belice",
  "Bolivia",
  "Bosnia y Herzegovina",
  "Brasil",
  "Bulgaria",
  "Cabo Verde",
  "Camerún",
  "Canadá",
  "Chile",
  "China",
  "Colombia",
  "Corea del Sur",
  "Costa Rica",
  "Croacia",
  "Cuba",
  "Dinamarca",
  "Ecuador",
  "Egipto",
  "El Salvador",
  "Emiratos Árabes Unidos",
  "Escocia",
  "Eslovaquia",
  "Eslovenia",
  "España",
  "Estados Unidos",
  "Finlandia",
  "Francia",
  "Gales",
  "Georgia",
  "Ghana",
  "Grecia",
  "Guatemala",
  "Haití",
  "Honduras",
  "Hungría",
  "Inglaterra",
  "Irán",
  "Irak",
  "Irlanda",
  "Islandia",
  "Israel",
  "Italia",
  "Jamaica",
  "Japón",
  "Jordania",
  "Marruecos",
  "México",
  "Nigeria",
  "Noruega",
  "Nueva Zelanda",
  "Países Bajos",
  "Panamá",
  "Paraguay",
  "Perú",
  "Polonia",
  "Portugal",
  "Qatar",
  "República Checa",
  "República Dominicana",
  "Rumania",
  "Senegal",
  "Serbia",
  "Suecia",
  "Suiza",
  "Túnez",
  "Turquía",
  "Ucrania",
  "Uruguay",
  "Venezuela",
];

const COUNTRY_FLAGS = {
  Afganistán: "🇦🇫",
  Albania: "🇦🇱",
  Alemania: "🇩🇪",
  Andorra: "🇦🇩",
  Angola: "🇦🇴",
  "Arabia Saudita": "🇸🇦",
  Argelia: "🇩🇿",
  Argentina: "🇦🇷",
  Armenia: "🇦🇲",
  Australia: "🇦🇺",
  Austria: "🇦🇹",
  Azerbaiyán: "🇦🇿",
  Bahamas: "🇧🇸",
  Baréin: "🇧🇭",
  Bélgica: "🇧🇪",
  Belice: "🇧🇿",
  Bolivia: "🇧🇴",
  "Bosnia y Herzegovina": "🇧🇦",
  Brasil: "🇧🇷",
  Bulgaria: "🇧🇬",
  "Cabo Verde": "🇨🇻",
  Camerún: "🇨🇲",
  Canadá: "🇨🇦",
  Chile: "🇨🇱",
  China: "🇨🇳",
  Colombia: "🇨🇴",
  "Corea del Sur": "🇰🇷",
  "Costa Rica": "🇨🇷",
  Croacia: "🇭🇷",
  Cuba: "🇨🇺",
  Dinamarca: "🇩🇰",
  Ecuador: "🇪🇨",
  Egipto: "🇪🇬",
  "El Salvador": "🇸🇻",
  "Emiratos Árabes Unidos": "🇦🇪",
  Escocia: "🏴",
  Eslovaquia: "🇸🇰",
  Eslovenia: "🇸🇮",
  España: "🇪🇸",
  "Estados Unidos": "🇺🇸",
  Finlandia: "🇫🇮",
  Francia: "🇫🇷",
  Gales: "🏴",
  Georgia: "🇬🇪",
  Ghana: "🇬🇭",
  Grecia: "🇬🇷",
  Guatemala: "🇬🇹",
  Haití: "🇭🇹",
  Honduras: "🇭🇳",
  Hungría: "🇭🇺",
  Inglaterra: "🏴",
  Irán: "🇮🇷",
  Irak: "🇮🇶",
  Irlanda: "🇮🇪",
  Islandia: "🇮🇸",
  Israel: "🇮🇱",
  Italia: "🇮🇹",
  Jamaica: "🇯🇲",
  Japón: "🇯🇵",
  Jordania: "🇯🇴",
  Marruecos: "🇲🇦",
  México: "🇲🇽",
  Nigeria: "🇳🇬",
  Noruega: "🇳🇴",
  "Nueva Zelanda": "🇳🇿",
  "Países Bajos": "🇳🇱",
  Panamá: "🇵🇦",
  Paraguay: "🇵🇾",
  Perú: "🇵🇪",
  Polonia: "🇵🇱",
  Portugal: "🇵🇹",
  Qatar: "🇶🇦",
  "República Checa": "🇨🇿",
  "República Dominicana": "🇩🇴",
  Rumania: "🇷🇴",
  Senegal: "🇸🇳",
  Serbia: "🇷🇸",
  Suecia: "🇸🇪",
  Suiza: "🇨🇭",
  Túnez: "🇹🇳",
  Turquía: "🇹🇷",
  Ucrania: "🇺🇦",
  Uruguay: "🇺🇾",
  Venezuela: "🇻🇪",
};

function normalizeForMatch(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

const COUNTRY_MATCHERS = COUNTRY_NAMES.map((name) => ({
  name,
  normalized: normalizeForMatch(name),
}));

function countryMatchesForText(value) {
  const normalizedTitle = normalizeForMatch(decodeEntities(value));
  const matches = COUNTRY_MATCHERS
    .map((country) => ({
      name: country.name,
      index: normalizedTitle.search(new RegExp(`\\b${country.normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)),
    }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index);

  const unique = [];
  for (const match of matches) {
    if (!unique.includes(match.name)) unique.push(match.name);
    if (unique.length === 2) break;
  }

  return unique;
}

function extractCountries(title) {
  const decodedTitle = decodeEntities(title);
  const titleSegments = decodedTitle.split(/\s*[|¦]\s*/);
  const scoreSegment = titleSegments.find((segment) => /\b\d+\s*[-–]\s*\d+\b/.test(segment));
  const scoreCountries = scoreSegment ? countryMatchesForText(scoreSegment) : [];

  return scoreCountries.length >= 2 ? scoreCountries : countryMatchesForText(decodedTitle);
}

function stripSpoilers(title) {
  const countries = extractCountries(title);
  return countries.length >= 2 ? `${countries[0]} vs ${countries[1]}` : "Partido";
}

function getCountryDetails(title) {
  return extractCountries(title).map((name) => ({
    name,
    flag: COUNTRY_FLAGS[name] || "",
  }));
}

function titleMatchesRequiredSummary(title) {
  return /\bresumen\b/i.test(decodeEntities(title));
}

function hasTwoCountries(title) {
  return extractCountries(title).length >= 2;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 ZeroSpoiler/1.0",
      "Accept-Language": "es-UY,es;q=0.9,en;q=0.6",
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo leer ${url}: ${response.status}`);
  }

  return response.text();
}

function parseRelativePublishTime(value) {
  const text = normalizeForMatch(value);
  const amount = Number(text.match(/\d+/)?.[0] || "1");
  let ageMs = null;

  if (/SEGUNDO/.test(text)) ageMs = amount * 1000;
  if (/MINUTO/.test(text)) ageMs = amount * 60 * 1000;
  if (/HORA/.test(text)) ageMs = amount * 60 * 60 * 1000;
  if (/DIA/.test(text)) ageMs = amount * 24 * 60 * 60 * 1000;

  if (ageMs === null || ageMs > RECENT_WINDOW_MS) return null;
  return new Date(Date.now() - ageMs).toISOString();
}

function parseDurationFromChunk(chunk) {
  const rawText =
    chunk.match(/"thumbnailBadgeViewModel":\{"text":"([0-9:]+)"/)?.[1] ||
    chunk.match(/"text":"([0-9:]+)","badgeStyle":"THUMBNAIL_OVERLAY_BADGE_STYLE_DEFAULT"/)?.[1] ||
    "";

  return /^\d{1,2}(?::\d{2}){1,2}$/.test(rawText) ? rawText : null;
}

function formatDurationFromSeconds(value) {
  const totalSeconds = Number(value);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function fetchVideoDuration(videoId) {
  try {
    const html = await fetchText(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=es&gl=UY`);
    const seconds =
      html.match(/"lengthSeconds":"(\d+)"/)?.[1] ||
      html.match(/"approxDurationMs":"(\d+)"/)?.[1]?.replace(/\d{3}$/, "");
    return formatDurationFromSeconds(seconds);
  } catch {
    return null;
  }
}

async function resolveChannelId(channel) {
  if (channelIdCache.has(channel.handle)) return channelIdCache.get(channel.handle);

  const html = await fetchText(`${channel.url}/videos?hl=es&gl=UY`);
  const match =
    html.match(/"channelId":"(UC[^"]+)"/) ||
    html.match(/"externalId":"(UC[^"]+)"/) ||
    html.match(/itemprop="channelId"\s+content="(UC[^"]+)"/);

  if (!match) {
    throw new Error(`No se pudo resolver el canal ${channel.label}.`);
  }

  channelIdCache.set(channel.handle, match[1]);
  return match[1];
}

function parseFeed(xml, channel) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((entryMatch) => {
    const entry = entryMatch[1];
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || "";
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] || "";

    return {
      id,
      originalTitle: decodeEntities(title),
      safeTitle: stripSpoilers(title),
      countries: getCountryDetails(title),
      publishedAt,
      duration: null,
      source: channel.label,
    };
  });

  const cutoff = Date.now() - RECENT_WINDOW_MS;
  return entries.filter(
    (item) =>
      item.id &&
      item.publishedAt &&
      new Date(item.publishedAt).getTime() >= cutoff &&
      titleMatchesRequiredSummary(item.originalTitle) &&
      hasTwoCountries(item.originalTitle),
  );
}

function parseChannelPage(html, channel) {
  const chunks = html.split('{"richItemRenderer"').slice(1);
  const items = [];

  for (const chunk of chunks) {
    const id = chunk.match(/"videoId":"([^"]+)"/)?.[1] || "";
    const titleRaw = chunk.match(/"title":\{"content":"((?:\\.|[^"\\])+)"/)?.[1] || "";
    const relativeTimeRaw =
      chunk.match(/"accessibilityLabel":"(hace [^"]+)"/i)?.[1] ||
      chunk.match(/"content":"(hace [^"]+)"/i)?.[1] ||
      "";
    const title = decodeJsonString(titleRaw);
    const publishedAt = parseRelativePublishTime(decodeJsonString(relativeTimeRaw));
    const duration = parseDurationFromChunk(chunk);

    if (!id || !title || !publishedAt || !titleMatchesRequiredSummary(title) || !hasTwoCountries(title)) continue;

    items.push({
      id,
      originalTitle: title,
      safeTitle: stripSpoilers(title),
      countries: getCountryDetails(title),
      publishedAt,
      duration,
      source: channel.label,
    });
  }

  return items;
}

async function isEmbeddable(videoId) {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;

  try {
    const response = await fetch(oembedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 ZeroSpoiler/1.0",
        "Accept-Language": "es-UY,es;q=0.9,en;q=0.6",
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function getChannelVideos(channel) {
  const channelId = await resolveChannelId(channel);
  const [xml, pageHtml] = await Promise.all([
    fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`),
    fetchText(`${channel.url}/videos?hl=es&gl=UY`),
  ]);
  const byId = new Map();

  for (const item of parseChannelPage(pageHtml, channel)) {
    byId.set(item.id, item);
  }

  for (const item of parseFeed(xml, channel)) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? { ...item, duration: existing.duration || item.duration } : item);
  }

  const recentItems = [...byId.values()];
  const checkedItems = await Promise.all(
    recentItems.map(async (item) => ({
      item,
      embeddable: await isEmbeddable(item.id),
    })),
  );
  const playableItems = checkedItems.filter((entry) => entry.embeddable).map((entry) => entry.item);

  await Promise.all(
    playableItems.map(async (item) => {
      if (!item.duration) item.duration = await fetchVideoDuration(item.id);
    }),
  );

  return {
    checkedItems,
    items: playableItems
      .map((item) => {
        const { originalTitle, ...safeItem } = item;
        return safeItem;
      }),
  };
}

async function getVideos() {
  if (responseCache && Date.now() - responseCacheAt < 5 * 60 * 1000) {
    return responseCache;
  }

  const channelResults = await Promise.all(CHANNELS.map(getChannelVideos));
  const checkedItems = channelResults.flatMap((result) => result.checkedItems);
  const items = channelResults
    .flatMap((result) => result.items)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  responseCache = {
    sources: CHANNELS.map(({ label, url }) => ({ label, url })),
    generatedAt: new Date().toISOString(),
    items,
    blockedCount: checkedItems.length - items.length,
  };
  responseCacheAt = Date.now();
  return responseCache;
}

async function serveFile(req, res) {
  const requestedPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const filePath = requestedPath === "/" ? "/index.html" : requestedPath;
  const safePath = normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = join(ROOT, safePath);
  const ext = extname(absolutePath);
  const content = await readFile(absolutePath);
  send(res, 200, content, mimeTypes[ext] || "application/octet-stream");
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url || !req.method || !["GET", "HEAD"].includes(req.method)) {
      send(res, 405, "Método no permitido");
      return;
    }

    const path = new URL(req.url, `http://${req.headers.host}`).pathname;

    if (path === "/api/videos") {
      const videos = await getVideos();
      send(res, 200, JSON.stringify(videos), "application/json; charset=utf-8");
      return;
    }

    await serveFile(req, res);
  } catch (error) {
    const status = error.code === "ENOENT" ? 404 : 500;
    const message = status === 404 ? "No encontrado" : "No se pudo completar la operación.";
    send(res, status, message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Zero Spoiler listo en http://${HOST}:${PORT}`);
});
