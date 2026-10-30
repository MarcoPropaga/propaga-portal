/* Regras de preço (cláusula 4 do contrato).
   - Preço do cliente = referência × (1 − desconto do contrato), arredondado em centavos por unidade.
     O desconto é campo do contrato de cada cliente (Catalogo.desconto); B&M Log = 15%.
   - Subtotal = quantidade × preço unitário. Total = soma dos itens com preço.
   - Item sem preço (a cotar) é pendência, nunca R$ 0.
   Executar no servidor: a referência não deve chegar ao navegador do cliente. */
import type { Catalogo, ItemSolicitacao, ValoresSolicitacao } from "./tipos";

const centavos = (v: number) => Math.round(v * 100) / 100;

export function precoCliente(referencia: number | null, desconto: number): number | null {
  if (!Number.isFinite(desconto) || desconto < 0 || desconto >= 1) throw new Error(`Desconto do contrato inválido: ${desconto}.`);
  if (referencia == null) return null;
  return Math.round(referencia * (1 - desconto) * 100) / 100;
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
    const base = precoCliente(variante(cat, it).variante.referencia, cat.desconto);
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

/** Versão do catálogo para o cliente: sem referência interna, só preço final.
    `teste`: prospect em avaliação de 48 h. Só os Jobs liberados no teste, sem nenhum preço (`semValores`). */
export function catalogoPublico(cat: Catalogo, teste?: { servicos: string[] }) {
  if (teste) {
    const servicos = cat.servicos.filter((s) => teste.servicos.includes(s.cod));
    return {
      ...cat, desconto: 0, semValores: true as const,
      categorias: cat.categorias.filter((c) => servicos.some((s) => s.categoria === c.id)),
      servicos: servicos.map((s) => ({ ...s, variantes: s.variantes.map(({ rotulo, modalidade }) => ({ rotulo, modalidade, preco: null })) })),
    };
  }
  return {
    ...cat,
    servicos: cat.servicos.map((s) => ({
      ...s,
      variantes: s.variantes.map(({ rotulo, modalidade, referencia }) => ({
        rotulo,
        modalidade,
        preco: precoCliente(referencia, cat.desconto),
      })),
    })),
  };
}

export const brl = (v: number | null) =>
  v == null ? "A cotar" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
