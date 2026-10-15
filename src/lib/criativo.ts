/* Relatório mensal do criativo (Mariane) — decisões de Marco, 15/10/2026.
   - Os valores vêm da tabela da Mariane (documento criativo/tabela), não da tabela da Propaga.
   - Entra no mês a peça fechada nele: aprovada com arquivo final (concluída) ou cancelada pela B&M Log.
   - Peça cancelada entra com o valor cheio da tabela; refações aparecem como observação, sem valor extra.
   - O portal sugere o item pelo serviço escolhido pelo Marcelo; a Mariane confere, pode trocar o item
     e informa o valor dos itens "sob consulta". O servidor recalcula tudo antes de gravar.
   Mesmo módulo no navegador e no servidor; não contém valores. */
import { hojeSP } from "./datas";
import type { Peca } from "./pecas";

export type Coluna = "adaptacao" | "nova";
export const NOME_COLUNA: Record<Coluna, string> = { adaptacao: "Adaptação", nova: "Nova criação" };

export interface ItemTabelaCriativo { id: string; nome: string; adaptacao: number | null; nova: number | null; sobConsulta?: boolean; obs?: string }
export interface TabelaCriativo {
  versao: string; nome: string; itens: ItemTabelaCriativo[];
  /** "cod:índice da variante" → sugestão. */
  mapa: Record<string, { item: string; coluna: Coluna }>;
}

export interface LinhaCriativo {
  chave: string;              // protocolo:idPeça
  protocolo: string; titulo: string; peca: string;
  servico: string;            // serviço da Propaga (sem valor)
  situacao: "aprovada" | "cancelada";
  fechadaEm: string;          // AAAA-MM-DD (São Paulo)
  refacoes: number;
  item: string; coluna: Coluna;
  valor: number | null;       // null = sob consulta sem valor informado
}
export interface Ajuste { chave: string; item: string; coluna: Coluna; valor?: number }

type PedidoMin = { protocolo: string; titulo: string; status: string; itens: { cod: string; variante: number; nome: string; varianteRotulo?: string }[]; pecas?: Peca[] };

export const mesDe = (iso: string) => hojeSP(new Date(iso)).slice(0, 7);
export const nomeMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return `${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][m - 1]}/${a}`;
};

/** Valor do item na coluna; null quando é sob consulta ou a coluna não existe para o item. */
export function valorTabela(tab: TabelaCriativo, item: string, coluna: Coluna): number | null {
  const it = tab.itens.find((x) => x.id === item);
  if (!it || it.sobConsulta) return null;
  return it[coluna];
}
/** Colunas que o item aceita (sob consulta: as duas, com valor informado). */
export function colunasDo(tab: TabelaCriativo, item: string): Coluna[] {
  const it = tab.itens.find((x) => x.id === item);
  if (!it) return [];
  if (it.sobConsulta) return ["nova", "adaptacao"];
  return (["adaptacao", "nova"] as Coluna[]).filter((c) => it[c] != null);
}

/** Peças fechadas no mês, com a sugestão da tabela. */
export function pecasDoMes(pedidos: PedidoMin[], mes: string, tab: TabelaCriativo): LinhaCriativo[] {
  const linhas: LinhaCriativo[] = [];
  for (const p of pedidos) {
    for (const x of p.pecas ?? []) {
      if (x.etapa !== "concluida" && x.etapa !== "encerrada") continue;
      const fim = x.hist[x.hist.length - 1]?.em ?? x.desde;
      if (!fim || mesDe(fim) !== mes) continue;
      const it = x.item != null ? p.itens[x.item] : undefined;
      let sug = it ? tab.mapa[`${it.cod}:${it.variante}`] : undefined;
      if (!sug) sug = { item: "complexo", coluna: "nova" };
      if (!colunasDo(tab, sug.item).includes(sug.coluna)) sug = { item: "complexo", coluna: sug.coluna };
      linhas.push({
        chave: `${p.protocolo}:${x.id}`, protocolo: p.protocolo, titulo: p.titulo, peca: x.nome,
        servico: it ? `${it.nome}${it.varianteRotulo ? ` · ${it.varianteRotulo}` : ""}` : "Peça avulsa",
        situacao: x.etapa === "concluida" ? "aprovada" : "cancelada",
        fechadaEm: hojeSP(new Date(fim)),
        refacoes: x.versoes.filter((v) => v.decisao?.tipo === "refacao").length,
        item: sug.item, coluna: sug.coluna, valor: valorTabela(tab, sug.item, sug.coluna),
      });
    }
  }
  return linhas.sort((a, b) => a.fechadaEm.localeCompare(b.fechadaEm) || a.chave.localeCompare(b.chave));
}

/** Aplica as conferências da Mariane. Erro (string) se algo não fecha; o servidor usa a mesma função. */
export function aplicarAjustes(tab: TabelaCriativo, linhas: LinhaCriativo[], ajustes: Ajuste[]): LinhaCriativo[] | string {
  const por = new Map(ajustes.map((a) => [a.chave, a]));
  const out: LinhaCriativo[] = [];
  for (const l of linhas) {
    const a = por.get(l.chave);
    const item = a?.item ?? l.item, coluna = a?.coluna ?? l.coluna;
    const it = tab.itens.find((x) => x.id === item);
    if (!it) return `Item da tabela inválido em ${l.peca}.`;
    if (!colunasDo(tab, item).includes(coluna)) return `${it.nome} não tem valor de ${NOME_COLUNA[coluna]} (${l.peca}).`;
    let valor = valorTabela(tab, item, coluna);
    if (it.sobConsulta) {
      valor = a?.valor != null && a.valor > 0 ? Math.round(a.valor * 100) / 100 : null;
      if (valor == null) return `Informe o valor de ${l.peca} (${l.protocolo}), item sob consulta.`;
      if (valor > 100000) return `Valor muito alto em ${l.peca}.`;
    }
    out.push({ ...l, item, coluna, valor });
  }
  return out;
}

export const totalLinhas = (ls: LinhaCriativo[]) => Math.round(ls.reduce((t, l) => t + (l.valor ?? 0), 0) * 100) / 100;

export interface RelatorioCriativo {
  mes: string; linhas: LinhaCriativo[]; total: number; tabelaVersao: string;
  status: "enviado" | "pago"; enviadoEm: unknown; enviadoPor: string; envios: number;
  pagoEm?: unknown; pagoPor?: string; notaPagamento?: string;
  /** Nome dos itens usados (para a Marisa ler sem ter a tabela). */
  itens: Record<string, string>;
}

/** Quem vê o quê. A tabela e o contrato da Mariane: só ela e o admin. Os relatórios enviados: ela, a Marisa e o admin. */
export const VE_TABELA_CRIATIVO = ["criativo", "admin"];
export const VE_PAGAMENTO_CRIATIVO = ["financeiro_propaga", "admin"];
