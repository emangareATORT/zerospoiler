import { createWriteStream } from "node:fs";
import { access, chmod, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const nodeVersion = process.env.WINDOWS_NODE_VERSION || process.version.slice(1);
const nodePackage = `node-v${nodeVersion}-win-x64`;
const downloadUrl = `https://nodejs.org/dist/v${nodeVersion}/${nodePackage}.zip`;
const cacheDir = ".cache";
const distDir = "dist";
const packageName = "Zero Spoiler Windows x64";
const packageDir = `${distDir}/${packageName}`;
const zipPath = `${distDir}/${packageName}.zip`;
const nodeZipPath = `${cacheDir}/${basename(downloadUrl)}`;
const extractDir = `${cacheDir}/${nodePackage}`;

async function downloadFile(url, targetPath) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ZeroSpoilerPackager/1.0",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar ${url}: ${response.status}`);
  }

  const file = createWriteStream(targetPath);
  await new Promise((resolve, reject) => {
    response.body.pipeTo(
      new WritableStream({
        write(chunk) {
          file.write(chunk);
        },
        close() {
          file.end(resolve);
        },
        abort(error) {
          file.destroy(error);
          reject(error);
        },
      }),
    );
  });
}

await mkdir(cacheDir, { recursive: true });
await mkdir(distDir, { recursive: true });
await rm(packageDir, { recursive: true, force: true });
await rm(zipPath, { force: true });

try {
  await access(nodeZipPath);
} catch {
  console.log(`Descargando ${downloadUrl}`);
  await downloadFile(downloadUrl, nodeZipPath);
}

await rm(extractDir, { recursive: true, force: true });
await execFileAsync("ditto", ["-x", "-k", nodeZipPath, cacheDir]);

await mkdir(packageDir, { recursive: true });
await cp(`${extractDir}/node.exe`, `${packageDir}/node.exe`);
await cp("zero-spoiler-single.js", `${packageDir}/zero-spoiler-single.js`);

await writeFile(
  `${packageDir}/Iniciar Zero Spoiler.cmd`,
  `@echo off\r
setlocal\r
cd /d "%~dp0"\r
set PORT=4173\r
start "" "http://127.0.0.1:%PORT%"\r
node.exe zero-spoiler-single.js\r
pause\r
`,
  "utf8",
);

await writeFile(
  `${packageDir}/LEEME.txt`,
  `Zero Spoiler para Windows\r
\r
1. Hacé doble click en "Iniciar Zero Spoiler.cmd".\r
2. Se abrirá el navegador en http://127.0.0.1:4173\r
3. Mantené abierta la ventana negra mientras uses la app.\r
\r
No necesitás instalar Node.js: este paquete ya incluye node.exe.\r
La app necesita conexión a internet para leer las fuentes autorizadas de YouTube.\r
`,
  "utf8",
);

await chmod(`${packageDir}/Iniciar Zero Spoiler.cmd`, 0o755);
await execFileAsync("zip", ["-r", "-X", `${packageName}.zip`, packageName], {
  cwd: distDir,
});

console.log(`Paquete creado: ${packageDir}`);
console.log(`ZIP creado: ${zipPath}`);
