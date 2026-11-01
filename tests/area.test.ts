import { describe, expect, it } from "vitest";
import { areaDe } from "@/lib/area";
import { MARCA_PROPAGA } from "@/content/clientes";
import { validarMarca } from "@/lib/tema";

describe("área Propaga x portal do cliente", () => {
  it("admin nas páginas da Propaga fica na área Propaga", () => {
    for (const c of ["/propaga/", "/admin/prospeccao/", "/admin/usuarios/", "/criativo/pagamentos/", "/criativo/visao/", "/criativo/tabela/"])
      expect(areaDe("admin", c)).toBe("propaga");
  });
  it("admin nas páginas de cliente fica no portal do cliente", () => {
    for (const c of ["/inicio/", "/solicitacoes/", "/contrato/", "/empresa/"]) expect(areaDe("admin", c)).toBe("cliente");
  });
  it("quem não é admin nunca vê a área Propaga", () => {
    for (const p of ["atendimento", "criativo", "financeiro_propaga", "solicitante"] as const)
      expect(areaDe(p, "/propaga/")).toBe("cliente");
    expect(areaDe(null, "/propaga/")).toBe("cliente");
  });
  it("marca da Propaga passa no contraste AA", () => {
    expect(validarMarca(MARCA_PROPAGA)).toEqual([]);
  });
});
