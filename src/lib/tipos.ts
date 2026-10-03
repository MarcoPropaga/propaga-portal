/* Tipos de domínio do Portal Propaga (multi-cliente). */

export type Modalidade = "novo" | "edicao";

export interface Variante {
  rotulo: string;
  modalidade: Modalidade;
  /** Valor de referência interno. Nunca sai do servidor/área admin. null = a cotar. */
  referencia: number | null;
}

export interface Servico {
  cod: string;
  categoria: string;
  nome: string;
  descricao: string;
  escopo: string;
  opcao: { k: string; o: string[] } | null;
  video: boolean;
  nota?: string;
  variantes: Variante[];
}

export interface Catalogo {
  clienteId: string;
  versao: string;
  data: string;
  status: "vigente" | "em_validacao" | "arquivado";
  categorias: { id: string; nome: string }[];
  servicos: Servico[];
}

/** Papéis por cliente (Anexo A2 da minuta). */
export type Papel =
  | "solicitante"          // Débora — solicita, acompanha, aprova conteúdo
  | "financeiro_cliente"   // Mariana — consulta relatórios (sem ações no fluxo)
  | "atendimento"          // Marcelo — aceita o pedido, cronograma, valor dos itens a cotar, versões, entrega
  | "financeiro_propaga"   // Marisa — relatórios, faturamento, pagamento
  | "criativo"             // Mariane — criativo Propaga: lê pedidos e refações, sem valores e sem ações
  | "admin";               // Marco — acesso geral, catálogo, usuários

export type Status =
  | "rascunho" | "enviada" | "producao"
  | "apresentacao" | "aprovada" | "entregue" | "faturada" | "paga" | "cancelada";

export interface ItemSolicitacao {
  cod: string;
  variante: number;
  qtd: number;
  opcao?: string;
  canal?: string;
  audio?: string;
  obs?: string;
}

export interface Prazo {
  desejada: string;          // AAAA-MM-DD
  urgente: boolean;
  inicio?: string;
  primeira?: string;
  final?: string;
  entrega?: string;
}

export interface Solicitacao {
  protocolo: string;
  clienteId: string;
  titulo: string;
  solicitanteUid: string;
  unidade: string;
  email: string;
  objetivo: string;
  publico: string;
  itens: ItemSolicitacao[];
  drive: { link: string; conferido: boolean; verificado: boolean };
  obs: string;
  prazo: Prazo;
  status: Status;
  rodadas: number;
  versao: number;
  catalogoVersao: string;
  criadoEm: string;
}

/** Valores ficam em documento separado, legível só por quem acessa Relatórios. */
export interface ValoresSolicitacao {
  protocolo: string;
  catalogoVersao: string;
  itens: { unitario: number | null; subtotal: number | null; orcado: boolean }[];
  total: number;
  pendencias: number;
}
