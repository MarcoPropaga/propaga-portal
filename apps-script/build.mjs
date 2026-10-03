// Gera apps-script/dist: Codigo.js (bundle) + Entrada.gs + appsscript.json, prontos para colar ou enviar com clasp.
import { build } from "esbuild";
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(aqui, "dist");
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [path.join(aqui, "src/index.ts")],
  bundle: true,
  format: "iife",
  globalName: "PortalServidor",
  platform: "neutral",
  target: "es2019",
  outfile: path.join(dist, "Codigo.js"),
  alias: { "@": path.join(aqui, "..", "src") },
  mainFields: ["module", "main"],
  legalComments: "none",
  minify: true,
  treeShaking: true,
  logLevel: "warning",
});

// Apps Script carrega arquivos em ordem alfabética: o bundle (Codigo) antes da Entrada.
const cab = `// Portal Propaga — servidor. Gerado em ${new Date().toISOString()} por apps-script/build.mjs. Não editar.\n`;
writeFileSync(path.join(dist, "Codigo.js"), cab + readFileSync(path.join(dist, "Codigo.js"), "utf8"));
copyFileSync(path.join(aqui, "entrada.gs"), path.join(dist, "Entrada.gs"));
copyFileSync(path.join(aqui, "appsscript.json"), path.join(dist, "appsscript.json"));
console.log("apps-script/dist pronto");
