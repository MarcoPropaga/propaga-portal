/* Avaliação de 48 horas de um prospect (decisões de 29 e 30/10/2026). Mesmo módulo no navegador e no servidor.
   - O relógio só começa quando o admin clica em "Iniciar teste" (grava clientes/{id}/avaliacao/estado).
   - Até 3 pedidos, de 1 post cada, só dos Jobs Propaga liberados no teste; usa-se o pedido mesmo sem aprovar.
   - Sem valores durante o teste; os preços aparecem só quando a Propaga propõe o pacote, depois das 48 h.
   - Depois de expirar, o download dos posts continua liberado por `diasDownload` dias (a trava do Baixar é a etapa 3b). */

export interface AvaliacaoConfig {
  horas: number;
  maxPedidos: number;
  /** Códigos dos Jobs Propaga liberados no teste. */
  servicos: string[];
  diasDownload: number;
}

/** Estado gravado pelo servidor. Datas em ISO (o Firestore devolve texto). */
export interface EstadoAvaliacao { iniciadoEm: string; expiraEm: string; decisao?: "aceita" | "recusada" }

/** contratado = sem restrição de teste (cliente normal ou prospect que aceitou). */
export type FaseAvaliacao = "contratado" | "nao_iniciada" | "ativa" | "expirada" | "recusada";

export function faseAvaliacao(cfg: AvaliacaoConfig | undefined, estado: EstadoAvaliacao | null | undefined, agora: Date): FaseAvaliacao {
  if (!cfg) return "contratado";
  if (estado?.decisao === "aceita") return "contratado";
  if (!estado) return "nao_iniciada";
  if (estado.decisao === "recusada") return "recusada";
  return agora.getTime() < new Date(estado.expiraEm).getTime() ? "ativa" : "expirada";
}

export const expiraEmDe = (inicio: Date, horas: number) => new Date(inicio.getTime() + horas * 3_600_000);

/** Horas e minutos que faltam (0 quando já passou). */
export function restante(expiraEm: string, agora: Date): { horas: number; minutos: number } {
  const ms = Math.max(0, new Date(expiraEm).getTime() - agora.getTime());
  return { horas: Math.floor(ms / 3_600_000), minutos: Math.floor((ms % 3_600_000) / 60_000) };
}

/** Último instante em que o download dos posts segue liberado depois de expirar. */
export const downloadAte = (expiraEm: string, dias: number) => new Date(new Date(expiraEm).getTime() + dias * 86_400_000);

export const MSG_AVALIACAO: Record<FaseAvaliacao, string> = {
  contratado: "",
  ativa: "",
  nao_iniciada: "O teste de 48 horas ainda não começou. A Propaga avisa quando o acesso for liberado.",
  expirada: "O teste de 48 horas terminou. A Propaga entra em contato com a proposta.",
  recusada: "O teste de 48 horas foi encerrado.",
};

/** Erro (texto) se o pedido não cabe na avaliação; null se pode seguir. `usados` = pedidos de avaliação já criados. */
export function validarPedidoAvaliacao(cfg: AvaliacaoConfig, itens: { cod: string; qtd: number }[], usados: number): string | null {
  if (usados >= cfg.maxPedidos) return `Você já usou os ${cfg.maxPedidos} pedidos do teste.`;
  if (itens.length !== 1 || itens[0].qtd !== 1) return "No teste, cada pedido tem um post.";
  if (!cfg.servicos.includes(itens[0].cod)) return "Este serviço não está disponível no teste. Escolha post estático ou carrossel.";
  return null;
}
