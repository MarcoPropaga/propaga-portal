import { describe, expect, it } from "vitest";
import { CLIENTES, CLIENTE_PADRAO } from "@/content/clientes";
import { catalogoVigente } from "@/content/catalogos";
import { clientesPermitidos, escolherCliente } from "@/lib/clienteAtivo";

const todos = Object.keys(CLIENTES);

describe("cadastro de clientes", () => {
  it("cada cliente tem id coerente, prefixo único e catálogo vigente", () => {
    const prefixos = new Set<string>();
    for (const [id, c] of Object.entries(CLIENTES)) {
      expect(c.id).toBe(id);
      expect(prefixos.has(c.prefixo), `prefixo repetido: ${c.prefixo}`).toBe(false);
      prefixos.add(c.prefixo);
      const cat = catalogoVigente(id);
      expect(cat.clienteId).toBe(id);
      expect(cat.desconto).toBeGreaterThanOrEqual(0);
      expect(cat.desconto).toBeLessThan(1);
    }
  });
  it("DalPet: prospect sem desconto de catálogo (Bônus 15% é campo próprio); nada herdado da B&M Log", () => {
    expect(catalogoVigente("dalpet").desconto).toBe(0);
    expect(CLIENTES.dalpet.prefixo).toBe("DPT");
    expect(CLIENTES.dalpet.contrato).toMatchObject({ assinadoEm: null, pdfUrl: null, minuta: null });
    expect(JSON.stringify(CLIENTES.dalpet)).not.toMatch(/B&M|BML/);
  });
  it("bônus é registro do contrato: DalPet 15% por toda a vigência; B&M Log não tem", () => {
    expect(CLIENTES.dalpet.bonus).toEqual({ nome: "Bônus 15%", percentual: 15, motivo: "cliente de longa data", ate: null });
    expect(CLIENTES.dalpet.bonus!.percentual).toBeGreaterThan(0);
    expect(CLIENTES.bmlog.bonus).toBeUndefined();
  });

  it("o desconto é do contrato de cada cliente (B&M Log 15%; testes 10% e 5%)", () => {
    expect(catalogoVigente("bmlog").desconto).toBe(0.15);
    expect(catalogoVigente("pet").desconto).toBe(0.1);
    expect(catalogoVigente("varejo").desconto).toBe(0.05);
  });
  it("todos os clientes usam os mesmos serviços do molde (a tabela do criativo depende dos códigos)", () => {
    const base = catalogoVigente(CLIENTE_PADRAO).servicos.map((s) => s.cod);
    for (const id of todos) expect(catalogoVigente(id).servicos.map((s) => s.cod), id).toEqual(base);
  });
  it("os selos dos clientes existem em /public/brand", async () => {
    const { existsSync } = await import("node:fs");
    for (const c of Object.values(CLIENTES)) expect(existsSync(`public${c.marca.selo}`), c.marca.selo).toBe(true);
  });
});

describe("cliente ativo", () => {
  it("quem é do cliente fica sempre no próprio cliente", () => {
    expect(clientesPermitidos({ clienteId: "pet", propaga: false, limitado: false, vinculos: null }, todos)).toEqual(["pet"]);
    expect(clientesPermitidos({ clienteId: "inexistente", propaga: false, limitado: false, vinculos: null }, todos)).toEqual([]);
  });
  it("admin e Financeiro Propaga escolhem entre todos; atendimento, criativo e mídia só entre os vinculados", () => {
    expect(clientesPermitidos({ clienteId: null, propaga: true, limitado: false, vinculos: null }, todos)).toEqual(todos);
    expect(clientesPermitidos({ clienteId: null, propaga: true, limitado: true, vinculos: ["varejo"] }, todos)).toEqual(["varejo"]);
    expect(clientesPermitidos({ clienteId: null, propaga: true, limitado: true, vinculos: [] }, todos)).toEqual([]);
    expect(clientesPermitidos({ clienteId: null, propaga: true, limitado: true, vinculos: null }, todos)).toEqual([]); // ainda carregando
  });
  it("a escolha guardada só vale se ainda for permitida", () => {
    expect(escolherCliente(["pet", "varejo"], "varejo", "bmlog")).toBe("varejo");
    expect(escolherCliente(["pet"], "varejo", "bmlog")).toBe("pet");   // vínculo removido
    expect(escolherCliente([], "varejo", "bmlog")).toBe("bmlog");      // sem permitidos: padrão
    expect(escolherCliente(["pet", "varejo"], null, "bmlog")).toBe("pet");
  });
});

import { clienteDaLinha, nomeClienteDaLinha, situacaoDaLinha, totaisPorCliente, type LinhaCriativo } from "@/lib/criativo";
describe("relatório do criativo por cliente (textos e totais)", () => {
  const l = (protocolo: string, situacao: "aprovada" | "cancelada", valor: number, clienteId?: string) =>
    ({ chave: `${protocolo}:p`, protocolo, titulo: "", peca: "", servico: "", situacao, fechadaEm: "2026-10-01", refacoes: 0, item: "post", coluna: "nova", valor, ...(clienteId ? { clienteId } : {}) }) as LinhaCriativo;
  it("relatório antigo sem clienteId acha o cliente pelo prefixo do protocolo", () => {
    expect(clienteDaLinha(l("BML-2026-0001", "aprovada", 10))).toBe("bmlog");
    expect(nomeClienteDaLinha(l("PET-2026-0001", "aprovada", 10))).toBe("Pet Teste");
    expect(situacaoDaLinha(l("BML-2026-0001", "cancelada", 10))).toBe("Cancelada pela B&M Log");
    expect(situacaoDaLinha(l("PET-2026-0001", "cancelada", 10, "pet"))).toBe("Cancelada pela Pet Teste");
  });
  it("totais por cliente somam o cobrado (cancelada = 50%)", () => {
    expect(totaisPorCliente([l("BML-2026-0001", "aprovada", 10), l("PET-2026-0001", "cancelada", 10), l("BML-2026-0002", "aprovada", 5)]))
      .toEqual([{ nome: "B&M Log", pecas: 2, total: 15 }, { nome: "Pet Teste", pecas: 1, total: 5 }]);
  });
});
