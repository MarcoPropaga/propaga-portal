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

  it("o atendente de cada marca é o primeiro nome do contato de atendimento do cliente", () => {
    for (const c of Object.values(CLIENTES)) expect(c.marca.atendimento).toBe(c.atendimento.nome.split(" ")[0]);
  });
});
