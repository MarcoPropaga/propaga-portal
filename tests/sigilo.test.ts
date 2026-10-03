/* Garante que o catálogo com valores de referência nunca entra no código público do site. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("sigilo dos valores de referência", () => {
  it("nenhuma página, componente ou módulo do navegador importa os catálogos internos", () => {
    const publicos = [...arquivos("src/app"), ...arquivos("src/components"), "src/content/clientes.ts",
      ...arquivos("src/lib")];
    const culpados = publicos.filter((f) => /from\s+["'][^"']*content\/catalogos/.test(readFileSync(f, "utf8")));
    expect(culpados).toEqual([]);
  });
});
