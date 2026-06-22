import { readFile, writeFile } from "node:fs/promises";

const outputPath = "zero-spoiler-single.js";

const [serverSource, html, css, client] = await Promise.all([
  readFile("server.js", "utf8"),
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("app.js", "utf8"),
]);

const embeddedHtml = html
  .replace('<link rel="stylesheet" href="/styles.css" />', "<style>${CSS}</style>")
  .replace('<script src="/app.js" defer></script>', "<script>${CLIENT}</script>");

const assetsBlock = `const EMBEDDED_HTML = ${JSON.stringify(embeddedHtml)};\nconst EMBEDDED_CSS = ${JSON.stringify(css)};\nconst EMBEDDED_CLIENT = ${JSON.stringify(client)};\n`;

const standalone = serverSource
  .replace('import { readFile } from "node:fs/promises";\n', "")
  .replace('import { extname, join, normalize } from "node:path";\n', "")
  .replace('const ROOT = process.cwd();\n', "")
  .replace("const ONE_DAY_MS = 24 * 60 * 60 * 1000;\n", `const ONE_DAY_MS = 24 * 60 * 60 * 1000;\n${assetsBlock}`)
  .replace(
    /async function serveFile\(req, res\) \{[\s\S]*?\n\}\n\nconst server = createServer/,
    `async function serveFile(req, res) {
  const requestedPath = new URL(req.url, \`http://\${req.headers.host}\`).pathname;

  if (requestedPath === "/" || requestedPath === "/index.html") {
    send(
      res,
      200,
      EMBEDDED_HTML.replace("$" + "{CSS}", EMBEDDED_CSS).replace("$" + "{CLIENT}", EMBEDDED_CLIENT),
      "text/html; charset=utf-8",
    );
    return;
  }

  if (requestedPath === "/styles.css") {
    send(res, 200, EMBEDDED_CSS, "text/css; charset=utf-8");
    return;
  }

  if (requestedPath === "/app.js") {
    send(res, 200, EMBEDDED_CLIENT, "text/javascript; charset=utf-8");
    return;
  }

  const error = new Error("No encontrado");
  error.code = "ENOENT";
  throw error;
}

const server = createServer`,
  );

await writeFile(
  outputPath,
  `#!/usr/bin/env node\n${standalone}`,
  "utf8",
);

console.log(`Archivo creado: ${outputPath}`);
