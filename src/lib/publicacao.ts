/* Publicação nas redes sociais (decisões de Marco, 18/10/2026).
   Todo mês: Kauan monta o calendário de publicações e envia ao Marcelo → Marcelo analisa e envia à Débora →
   Débora aprova (item por item, ou todos) e o calendário volta aprovado ao Marcelo e ao Kauan.
   Depois Marcelo pede os materiais à Mariane (fluxo normal de peças) e VINCULA cada peça ao item do calendário.
   Quando a Débora aprova a arte e o arquivo final está pronto, o Kauan agenda no mLabs (FORA do portal) e registra
   a publicação. O portal não publica nem se integra ao mLabs. Mesmo módulo no navegador e no servidor. */
import { somarDiasUteis } from "./datas";
import type { Papel } from "./tipos";

export type EtapaCal =
  | "ajuste"     // devolvido ao Kauan para corrigir
  | "analise"    // com o Marcelo
  | "debora"     // com a Débora
  | "aprovado"   // calendário aprovado; aguarda a arte (vinculada pelo Marcelo) ou o agendamento do Kauan
  | "devolvida"  // arte devolvida pelo Kauan ao Marcelo (arquivo incorreto ou falta de informação)
  | "agendada"   // agendada no mLabs
  | "publicada"; // publicada (fim)

export interface CalAjuste { de: "marcelo" | "debora" | "kauan"; motivo: string; por: string; em: string }
export interface CalItem {
  id: string; mes: string;
  /** Tema ou orientação do post. */
  titulo: string; canais: string[]; data: string; hora: string; legenda: string; urgente?: string;
  etapa: EtapaCal; desde: string; ajuste?: CalAjuste | null;
  /** Peça criada pela Mariane para este post (vínculo feito pelo Marcelo). */
  peca?: { protocolo: string; id: string; nome: string } | null;
  agendadaEm?: string;
  publicada?: { data: string; link?: string; semLink?: string; em: string; por: string } | null;
  hist: { em: string; por: string; txt: string }[];
}
export interface Calendario { mes: string; itens: CalItem[] }
export type RefCal = { mes: string; id: string };

export const NOME_CAL: Record<EtapaCal, string> = {
  ajuste: "Ajuste pedido · Kauan corrige", analise: "Em análise (Marcelo)", debora: "Aguardando a Débora",
  aprovado: "Calendário aprovado", devolvida: "Arte devolvida ao Marcelo", agendada: "Agendada no mLabs", publicada: "Publicada",
};

/** Antecedência do calendário (decisão de 18/10: 1 semana). Meta com alerta: menos que isso exige justificativa. */
export const ANTECEDENCIA_DIAS = 7;
/** Prazos de cada etapa em dias úteis (iguais aos atuais: Marcelo 1, Débora 2). */
export const PRAZO_CAL_UTEIS: Partial<Record<EtapaCal, number>> = { analise: 1, debora: 2 };

const dias = (de: string, ate: string) => Math.round((Date.parse(ate + "T12:00:00Z") - Date.parse(de + "T12:00:00Z")) / 86400000);
export const mesDe = (data: string) => data.slice(0, 7);
export const NOME_MES = (mes: string) => { const [a, m] = mes.split("-"); return `${["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][+m - 1]} de ${a}`; };

/** Segunda-feira da semana de uma data AAAA-MM-DD (agrupa o calendário semanal). */
export function semanaDe(data: string): string {
  const d = new Date(data + "T12:00:00Z");
  const w = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - w);
  return d.toISOString().slice(0, 10);
}

export interface CalEntrada { titulo: string; canais: string[]; data: string; hora: string; legenda: string; urgente?: string }

/** Valida um item do calendário. Devolve a mensagem de erro ou null. */
export function erroItem(e: Partial<CalEntrada>, hoje: string, canaisValidos: string[]): string | null {
  if ((e.titulo?.trim().length ?? 0) < 3) return "Escreva o tema ou a orientação do post.";
  if (e.titulo!.length > 300) return "O tema aceita até 300 caracteres.";
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
export const urgenteCal = (e: { data?: string } | null | undefined, hoje: string) => !!e?.data && dias(hoje, e.data) < ANTECEDENCIA_DIAS;

/** Situação da arte do item: a peça vinculada (ou não) e se já tem arquivo final aprovado. */
export type PecaMin = { id: string; nome: string; etapa: string };
export type PedidoMin = { protocolo: string; status?: string; pecas?: PecaMin[] };
export function arteDe(it: CalItem, pedidos: PedidoMin[]): { vinculada: boolean; pronta: boolean; etapaPeca?: string } {
  if (!it.peca) return { vinculada: false, pronta: false };
  const x = pedidos.find((p) => p.protocolo === it.peca!.protocolo)?.pecas?.find((q) => q.id === it.peca!.id);
  return { vinculada: true, pronta: x?.etapa === "concluida", etapaPeca: x?.etapa };
}

/** Prazo da etapa (AAAA-MM-DD) — base dos lembretes. */
export function prazoPub(it: CalItem): string | null {
  const n = PRAZO_CAL_UTEIS[it.etapa];
  if (n) return somarDiasUteis(it.desde.slice(0, 10), n);
  if (["aprovado", "agendada", "devolvida"].includes(it.etapa)) return it.data;
  return null;
}
export const atrasadaPub = (it: CalItem, hoje: string) => { const z = prazoPub(it); return !!z && z < hoje && it.etapa !== "publicada"; };

/** O item pede ação deste perfil? (admin conta como o Marcelo.) */
export function pendentePub(papel: Papel | string | null | undefined, it: CalItem, arte: { pronta: boolean }): boolean {
  if (papel === "midia_social") return it.etapa === "ajuste" || it.etapa === "agendada" || (it.etapa === "aprovado" && arte.pronta);
  if (papel === "atendimento" || papel === "admin") return it.etapa === "analise" || it.etapa === "devolvida" || (it.etapa === "aprovado" && !it.peca);
  if (papel === "solicitante") return it.etapa === "debora";
  return false;
}

export function itensDe(cals: Calendario[]): CalItem[] {
  return cals.flatMap((c) => c.itens.map((i) => ({ ...i, mes: c.mes }))).sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));
}
export function contarPendenciasCal(papel: Papel | string | null | undefined, cals: Calendario[], pedidos: PedidoMin[]): number {
  return itensDe(cals).filter((i) => pendentePub(papel, i, arteDe(i, pedidos))).length;
}
