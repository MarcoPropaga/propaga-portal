/* Habilidades do criativo: validação (navegador e servidor) e consulta por serviço. */
import { z } from "zod";
import { HABILIDADES, MAX_PRIMARIAS } from "@/content/habilidades";

export const IDS_HABILIDADES = HABILIDADES.map((h) => h.id);
const id = z.string().refine((v) => IDS_HABILIDADES.includes(v), { message: "Habilidade desconhecida." });

export const habilidadesSchema = z.object({
  /** Só o admin informa: define as habilidades de outro criativo. */
  uid: z.string().min(1).max(128).regex(/^[\w-]+$/).optional(),
  primarias: z.array(id).min(1, "Marque ao menos 1 habilidade primária.").max(MAX_PRIMARIAS, `No máximo ${MAX_PRIMARIAS} habilidades primárias.`),
  secundarias: z.array(id).max(IDS_HABILIDADES.length),
  /** Só o admin: confirma o perfil (o do criativo nasce "a confirmar"). */
  confirmar: z.boolean().optional(),
}).refine((d) => new Set(d.primarias).size === d.primarias.length && new Set(d.secundarias).size === d.secundarias.length, { message: "Habilidade repetida." })
  .refine((d) => !d.primarias.some((p) => d.secundarias.includes(p)), { message: "Uma habilidade não pode ser primária e secundária ao mesmo tempo.", path: ["secundarias"] });

export type HabilidadesInput = z.infer<typeof habilidadesSchema>;

export interface PerfilHabilidades { primarias: string[]; secundarias: string[]; confirmado: boolean }

/** Habilidade a que um serviço do catálogo pertence (usada na pré-seleção do criativo, etapa 6). */
export const habilidadeDoServico = (cod: string) => HABILIDADES.find((h) => h.servicos.includes(cod))?.id;

/** O criativo é indicado para o serviço? primária = padrão; secundária = só se o Atendimento escolher. */
export function nivelParaServico(p: PerfilHabilidades | undefined, cod: string): "primaria" | "secundaria" | null {
  const h = habilidadeDoServico(cod);
  if (!p || !h) return null;
  return p.primarias.includes(h) ? "primaria" : p.secundarias.includes(h) ? "secundaria" : null;
}

export const nomeHabilidade = (hid: string) => HABILIDADES.find((h) => h.id === hid)?.nome ?? hid;
