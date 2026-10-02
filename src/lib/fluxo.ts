/* Máquina de estados do pedido e quem pode executar cada transição.
   Fonte: contrato (cláusulas 5, 7, 8, 9) + decisões de 02/10/2026:
   - Pedido só com preço de catálogo vai direto para produção (contrato assinado).
   - Pedido com item a cotar passa por aceite do Financeiro do cliente.
   As regras do Firestore espelham estas transições (firestore.rules). */
import type { Papel, Status } from "./tipos";

export type Acao =
  | "enviar" | "receber" | "confirmarCronograma" | "aceitarOrcamento"
  | "disponibilizarVersao" | "pedirAjustes" | "aprovar" | "entregar"
  | "confirmarRecebimento" | "faturar" | "registrarPagamento" | "cancelar";

export const MAX_RODADAS = 2;

interface Regra { de: Status[]; para: Status | ((ctx: Ctx) => Status); papeis: Papel[] }
export interface Ctx { temOrcamento: boolean; rodadas: number }

export const REGRAS: Record<Acao, Regra> = {
  enviar: { de: ["rascunho"], para: "enviada", papeis: ["solicitante", "admin"] },
  receber: { de: ["enviada"], para: "validacao", papeis: ["atendimento", "admin"] },
  confirmarCronograma: { de: ["validacao"], para: (c) => (c.temOrcamento ? "aceite" : "producao"), papeis: ["atendimento", "admin"] },
  aceitarOrcamento: { de: ["aceite"], para: "producao", papeis: ["financeiro_cliente"] },
  disponibilizarVersao: { de: ["producao"], para: "apresentacao", papeis: ["atendimento", "admin"] },
  pedirAjustes: { de: ["apresentacao"], para: "producao", papeis: ["solicitante"] },
  aprovar: { de: ["apresentacao"], para: "aprovada", papeis: ["solicitante"] },
  entregar: { de: ["aprovada"], para: "entregue", papeis: ["atendimento", "admin"] },
  confirmarRecebimento: { de: ["entregue", "faturada", "paga"], para: "entregue", papeis: ["solicitante"] }, // só registra evento; status não muda (ver aplicar)
  faturar: { de: ["entregue"], para: "faturada", papeis: ["financeiro_propaga", "admin"] },
  registrarPagamento: { de: ["faturada"], para: "paga", papeis: ["financeiro_propaga", "admin"] },
  cancelar: { de: ["enviada", "validacao", "aceite", "producao", "apresentacao", "aprovada"], para: "cancelada", papeis: ["solicitante", "admin"] },
};

export function podeExecutar(acao: Acao, status: Status, papel: Papel, ctx: Ctx): boolean {
  const r = REGRAS[acao];
  if (!r.de.includes(status) || !r.papeis.includes(papel)) return false;
  if (acao === "pedirAjustes" && ctx.rodadas >= MAX_RODADAS) return false;
  // Solicitante só cancela antes da produção; depois disso, só o admin.
  if (acao === "cancelar" && papel === "solicitante" && !["enviada", "validacao", "aceite"].includes(status)) return false;
  return true;
}

/** Retorna o novo status ou lança erro com mensagem para o usuário. */
export function aplicar(acao: Acao, status: Status, papel: Papel, ctx: Ctx): Status {
  if (!podeExecutar(acao, status, papel, ctx)) {
    throw new Error("Esta ação não está disponível para o seu perfil nesta etapa do pedido.");
  }
  if (acao === "confirmarRecebimento") return status;
  const p = REGRAS[acao].para;
  return typeof p === "function" ? p(ctx) : p;
}

/** Quem acessa Relatórios (e portanto os valores por pedido). */
export const VE_RELATORIOS: Papel[] = ["financeiro_cliente", "atendimento", "financeiro_propaga", "admin"];
