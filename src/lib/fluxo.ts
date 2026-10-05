/* Etapas do pedido e ações por pedido (decisões de Marco, 03/10/2026 — fluxo único, sem duplicidade).
   Fluxo: Débora solicita → Marcelo aceita → Mariane cria → Marcelo revisa → Débora avalia cada peça
   (aprovada / refação / cancelada) → pronto para entrega → Marcelo entrega → Marisa fatura e recebe.
   Aprovação, refação e cancelamento são POR PEÇA (src/lib/pecas.ts); aqui ficam só as ações do pedido.
   As etapas "Em aprovação" e "Pronto para entrega" são calculadas pelas peças.
   O servidor (Apps Script) aplica estas regras; o navegador só mostra os botões permitidos. */
import type { Papel, Status } from "./tipos";

export type Acao = "aprovarProposta" | "ajustarProposta" | "recusarProposta"
  | "aceitarPedido" | "entregar" | "faturar" | "registrarPagamento" | "cancelar";

/* Solicitação criada pelo Marcelo (decisão de Marco, 05/10/2026): fica em nome da Débora e começa como
   "proposta"; a Débora aprova (vai para o Marcelo aceitar e enviar à Mariane), pede ajuste (volta ao Marcelo)
   ou recusa (encerra sem custo). Ações que exigem justificativa: */
export const ACOES_COM_MOTIVO: Acao[] = ["ajustarProposta", "recusarProposta", "cancelar"];
/** Quem cria solicitação: a Débora (direto ao Marcelo) e o Marcelo (vai à Débora aprovar). */
export const VE_NOVA_SOLICITACAO: Papel[] = ["solicitante", "atendimento", "admin"];

export const MAX_RODADAS = 2;

/** Cancelamento depois da apresentação: cobra esta fração do valor (contrato, Valores e Relatórios). */
export const COBRANCA_CANCELADA_APRESENTADA = 0.5;
export const REGRA_CANCELAMENTO = "Peça ou pedido cancelado depois de apresentado para aprovação é cobrado em 50% do seu valor. Cancelado antes da apresentação não é cobrado.";

/** Refação extra (a partir da 3ª, com edições novas): acréscimo sobre o valor da peça. */
export const ACRESCIMO_REFACAO_EXTRA = 0.3;
export const REGRA_REFACAO = "Até 2 refações estão incluídas. A partir da 3ª solicitação de refação, é adicionado 30% ao valor da peça. A refação é cobrada quando as edições pedidas pelo marketing da B&M Log forem diferentes das pedidas na 1ª e na 2ª solicitação; ajuste que repete um pedido anterior ou corrige erro da Propaga não é cobrado.";

/** Fração do valor do pedido: 1 normal; pedido inteiro cancelado = 0,5 se já havia peças apresentadas, 0 se não.
    Ajustes por peça (−50% cancelada, +30% refação extra) ficam em ajustePecas (src/lib/pecas.ts). */
export function fatorCobranca(p: { status: Status; versao?: number; temPecas?: boolean; pecas?: unknown[] }): number {
  if (p.status !== "cancelada") return 1;
  if (p.temPecas) return 1; // cancelado peça a peça: o 50% sai de ajustePecas
  return (p.versao ?? 0) > 0 ? COBRANCA_CANCELADA_APRESENTADA : 0;
}

export interface Ctx { rodadas?: number }
interface Regra { de: Status[]; para: Status; papeis: Papel[]; rotulo: string }

export const REGRAS: Record<Acao, Regra> = {
  aprovarProposta: { de: ["proposta"], para: "enviada", papeis: ["solicitante", "admin"], rotulo: "Aprovar solicitação" },
  ajustarProposta: { de: ["proposta"], para: "ajuste", papeis: ["solicitante", "admin"], rotulo: "Pedir ajuste ao Marcelo" },
  recusarProposta: { de: ["proposta"], para: "cancelada", papeis: ["solicitante", "admin"], rotulo: "Recusar solicitação" },
  aceitarPedido: { de: ["enviada"], para: "producao", papeis: ["atendimento", "admin"], rotulo: "Aceitar e enviar à Mariane" },
  entregar: { de: ["aprovada"], para: "entregue", papeis: ["atendimento", "admin"], rotulo: "Encaminhar para veiculação/impressão" },
  faturar: { de: ["entregue"], para: "faturada", papeis: ["financeiro_propaga", "admin"], rotulo: "Registrar faturamento" },
  registrarPagamento: { de: ["faturada"], para: "paga", papeis: ["financeiro_propaga", "admin"], rotulo: "Registrar pagamento" },
  cancelar: { de: ["proposta", "ajuste", "enviada", "producao", "apresentacao", "aprovada"], para: "cancelada", papeis: ["solicitante", "atendimento", "admin"], rotulo: "Cancelar pedido" },
};

export const ETAPAS: { status: Status; rotulo: string }[] = [
  { status: "enviada", rotulo: "Enviada" },
  { status: "producao", rotulo: "Em produção" },
  { status: "apresentacao", rotulo: "Em aprovação" },
  { status: "aprovada", rotulo: "Pronto para veiculação" },
  { status: "entregue", rotulo: "Realizado" },
  { status: "faturada", rotulo: "Faturada" },
  { status: "paga", rotulo: "Paga" },
];
export const NOME_STATUS: Record<Status, string> = {
  ...(Object.fromEntries(ETAPAS.map((e) => [e.status, e.rotulo])) as Record<Status, string>),
  rascunho: "Rascunho", cancelada: "Cancelada",
  proposta: "Aguardando aprovação da Débora", ajuste: "Ajuste pedido pela Débora",
};

export function podeExecutar(acao: Acao, status: Status, papel: Papel, _ctx: Ctx = {}): boolean { // eslint-disable-line @typescript-eslint/no-unused-vars
  const r = REGRAS[acao];
  if (!r.de.includes(status) || !r.papeis.includes(papel)) return false;
  // Pedido inteiro: Solicitante e Atendimento só cancelam antes do aceite; depois, só o admin.
  // (Depois das peças, a Débora cancela peça por peça, com 50%.)
  // A proposta do Marcelo: a Débora recusa (recusarProposta); o Marcelo pode cancelar a dele antes da aprovação.
  if (acao === "cancelar" && papel !== "admin" && !["enviada", ...(papel === "atendimento" ? ["proposta", "ajuste"] : [])].includes(status)) return false;
  return true;
}

/** Retorna o novo status ou lança erro com mensagem para o usuário. */
export function aplicar(acao: Acao, status: Status, papel: Papel, ctx: Ctx = {}): Status {
  if (!podeExecutar(acao, status, papel, ctx)) throw new Error("Esta ação não está disponível para o seu perfil nesta etapa do pedido.");
  return REGRAS[acao].para;
}

/** Ações disponíveis para um perfil num pedido (para os botões da tela). */
export function acoesDisponiveis(status: Status, papel: Papel, ctx: Ctx = {}): Acao[] {
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
/** Quem usa "Minhas tarefas" (cada pessoa age só ali). */
export const VE_TAREFAS: Papel[] = ["solicitante", "atendimento", "criativo", "financeiro_propaga", "admin"];
export const VE_APROVACOES = VE_TAREFAS;
/** Quem vê a tabela de Valores (o Criativo não vê preços). */
export const VE_VALORES: Papel[] = ["solicitante", "financeiro_cliente", "atendimento", "financeiro_propaga", "admin"];
