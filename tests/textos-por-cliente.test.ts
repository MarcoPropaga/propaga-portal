import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* Guarda: o nome do cliente e o do atendente da Propaga não podem ficar escritos fixos nas telas, na lib e no servidor.
   Use {cliente} / {equipe} / {atendimento} (aplicarMarca) ou a marca do cliente. Pendências conhecidas abaixo. */
const PENDENTES = [
  "src/content/clientes.ts",   // configuração do cliente: aqui o nome pode estar
  "src/content/catalogos",     // catálogo da B&M Log
  "src/app/manifest.ts",       // manifest instalável: um só por site (ícone por cliente exige PNGs reais)
  "src/app/layout.tsx",        // título inicial do app (o do cliente ativo é aplicado em TemaCliente)
  "src/content/criativo",      // tabela da Mariane (criativo Propaga)
];

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("textos por cliente", () => {
  const procurar = (termo: string) => {
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
          // comentário no fim da linha de código: ignora o que vem depois de " // " fora de aspas
          const k = l.indexOf(" // ");
          const codigo = k >= 0 && [..."\"'`"].every((q) => (l.slice(0, k).split(q).length - 1) % 2 === 0) ? l.slice(0, k) : l;
          if (codigo.includes(termo) && !emComentario) achados.push(`${f}:${i + 1}`);
        });
      }
    }
    return achados;
  };

  it("nenhum 'B&M Log' fixo em string de tela, lib ou servidor", () => {
    expect(procurar("B&M Log")).toEqual([]);
  });

  it("nenhum nome do atendente ('Marcelo') fixo em string de tela, lib ou servidor", () => {
    expect(procurar("Marcelo")).toEqual([]);
  });
});
