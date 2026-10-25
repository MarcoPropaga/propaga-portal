import { describe, it, expect } from "vitest";
import { HABILIDADES } from "@/content/habilidades";
import { catalogoBmlogV1 } from "@/content/catalogos/bmlog-v1.0";
import { habilidadeDoServico, nivelParaServico } from "@/lib/habilidades";

describe("habilidades do criativo × catálogo B&M Log", () => {
  it("todo serviço do catálogo pertence a exatamente uma habilidade", () => {
    for (const s of catalogoBmlogV1.servicos) {
      const donas = HABILIDADES.filter((h) => h.servicos.includes(s.cod));
      expect(donas.length, `serviço ${s.cod} ${s.nome}`).toBe(1);
    }
  });
  it("nenhuma habilidade aponta para serviço inexistente; as de fora do catálogo não têm serviços", () => {
    const cods = new Set(catalogoBmlogV1.servicos.map((s) => s.cod));
    for (const h of HABILIDADES) {
      for (const c of h.servicos) expect(cods.has(c), `${h.id} → ${c}`).toBe(true);
      if (!h.noCatalogo) expect(h.servicos).toEqual([]);
    }
    expect(new Set(HABILIDADES.map((h) => h.id)).size).toBe(HABILIDADES.length);
  });
  it("12 habilidades no catálogo e 4 fora", () => {
    expect(HABILIDADES.filter((h) => h.noCatalogo)).toHaveLength(12);
    expect(HABILIDADES.filter((h) => !h.noCatalogo)).toHaveLength(4);
  });
  it("nível do criativo para um serviço: primária, secundária ou nenhum", () => {
    const p = { primarias: ["redes-estaticas"], secundarias: ["impressos"], confirmado: true };
    expect(habilidadeDoServico("01")).toBe("redes-estaticas");
    expect(nivelParaServico(p, "01")).toBe("primaria");
    expect(nivelParaServico(p, "24")).toBe("secundaria");
    expect(nivelParaServico(p, "32")).toBeNull();
    expect(nivelParaServico(undefined, "01")).toBeNull();
  });
});
