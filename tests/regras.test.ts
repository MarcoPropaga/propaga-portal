import { describe, it, expect } from "vitest";
import { catalogoBmlogV1 as cat } from "@/content/catalogos/bmlog-v1.0";
import { precoCliente, calcularValores, catalogoPublico, exigeOrcamento } from "@/lib/precos";
import { aplicar, podeExecutar } from "@/lib/fluxo";
import { somarDiasUteis } from "@/lib/datas";
import { solicitacaoSchema } from "@/lib/schemas";

describe("catálogo B&M Log v1.0", () => {
  it("tem 68 serviços e nenhum Post+ ou Booth China", () => {
    expect(cat.servicos).toHaveLength(68);
    expect(cat.servicos.some((s) => /Post\+|Booth China/.test(s.nome))).toBe(false);
  });
  it("códigos únicos", () => {
    expect(new Set(cat.servicos.map((s) => s.cod)).size).toBe(cat.servicos.length);
  });
  it("item 21 motion 16–30 s é a cotar", () => {
    const s = cat.servicos.find((x) => x.cod === "21")!;
    expect(s.variantes.find((v) => v.rotulo.includes("16 a 30"))!.referencia).toBeNull();
  });
});

describe("preços (cláusula 4)", () => {
  it("aplica 15% e arredonda em centavos", () => {
    expect(precoCliente(350)).toBe(297.5);
    expect(precoCliente(200)).toBe(170);
    expect(precoCliente(null)).toBeNull();
  });
  it("a cotar vira pendência, não R$ 0; orçamento entra no total", () => {
    const itens = [{ cod: "21", variante: 2, qtd: 1 }, { cod: "24", variante: 0, qtd: 3 }];
    const sem = calcularValores("X", cat, itens);
    expect(sem.total).toBe(892.5);
    expect(sem.pendencias).toBe(1);
    const com = calcularValores("X", cat, itens, { 0: 680 });
    expect(com.total).toBe(1572.5);
    expect(com.pendencias).toBe(0);
    expect(com.itens[0].orcado).toBe(true);
  });
  it("catálogo público não expõe a referência interna", () => {
    expect(JSON.stringify(catalogoPublico(cat))).not.toContain("referencia");
  });
  it("detecta item que exige orçamento", () => {
    expect(exigeOrcamento(cat, { cod: "21", variante: 2, qtd: 1 })).toBe(true);
    expect(exigeOrcamento(cat, { cod: "24", variante: 0, qtd: 1 })).toBe(false);
  });
});

describe("fluxo do pedido", () => {
  const ctx = { temOrcamento: false, rodadas: 0 };
  it("só catálogo: cronograma confirmado vai direto para produção", () => {
    expect(aplicar("confirmarCronograma", "validacao", "atendimento", ctx)).toBe("producao");
  });
  it("com orçamento: vai para aceite do financeiro do cliente", () => {
    expect(aplicar("confirmarCronograma", "validacao", "atendimento", { ...ctx, temOrcamento: true })).toBe("aceite");
    expect(podeExecutar("aceitarOrcamento", "aceite", "financeiro_cliente", ctx)).toBe(true);
    expect(podeExecutar("aceitarOrcamento", "aceite", "admin", ctx)).toBe(false);
    expect(podeExecutar("aceitarOrcamento", "aceite", "solicitante", ctx)).toBe(false);
  });
  it("limita a 2 rodadas de ajuste", () => {
    expect(podeExecutar("pedirAjustes", "apresentacao", "solicitante", { ...ctx, rodadas: 2 })).toBe(false);
  });
  it("solicitante não cancela depois da produção", () => {
    expect(podeExecutar("cancelar", "producao", "solicitante", ctx)).toBe(false);
    expect(podeExecutar("cancelar", "producao", "admin", ctx)).toBe(true);
  });
  it("bloqueia ação fora do perfil", () => {
    expect(() => aplicar("faturar", "entregue", "solicitante", ctx)).toThrow();
  });
});

describe("prazo", () => {
  it("5 dias úteis pulando fim de semana e feriado de 12/10", () => {
    expect(somarDiasUteis("2026-10-08", 5)).toBe("2026-10-16");
  });
});

describe("validação da solicitação", () => {
  const ok = {
    titulo: "Campanha", unidade: "Matriz · Itajaí/SC", email: "marketing@bmlog.com.br", objetivo: "Reforçar",
    publico: "Ambos os públicos", itens: [{ cod: "24", variante: 0, qtd: 1, opcao: "A5" }],
    drive: { link: "https://drive.google.com/drive/folders/abc123", conferido: true as const }, obs: "",
    prazo: { desejada: "2026-10-20", urgente: false }, conferido: true as const,
  };
  it("aceita pedido completo", () => expect(solicitacaoSchema.safeParse(ok).success).toBe(true));
  it("recusa link que não é do Drive", () => {
    const r = solicitacaoSchema.safeParse({ ...ok, drive: { ...ok.drive, link: "https://exemplo.com" } });
    expect(r.success).toBe(false);
  });
});
