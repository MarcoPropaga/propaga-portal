/* Publicação nas redes sociais (decisões de Marco, 18/10/2026).
   Trilha PARALELA por peça, separada do status do pedido (o faturamento não espera a publicação).
   Fluxo: Marcelo encaminha a arte aprovada → Kauan recebe e monta o calendário (1 semana antes) → Marcelo analisa →
   Débora aprova por peça → volta aprovado a Marcelo e Kauan → Kauan agenda no mLabs (FORA do portal) e registra
   agendada e publicada. O portal não publica nem se integra ao mLabs.
   Mesmo módulo no navegador e no servidor. */
import { somarDiasUteis } from "./datas";
import type { Papel } from "./tipos";

export type EtapaPub =
  | "receber"    // com o Kauan: confirmar recebimento
  | "recebida"   // com o Kauan: montar o calendário
  | "analise"    // com o Marcelo: analisar o calendário
  | "debora"     // com a Débora: aprovar
  | "aprovada"   // aprovada para publicação (com o Kauan)
  | "preparo"    // Kauan preparando no mLabs
  | "agendada"   // agendada no mLabs
  | "publicada"  // publicada (fim)
  | "ajuste"     // devolvida ao Kauan (calendário a corrigir)
  | "devolvida"; // arte devolvida pelo Kauan ao Marcelo (arquivo incorreto ou falta de informação)

export interface PubEntrada { canais: string[]; data: string; hora: string; legenda: string; urgente?: string }
export interface PubAjuste { de: "marcelo" | "debora" | "kauan"; motivo: string; por: string; em: string }
export interface Publicacao {
  etapa: EtapaPub; desde: string;
  /** Versão da arte aprovada que o Kauan recebe (congelada). */
  versao: number; link: string;
  entrada?: PubEntrada | null;
  ajuste?: PubAjuste | null;
  agendadaEm?: string;
  publicada?: { data: string; link?: string; semLink?: string; em: string; por: string } | null;
  hist: { em: string; por: string; txt: string }[];
}

export const NOME_PUB: Record<EtapaPub, string> = {
  receber: "A receber", recebida: "Recebida · calendário a montar", analise: "Calendário em análise (Marcelo)",
  debora: "Aguardando a Débora", aprovada: "Aprovada para publicação", preparo: "Em preparação",
  agendada: "Agendada no mLabs", publicada: "Publicada", ajuste: "Ajuste pedido · Kauan corrige", devolvida: "Arte devolvida ao Marcelo",
};

/** Antecedência do calendário (decisão de 18/10: 1 semana). Meta com alerta: menos que isso exige justificativa. */
export const ANTECEDENCIA_DIAS = 7;
/** Prazos de cada etapa em dias úteis (iguais aos atuais: Marcelo 1, Débora 2). */
export const PRAZO_PUB_UTEIS: Partial<Record<EtapaPub, number>> = { receber: 1, analise: 1, debora: 2 };

const dias = (de: string, ate: string) => Math.round((Date.parse(ate + "T12:00:00Z") - Date.parse(de + "T12:00:00Z")) / 86400000);

/** Segunda-feira da semana de uma data AAAA-MM-DD (agrupa o calendário semanal). */
export function semanaDe(data: string): string {
  const d = new Date(data + "T12:00:00Z");
  const w = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - w);
  return d.toISOString().slice(0, 10);
}

/** Valida uma entrada do calendário. Devolve a mensagem de erro ou null. */
export function erroEntrada(e: Partial<PubEntrada>, hoje: string, canaisValidos: string[]): string | null {
  if (!e.canais?.length) return "Escolha ao menos um canal.";
  if (e.canais.some((c) => !canaisValidos.includes(c))) return "Canal inválido.";
  if (!e.data || !/^\d{4}-\d{2}-\d{2}$/.test(e.data)) return "Informe a data de publicação.";
  if (e.data < hoje) return "A data de publicação já passou.";
  if (!e.hora || !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.hora)) return "Informe o horário (HH:MM).";
  if (!e.legenda?.trim()) return "Escreva a legenda.";
  if (e.legenda.length > 3000) return "A legenda aceita até 3.000 caracteres.";
  if (dias(hoje, e.data) < ANTECEDENCIA_DIAS && (e.urgente?.trim().length ?? 0) < 3) return `Data com menos de ${ANTECEDENCIA_DIAS} dias: justifique a urgência.`;
  return null;
}

export const entradaUrgente = (e: PubEntrada | null | undefined, hoje: string) => !!e && dias(hoje, e.data) < ANTECEDENCIA_DIAS;

/** Prazo da etapa (AAAA-MM-DD) — base dos lembretes. */
export function prazoPub(pb: Publicacao): string | null {
  const desde = pb.desde.slice(0, 10);
  const n = PRAZO_PUB_UTEIS[pb.etapa];
  if (n) return somarDiasUteis(desde, n);
  if (["aprovada", "preparo", "agendada"].includes(pb.etapa)) return pb.entrada?.data ?? null;
  return null;
}
export const atrasadaPub = (pb: Publicacao, hoje: string) => { const z = prazoPub(pb); return !!z && z < hoje && pb.etapa !== "publicada"; };

/** A publicação pede ação deste perfil? (admin conta como o Marcelo.) */
export function pendentePub(papel: Papel | string | null | undefined, pb: Publicacao | null | undefined, ped?: { solicitanteUid?: string }, uid?: string | null): boolean {
  if (!pb) return false;
  if (papel === "midia_social") return ["receber", "recebida", "ajuste", "aprovada", "preparo", "agendada"].includes(pb.etapa);
  if (papel === "atendimento" || papel === "admin") return ["analise", "devolvida"].includes(pb.etapa);
  if (papel === "solicitante") return pb.etapa === "debora" && (!ped || !uid || ped.solicitanteUid === uid);
  return false;
}
