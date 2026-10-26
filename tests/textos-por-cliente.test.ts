import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* Guarda: o nome do cliente não pode ficar escrito fixo nas telas, na lib e no servidor.
   Use {cliente} / {equipe} (aplicarMarca) ou a marca do cliente. Pendências conhecidas abaixo. */
const PENDENTES = [
  "src/content/clientes.ts",   // configuração do cliente: aqui o nome pode estar
  "src/content/catalogos",     // catálogo da B&M Log
  "src/app/manifest.ts",       // manifest por cliente: próxima fatia
  "src/app/layout.tsx",        // título do app na tela inicial: próxima fatia
  "apps-script/src/emails.ts", // cores e nome nos e-mails: próxima fatia
];

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("textos por cliente", () => {
  it("nenhum 'B&M Log' fixo em string de tela, lib ou servidor", () => {
    const achados: string[] = [];
    for (const raiz of ["src", "apps-script/src"]) {
      for (const f of arquivos(raiz)) {
        if (PENDENTES.some((p) => f.startsWith(p))) continue;
        let bloco = false; // dentro de /* ... */
        readFileSync(f, "utf8").split("\n").forEach((l, i) => {
          const t = l.trim();
          const emComentario = bloco || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
          if (t.includes("/*") && !t.includes("*/")) bloco = true;
          if (t.includes("*/")) bloco = false;
          if (l.includes("B&M Log") && !emComentario) achados.push(`${f}:${i + 1}`);
        });
      }
    }
    expect(achados).toEqual([]);
  });
});
