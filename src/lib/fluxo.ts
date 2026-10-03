/* Máquina de estados do pedido e quem pode executar cada ação.
   Decisões de Marco (03/10/2026):
   - Contrato assinado: valores e orçamentos já estão aprovados. Não há aceite do lado do cliente.
   - A Débora (Solicitante) envia; o Marcelo (Atendimento) aceita o pedido, confirma o cronograma e
     informa o valor dos itens "a cotar". O pedido entra direto em produção.
   - A Mariana (Financeiro do cliente) só consulta Relatórios; não executa ações.
   O servidor (Apps Script) aplica estas regras; o navegador só mostra os botões permitidos. */
import type { Papel, Status } from "./tipos";

export type Acao =
  | "aceitarPedido" | "disponibilizarVersao" | "pedirAjustes" | "aprovar" | "entregar"
  | "confirmarRecebimento" | "faturar" | "registrarPagamento" | "cancelar";

export const MAX_RODADAS = 2;

export interface Ctx { rodadas: number; recebidoPeloCliente?: boolean }
interface Regra { de: Status[]; para: Status | null; papeis: Papel[]; rotulo: string }

/** `para: null` = registra no histórico sem mudar a etapa. */
export const REGRAS: Record<Acao, Regra> = {
  aceitarPedido: { de: ["enviada"], para: "producao", papeis: ["atendimento", "admin"], rotulo: "Aceitar pedido" },
  disponibilizarVersao: { de: ["producao"], para: "apresentacao", papeis: ["atendimento", "admin"], rotulo: "Disponibilizar versão" },
  pedirAjustes: { de: ["apresentacao"], para: "producao", papeis: ["solicitante", "admin"], rotulo: "Pedir ajustes" },
  aprovar: { de: ["apresentacao"], para: "aprovada", papeis: ["solicitante", "admin"], rotulo: "Aprovar conteúdo" },
  entregar: { de: ["aprovada"], para: "entregue", papeis: ["atendimento", "admin"], rotulo: "Registrar entrega" },
  confirmarRecebimento: { de: ["entregue", "faturada", "paga"], para: null, papeis: ["solicitante", "admin"], rotulo: "Confirmar recebimento" },
  faturar: { de: ["entregue"], para: "faturada", papeis: ["financeiro_propaga", "admin"], rotulo: "Registrar faturamento" },
  registrarPagamento: { de: ["faturada"], para: "paga", papeis: ["financeiro_propaga", "admin"], rotulo: "Registrar pagamento" },
  cancelar: { de: ["enviada", "producao", "apresentacao", "aprovada"], para: "cancelada", papeis: ["solicitante", "atendimento", "admin"], rotulo: "Cancelar pedido" },
};

export const ETAPAS: { status: Status; rotulo: string }[] = [
  { status: "enviada", rotulo: "Enviada" },
  { status: "producao", rotulo: "Em produção" },
  { status: "apresentacao", rotulo: "Em apresentação" },
  { status: "aprovada", rotulo: "Aprovada" },
  { status: "entregue", rotulo: "Entregue" },
  { status: "faturada", rotulo: "Faturada" },
  { status: "paga", rotulo: "Paga" },
];
export const NOME_STATUS: Record<Status, string> = {
  ...(Object.fromEntries(ETAPAS.map((e) => [e.status, e.rotulo])) as Record<Status, string>),
  rascunho: "Rascunho", cancelada: "Cancelada",
};

export function podeExecutar(acao: Acao, status: Status, papel: Papel, ctx: Ctx): boolean {
  const r = REGRAS[acao];
  if (!r.de.includes(status) || !r.papeis.includes(papel)) return false;
  if (acao === "pedirAjustes" && ctx.rodadas >= MAX_RODADAS) return false;
  if (acao === "confirmarRecebimento" && ctx.recebidoPeloCliente) return false;
  // Solicitante e Atendimento só cancelam antes da produção; depois disso, só o admin.
  if (acao === "cancelar" && papel !== "admin" && status !== "enviada") return false;
  return true;
}

/** Retorna o novo status ou lança erro com mensagem para o usuário. */
export function aplicar(acao: Acao, status: Status, papel: Papel, ctx: Ctx): Status {
  if (!podeExecutar(acao, status, papel, ctx)) {
    throw new Error("Esta ação não está disponível para o seu perfil nesta etapa do pedido.");
  }
  return REGRAS[acao].para ?? status;
}

/** Ações disponíveis para um perfil num pedido (para os botões da tela). */
export function acoesDisponiveis(status: Status, papel: Papel, ctx: Ctx): Acao[] {
  return (Object.keys(REGRAS) as Acao[]).filter((a) => podeExecutar(a, status, papel, ctx));
}

/** Quem acessa Relatórios (e portanto os valores por pedido). */
export const VE_RELATORIOS: Papel[] = ["financeiro_cliente", "atendimento", "financeiro_propaga", "admin"];
