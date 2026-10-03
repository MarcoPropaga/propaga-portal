/* Máquina de estados do pedido e quem pode executar cada ação.
   Decisões de Marco (03/10/2026):
   - Contrato assinado: valores e orçamentos já estão aprovados. Não há aceite do lado do cliente.
   - A Débora (Solicitante) envia; o Marcelo (Atendimento) aceita o pedido, confirma o cronograma e
     informa o valor dos itens "a cotar". O pedido entra direto em produção.
   - A Mariana (Financeiro do cliente) só consulta Relatórios; não executa ações.
   - Só a Débora (Solicitante) aprova. Ela pode cancelar ao lado de "Pedir ajustes": o que foi
     cancelado depois de apresentado é cobrado em 50% do valor (Marco, 03/10/2026).
   - Até 2 refações incluídas. A partir da 3ª, cada refação com edições diferentes das pedidas nas
     anteriores acrescenta 30% ao valor da peça; o Atendimento confirma ao disponibilizar a versão.
   O servidor (Apps Script) aplica estas regras; o navegador só mostra os botões permitidos. */
import type { Papel, Status } from "./tipos";

export type Acao =
  | "aceitarPedido" | "disponibilizarVersao" | "pedirAjustes" | "aprovar" | "entregar"
  | "confirmarRecebimento" | "faturar" | "registrarPagamento" | "cancelar";

export const MAX_RODADAS = 2;

/** Cancelamento depois da apresentação: cobra esta fração do valor (contrato, Valores e Relatórios). */
export const COBRANCA_CANCELADA_APRESENTADA = 0.5;
export const REGRA_CANCELAMENTO = "Peça ou pedido cancelado depois de apresentado para aprovação é cobrado em 50% do seu valor. Cancelado antes da apresentação não é cobrado.";

/** Refação extra (a partir da 3ª, com edições novas): acréscimo sobre o valor da peça. */
export const ACRESCIMO_REFACAO_EXTRA = 0.3;
export const REGRA_REFACAO = "Até 2 refações estão incluídas. A partir da 3ª solicitação de refação, é adicionado 30% ao valor da peça. A refação é cobrada quando as edições pedidas pelo marketing da B&M Log forem diferentes das pedidas na 1ª e na 2ª solicitação; ajuste que repete um pedido anterior ou corrige erro da Propaga não é cobrado.";

/** Fração do valor do pedido que entra na cobrança: 1 normal (+30% por refação extra cobrada),
    0,5 se cancelado após apresentação, 0 se cancelado antes. */
export function fatorCobranca(p: { status: Status; versao?: number; refacoesExtrasCobradas?: number }): number {
  if (p.status === "cancelada") return (p.versao ?? 0) > 0 ? COBRANCA_CANCELADA_APRESENTADA : 0;
  return 1 + ACRESCIMO_REFACAO_EXTRA * (p.refacoesExtrasCobradas ?? 0);
}

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
  if (acao === "confirmarRecebimento" && ctx.recebidoPeloCliente) return false;
  // Antes da produção: solicitante e atendimento cancelam. Em apresentação: o solicitante também
  // (com cobrança de 50%). Nas demais etapas, só o admin.
  if (acao === "cancelar" && papel !== "admin" && !(status === "enviada" || (status === "apresentacao" && papel === "solicitante"))) return false;
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

/** Quem acessa Relatórios. A Solicitante vê só os pedidos dela (Marco, 03/10). */
export const VE_RELATORIOS: Papel[] = ["solicitante", "financeiro_cliente", "atendimento", "financeiro_propaga", "admin"];
/** Quem vê os valores dentro do detalhe do pedido (a Solicitante não: valores só em Valores e Relatórios). */
export const VE_VALORES_PEDIDO: Papel[] = ["financeiro_cliente", "atendimento", "financeiro_propaga", "admin"];
/** Quem vê o menu Contrato (a Solicitante não, decisão de 03/10). */
export const VE_CONTRATO: Papel[] = ["financeiro_cliente", "atendimento", "financeiro_propaga", "admin"];
/** Quem vê Arquivos no Drive (os financeiros não, decisão de 03/10). */
export const VE_ARQUIVOS: Papel[] = ["solicitante", "atendimento", "criativo", "admin"];
/** Quem vê a tabela de Valores (o Criativo não vê preços). */
export const VE_VALORES: Papel[] = ["solicitante", "financeiro_cliente", "atendimento", "financeiro_propaga", "admin"];
