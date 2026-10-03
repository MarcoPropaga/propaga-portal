import { describe, it, expect } from "vitest";
import { catalogoBmlogV1 as cat } from "@/content/catalogos/bmlog-v1.0";
import { precoCliente, calcularValores, catalogoPublico, exigeOrcamento } from "@/lib/precos";
import { acoesDisponiveis, aplicar, fatorCobranca, podeExecutar } from "@/lib/fluxo";
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

describe("fluxo do pedido (decisão de 03/10: sem aceite do cliente)", () => {
  const ctx = { rodadas: 0 };
  it("Atendimento aceita o pedido e ele vai direto para produção", () => {
    expect(aplicar("aceitarPedido", "enviada", "atendimento", ctx)).toBe("producao");
    expect(podeExecutar("aceitarPedido", "enviada", "solicitante", ctx)).toBe(false);
    expect(podeExecutar("aceitarPedido", "enviada", "financeiro_cliente", ctx)).toBe(false);
  });
  it("Financeiro do cliente não executa nenhuma ação", () => {
    for (const s of ["enviada", "producao", "apresentacao", "aprovada", "entregue", "faturada"] as const) {
      expect(acoesDisponiveis(s, "financeiro_cliente", ctx)).toEqual([]);
    }
  });
  it("versão → ajustes (até 2 rodadas) ou aprovação", () => {
    expect(aplicar("disponibilizarVersao", "producao", "atendimento", ctx)).toBe("apresentacao");
    expect(aplicar("pedirAjustes", "apresentacao", "solicitante", { rodadas: 1 })).toBe("producao");
    // 3ª refação em diante é permitida (sujeita a +30%).
    expect(podeExecutar("pedirAjustes", "apresentacao", "solicitante", { rodadas: 2 })).toBe(true);
    expect(aplicar("aprovar", "apresentacao", "solicitante", ctx)).toBe("aprovada");
  });
  it("entrega, recebimento (uma vez), faturamento e pagamento", () => {
    expect(aplicar("entregar", "aprovada", "atendimento", ctx)).toBe("entregue");
    expect(aplicar("confirmarRecebimento", "entregue", "solicitante", ctx)).toBe("entregue");
    expect(podeExecutar("confirmarRecebimento", "entregue", "solicitante", { rodadas: 0, recebidoPeloCliente: true })).toBe(false);
    expect(aplicar("faturar", "entregue", "financeiro_propaga", ctx)).toBe("faturada");
    expect(aplicar("registrarPagamento", "faturada", "financeiro_propaga", ctx)).toBe("paga");
  });
  it("cancelamento: solicitante e atendimento só antes da produção; admin até a aprovação", () => {
    expect(podeExecutar("cancelar", "enviada", "solicitante", ctx)).toBe(true);
    expect(podeExecutar("cancelar", "producao", "solicitante", ctx)).toBe(false);
    expect(podeExecutar("cancelar", "producao", "atendimento", ctx)).toBe(false);
    expect(podeExecutar("cancelar", "apresentacao", "solicitante", ctx)).toBe(true);
    expect(podeExecutar("cancelar", "apresentacao", "atendimento", ctx)).toBe(false);
    expect(podeExecutar("cancelar", "aprovada", "admin", ctx)).toBe(true);
    expect(podeExecutar("cancelar", "entregue", "admin", ctx)).toBe(false);
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

describe("cobrança (Marco, 03/10)", () => {
  it("refação extra soma 30%; cancelado após apresentação cobra 50%; antes, nada", () => {
    expect(fatorCobranca({ status: "entregue" })).toBe(1);
    expect(fatorCobranca({ status: "entregue", refacoesExtrasCobradas: 2 })).toBeCloseTo(1.6);
    expect(fatorCobranca({ status: "cancelada", versao: 1 })).toBe(0.5);
    expect(fatorCobranca({ status: "cancelada", versao: 0 })).toBe(0);
  });
});
