/* Regras de preço (cláusula 4 do contrato).
   - Preço B&M = referência × 0,85, arredondado em centavos por unidade.
   - Subtotal = quantidade × preço unitário. Total = soma dos itens com preço.
   - Item sem preço (a cotar) é pendência, nunca R$ 0.
   Executar no servidor: a referência não deve chegar ao navegador do cliente. */
import type { Catalogo, ItemSolicitacao, ValoresSolicitacao } from "./tipos";

export const DESCONTO_PARCERIA = 0.15;

const centavos = (v: number) => Math.round(v * 100) / 100;

export function precoCliente(referencia: number | null): number | null {
  if (referencia == null) return null;
  return Math.round(referencia * (1 - DESCONTO_PARCERIA) * 100) / 100;
}

export function variante(cat: Catalogo, item: ItemSolicitacao) {
  const s = cat.servicos.find((x) => x.cod === item.cod);
  if (!s) throw new Error(`Serviço ${item.cod} não existe no catálogo v${cat.versao}.`);
  const v = s.variantes[item.variante];
  if (!v) throw new Error(`Variante ${item.variante} inválida para o serviço ${item.cod}.`);
  return { servico: s, variante: v };
}

export function exigeOrcamento(cat: Catalogo, item: ItemSolicitacao): boolean {
  return variante(cat, item).variante.referencia == null;
}

/** Calcula os valores de uma solicitação. `orcados[i]` = preço final B&M registrado pela Propaga. */
export function calcularValores(
  protocolo: string,
  cat: Catalogo,
  itens: ItemSolicitacao[],
  orcados: Record<number, number> = {},
): ValoresSolicitacao {
  let total = 0;
  let pendencias = 0;
  const linhas = itens.map((it, i) => {
    const base = precoCliente(variante(cat, it).variante.referencia);
    const orcado = base == null && orcados[i] != null;
    const unitario = base ?? (orcado ? centavos(orcados[i]) : null);
    if (unitario == null) {
      pendencias++;
      return { unitario: null, subtotal: null, orcado: false };
    }
    const subtotal = centavos(unitario * it.qtd);
    total = centavos(total + subtotal);
    return { unitario, subtotal, orcado };
  });
  return { protocolo, catalogoVersao: cat.versao, itens: linhas, total, pendencias };
}

/** Versão do catálogo para o cliente: sem referência interna, só preço final. */
export function catalogoPublico(cat: Catalogo) {
  return {
    ...cat,
    servicos: cat.servicos.map((s) => ({
      ...s,
      variantes: s.variantes.map(({ rotulo, modalidade, referencia }) => ({
        rotulo,
        modalidade,
        preco: precoCliente(referencia),
      })),
    })),
  };
}

export const brl = (v: number | null) =>
  v == null ? "A cotar" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
