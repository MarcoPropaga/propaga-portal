/* Avaliação de 48 horas de um prospect (decisões de 29 e 30/10/2026). Mesmo módulo no navegador e no servidor.
   - "Iniciar teste" (admin) grava clientes/{id}/avaliacao/estado com o início e o fim previsto (expiraEm).
   - Sem relógio na tela e sem bloqueio automático (30/10/2026): ao passar do fim previsto, o admin recebe um aviso por e-mail
     e decide (proposta ou encerrar). Enquanto não houver decisão, o teste segue "ativo"; o limite de 3 pedidos é o teto.
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
export type FaseAvaliacao = "contratado" | "nao_iniciada" | "ativa" | "recusada";

export function faseAvaliacao(cfg: AvaliacaoConfig | undefined, estado: EstadoAvaliacao | null | undefined): FaseAvaliacao {
  if (!cfg) return "contratado";
  if (estado?.decisao === "aceita") return "contratado";
  if (!estado) return "nao_iniciada";
  if (estado.decisao === "recusada") return "recusada";
  return "ativa";
}

/** O fim previsto já passou e o admin ainda não decidiu: hora de avisar o admin. */
export const fimPrevistoPassou = (estado: EstadoAvaliacao, agora: Date) => !estado.decisao && agora.getTime() >= new Date(estado.expiraEm).getTime();

export const expiraEmDe = (inicio: Date, horas: number) => new Date(inicio.getTime() + horas * 3_600_000);

/** Último instante em que o download dos posts segue liberado depois de expirar. */
export const downloadAte = (expiraEm: string, dias: number) => new Date(new Date(expiraEm).getTime() + dias * 86_400_000);

export const MSG_AVALIACAO: Record<FaseAvaliacao, string> = {
  contratado: "",
  ativa: "",
  nao_iniciada: "O teste de 48 horas ainda não começou. A Propaga avisa quando o acesso for liberado.",
  recusada: "O teste de 48 horas foi encerrado.",
};

/** Erro (texto) se o pedido não cabe na avaliação; null se pode seguir. `usados` = pedidos de avaliação já criados. */
export function validarPedidoAvaliacao(cfg: AvaliacaoConfig, itens: { cod: string; qtd: number }[], usados: number): string | null {
  if (usados >= cfg.maxPedidos) return `Você já usou os ${cfg.maxPedidos} pedidos do teste.`;
  if (itens.length !== 1 || itens[0].qtd !== 1) return "No teste, cada pedido tem um post.";
  if (!cfg.servicos.includes(itens[0].cod)) return "Este serviço não está disponível no teste. Escolha post estático ou carrossel.";
  return null;
}

/* Checklist de 7 itens que libera o botão "Iniciar teste" (decisão de 29/10/2026).
   `auto`: o servidor confere sozinho; os demais o admin confirma à mão. */
export const ITENS_PRONTO = [
  { id: "empresa", rotulo: "Empresa", auto: false, ajuda: "Dados da empresa conferidos na ficha do prospect." },
  { id: "marca", rotulo: "Marca", auto: true, ajuda: "Logo e cores no portal, com contraste AA." },
  { id: "configuracao", rotulo: "Configuração", auto: true, ajuda: "Unidades, públicos e destinos de vídeo confirmados (sem [A CONFIRMAR])." },
  { id: "equipe", rotulo: "Equipe vinculada", auto: true, ajuda: "Atendimento e criativo vinculados ao cliente." },
  { id: "fornecedores", rotulo: "Fornecedores", auto: false, ajuda: "Parceiros de produção confirmados para o teste." },
  { id: "termo", rotulo: "Termo de uso", auto: false, ajuda: "Termo da avaliação definido e aceito pelo cliente." },
  { id: "contato", rotulo: "Contato do acesso", auto: true, ajuda: "Ao menos um usuário do cliente cadastrado, com e-mail." },
] as const;
export type ItemProntoId = (typeof ITENS_PRONTO)[number]["id"];
export interface ItemPronto { id: ItemProntoId; rotulo: string; auto: boolean; ajuda: string; ok: boolean }

/* Trava do Baixar (etapa 3b): o prospect só abre os arquivos do teste com o cadastro da empresa completo,
   e só até `diasDownload` dias depois do fim previsto (sem aceite). Quem virou cliente não tem trava. */
export type MotivoTrava = "cadastro" | "prazo";
export function travaDownload(cfg: AvaliacaoConfig | undefined, estado: EstadoAvaliacao | null | undefined, cadastroOk: boolean, agora: Date): MotivoTrava | null {
  const fase = faseAvaliacao(cfg, estado);
  if (fase === "contratado" || !cfg) return null;
  if (estado && agora.getTime() > downloadAte(estado.expiraEm, cfg.diasDownload).getTime()) return "prazo";
  return cadastroOk ? null : "cadastro";
}
export const MSG_TRAVA: Record<MotivoTrava, string> = {
  cadastro: "Para baixar os posts, complete o cadastro da empresa.",
  prazo: "O prazo para baixar os posts do teste terminou. Fale com a Propaga.",
};
