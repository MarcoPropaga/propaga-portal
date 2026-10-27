/* Regras puras do cliente ativo (testáveis): quais clientes a pessoa pode escolher e qual está valendo. */

export interface PerfilCliente {
  /** Cliente da pessoa (Marketing / Financeiro do cliente); null para a equipe Propaga. */
  clienteId: string | null;
  propaga: boolean;
  /** Atendimento, criativo e mídia social: só os clientes vinculados. */
  limitado: boolean;
  /** Vínculos carregados do cadastro; null enquanto carrega. */
  vinculos: string[] | null;
}

export function clientesPermitidos(p: PerfilCliente, todos: string[]): string[] {
  if (p.clienteId) return todos.includes(p.clienteId) ? [p.clienteId] : [];
  if (p.limitado) return todos.filter((c) => p.vinculos?.includes(c));
  return p.propaga ? todos : [];
}

/** Escolha guardada, se ainda for permitida; senão o primeiro permitido; senão o cliente padrão. */
export function escolherCliente(permitidos: string[], escolha: string | null, padrao: string): string {
  if (escolha && permitidos.includes(escolha)) return escolha;
  return permitidos[0] ?? padrao;
}
