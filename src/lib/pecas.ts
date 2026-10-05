/* Aprovação por peça (decisões de Marco, 03/10/2026).
   Fluxo de cada peça:
     cliente   → Débora avalia (aprovar / refação em itens / cancelar com justificativa)
     triagem   → só refações: Marcelo orienta, define prazo e decide os +30% (3ª refação em diante)
     criativo  → Mariane: refazer (refação), preparar o arquivo final (aprovada) ou tomar ciência (cancelada)
     revisao   → Marcelo revisa a nova versão: libera para a Débora ou devolve à Mariane (ajuste interno)
     concluida → aprovada com arquivo final em 04 Aprovados
     encerrada → cancelada, ciência registrada
   Aprovadas e canceladas vão direto para a Mariane (sem passar pela triagem).
   O relatório muda na hora da avaliação: aprovada = concluída, cancelada = 50%, refação = em refação.
   Mesmo módulo no navegador e no servidor. */
import { somarDiasUteis } from "./datas";
import type { Papel, Status } from "./tipos";

export type EtapaPeca = "cliente" | "triagem" | "criativo" | "revisao" | "concluida" | "encerrada";
export type TarefaCriativo = "refazer" | "final" | "ciencia";
export type TipoDecisao = "aprovada" | "refacao" | "cancelada";

export interface DecisaoPeca { tipo: TipoDecisao; itens?: string[]; nota?: string; por: string; em: string }
export interface VersaoPeca { v: number; link: string; em: string; por: string; interna?: boolean; devolvida?: boolean; nota?: string; feitos?: number; decisao?: DecisaoPeca | null }
export interface Orientacao { itens: string[]; prazo: string; por: string; em: string }
export interface Peca {
  id: string; nome: string; item: number | null; etapa: EtapaPeca; tarefa?: TarefaCriativo | null;
  orientacao?: Orientacao | null; extras30: number; versoes: VersaoPeca[];
  hist: { em: string; por: string; txt: string }[]; desde: string;
}

export const ultima = (p: Peca) => p.versoes[p.versoes.length - 1];
export const ultimaDecisao = (p: Peca): DecisaoPeca | null => [...p.versoes].reverse().find((v) => v.decisao)?.decisao ?? null;

/** Situação para o relatório e para a Débora. */
export function situacaoRelatorio(p: Peca): { chave: "aguardando" | "concluida" | "refacao" | "cancelada"; rotulo: string } {
  if (p.etapa === "cliente") return { chave: "aguardando", rotulo: "Aguardando aprovação" };
  const d = ultimaDecisao(p);
  if (d?.tipo === "aprovada") return { chave: "concluida", rotulo: p.etapa === "concluida" ? "Concluída · arquivo final entregue" : "Concluída · arquivo final em preparação" };
  if (d?.tipo === "cancelada") return { chave: "cancelada", rotulo: "Cancelada · 50%" };
  return { chave: "refacao", rotulo: "Em refação" };
}

/** Situação interna (Marcelo e Mariane). */
export function situacaoInterna(p: Peca): string {
  if (p.etapa === "criativo") return { refazer: "Mariane refaz", final: "Mariane prepara o arquivo final", ciencia: "Mariane: ciência do cancelamento" }[p.tarefa ?? "refazer"];
  return { cliente: "Com a Débora", triagem: "Marcelo orienta a refação", revisao: "Marcelo revisa", concluida: "Concluída", encerrada: "Cancelada · encerrada" }[p.etapa] ?? "";
}

/** Prazo da etapa atual (AAAA-MM-DD) — base dos lembretes. */
export function prazoEtapa(p: Peca): string | null {
  const desde = p.desde.slice(0, 10);
  if (p.etapa === "cliente") return somarDiasUteis(desde, 2);
  if (p.etapa === "triagem" || p.etapa === "revisao") return somarDiasUteis(desde, 1);
  if (p.etapa === "criativo") return p.tarefa === "refazer" && p.orientacao?.prazo ? p.orientacao.prazo : somarDiasUteis(desde, 1);
  return null;
}
export const atrasada = (p: Peca, hoje: string) => { const z = prazoEtapa(p); return !!z && z < hoje; };

/** Pedido aceito aguardando a Mariane criar as peças (primeira versão). */
export const aguardaCriacao = (p: { status: string; temPecas?: boolean }) => p.status === "producao" && !p.temPecas;

/** A peça pede ação deste perfil? */
export function pendentePara(papel: Papel | string | null | undefined, p: Peca): boolean {
  if (papel === "solicitante") return p.etapa === "cliente";
  if (papel === "atendimento" || papel === "admin") return p.etapa === "triagem" || p.etapa === "revisao";
  if (papel === "criativo") return p.etapa === "criativo";
  return false;
}

/** Todas as peças fechadas (arquivo final ou cancelada) e ao menos uma aprovada: pronto para entrega. */
export const prontoParaEntrega = (pecas: Peca[]) =>
  pecas.length > 0 && pecas.every((p) => p.etapa === "concluida" || p.etapa === "encerrada") && pecas.some((p) => p.etapa === "concluida");

/** Etapa do pedido a partir das peças (só enquanto o pedido está entre produção e pronto para entrega).
    Em aprovação = alguma peça com a Débora; Pronto para entrega = todas fechadas (arquivo final ou cancelada);
    todas canceladas = pedido cancelado; nos demais casos, em produção. */
export function statusPorPecas(pecas: Peca[], atual: Status): Status {
  if (!["producao", "apresentacao", "aprovada", "cancelada"].includes(atual) || !pecas.length) return atual;
  if (pecas.some((p) => p.etapa === "cliente")) return "apresentacao";
  if (prontoParaEntrega(pecas)) return "aprovada";
  if (pecas.every((p) => p.etapa === "encerrada")) return "cancelada";
  return "producao";
}

/** Ajuste de valor pelas peças: −50% do unitário por peça cancelada; +30% do unitário por refação extra cobrada. */
export function ajustePecas(pecas: Peca[] | undefined, unitarios: (number | null | undefined)[]): number {
  let a = 0;
  for (const p of pecas ?? []) {
    if (p.item == null) continue;
    const u = unitarios[p.item] ?? 0;
    if (ultimaDecisao(p)?.tipo === "cancelada") a -= 0.5 * u;
    a += 0.3 * u * (p.extras30 || 0);
  }
  return Math.round(a * 100) / 100;
}

/** Link de pré-visualização do Drive (arquivo) ou null. */
export function previewDrive(link: string): string | null {
  const m = link.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || link.match(/[?&]id=([\w-]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
}

/** Texto em linhas → itens (para refação em lista). */
export const linhasParaItens = (t: string) => t.split(/\n+/).map((x) => x.replace(/^\s*(\d+[.)-]|[-•*])\s*/, "").trim()).filter(Boolean);

/** Tarefas do pedido (fora das peças) que cabem a cada perfil — base de "Minhas tarefas" e do contador. */
export type TarefaPedido = "proposta" | "ajustar" | "aceitar" | "criar" | "entregar" | "faturar" | "receber";
export function tarefasDoPedido(papel: Papel | string | null | undefined, p: { status: string; temPecas?: boolean }): TarefaPedido[] {
  const t: TarefaPedido[] = [];
  const atend = papel === "atendimento" || papel === "admin", fin = papel === "financeiro_propaga" || papel === "admin";
  if ((papel === "solicitante" || papel === "admin") && p.status === "proposta") t.push("proposta");
  if (atend && p.status === "ajuste") t.push("ajustar");
  if (atend && p.status === "enviada") t.push("aceitar");
  if (papel === "criativo" && aguardaCriacao(p)) t.push("criar");
  if (atend && p.status === "aprovada") t.push("entregar");
  if (fin && p.status === "entregue") t.push("faturar");
  if (fin && p.status === "faturada") t.push("receber");
  return t;
}

/** Total de pendências de um perfil (tarefas de pedido + peças). */
export function contarPendencias(papel: Papel | string | null | undefined, pedidos: { status: string; temPecas?: boolean; pecas?: Peca[] }[]): number {
  return pedidos.reduce((n, p) => n + tarefasDoPedido(papel, p).length + (p.pecas ?? []).filter((x) => pendentePara(papel, x)).length, 0);
}
