/* Vínculo profissional × cliente (etapa 3a, 24/10/2026).
   Atendimento, criativo e mídia social só atuam nos clientes aos quais o admin os vinculou (usuarios/{uid}.clientes).
   Admin e Financeiro da Propaga atuam em todos. Perfis de cliente atuam só no próprio cliente. */

export const PAPEIS_VINCULADOS = ["atendimento", "criativo", "midia_social"] as const;

export interface PerfilVinculo { papel: string; propaga?: boolean; clienteId?: string | null; clientes?: string[] }

export const ehVinculado = (papel: string) => (PAPEIS_VINCULADOS as readonly string[]).includes(papel);

/** O usuário pode atuar neste cliente? */
export function atendeCliente(u: PerfilVinculo, clienteId: string): boolean {
  if (!u.propaga) return u.clienteId === clienteId;
  if (!ehVinculado(u.papel)) return true;
  return (u.clientes ?? []).includes(clienteId);
}

export const MSG_SEM_VINCULO = "Você não está vinculado a este cliente. Peça ao administrador.";
