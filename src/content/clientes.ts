/* Clientes do portal: dados PÚBLICOS (vão para o navegador). Unidades e públicos aprovados em 02/10/2026.
   O catálogo com valores de referência fica em src/content/catalogos e só é usado pelo servidor;
   o navegador lê o catálogo do Firestore (clientes/{id}/catalogo/{versao}), protegido por login e 2FA. */

/** Identidade visual do portal do cliente. Muda por cliente; o fluxo e as permissões ficam no molde. */
export interface Marca {
  /** Nome curto do cliente nos textos ("B&M Log"). */
  nomeCurto: string;
  /** Rótulo do portal no menu e na tela de acesso. */
  rotuloPortal: string;
  /** Selo/logomarca do menu e da tela de acesso (arquivo em /public/brand). */
  selo: string;
  seloAlt: string;
  /** Cores (hex). escura = menu e títulos; destaque = botão primário e item ativo (texto escuro sobre ela). */
  cores: { escura: string; texto: string; destaque: string; claro: string; papel: string; borda: string; cinza: string };
}

export interface Cliente {
  id: string;
  nome: string;
  nomePortal: string;
  marca: Marca;
  /** Prefixo do protocolo: BML-2026-0001. */
  prefixo: string;
  /** Versão vigente do catálogo (contrato assinado). */
  catalogoVersao: string;
  unidades: string[];
  publicos: { valor: string; rotulo: string }[];
  /** Destino e áudio dos vídeos. O primeiro é o padrão. */
  canaisVideo: string[];
  /** Canais de publicação em redes sociais (Kauan). Lista de CONFIGURAÇÃO: confirmar com a B&M Log (pendência de 18/10/2026). */
  canaisSociais: string[];
  audiosVideo: string[];
  /** Pares de serviços com escopo sobreposto: o portal alerta quando os dois estão no mesmo pedido. */
  sobreposicoes: [string, string][];
  /** Contrato assinado: data e link do PDF (Drive, acesso restrito). null = pendente. */
  contrato: { assinadoEm: string | null; pdfUrl: string | null; minuta: string; consideradoAssinadoParaTestes?: boolean };
  /** Contato do atendimento Propaga mostrado em Ajuda. */
  atendimento: { nome: string; email: string };
}

export const CLIENTES: Record<string, Cliente> = {
  bmlog: {
    id: "bmlog",
    nome: "B&M Log",
    nomePortal: "Portal B&M Log",
    // Paleta B&M Log aprovada em 03/10/2026: #003C57 e #55C5D0.
    marca: {
      nomeCurto: "B&M Log",
      rotuloPortal: "Portal MKT B&M Log",
      selo: "/brand/selo-mkt-bmlog.png",
      seloAlt: "mkt B&M Log",
      cores: { escura: "#003C57", texto: "#00708A", destaque: "#55C5D0", claro: "#DDF3F5", papel: "#F4F8F9", borda: "#E2EAED", cinza: "#4E6670" },
    },
    prefixo: "BML",
    catalogoVersao: "1.0",
    unidades: [
      "Matriz · Itajaí/SC", "Filial · São Bento do Sul/SC", "Filial · São Paulo/SP", "Filial · Santos/SP",
      "Filial · Guarulhos/SP", "Filial · Curitiba/PR", "Filial · São José dos Pinhais/PR", "Filial · Caxias do Sul/RS",
      "Todas as unidades",
    ],
    publicos: [
      { valor: "Empresários importadores e exportadores (40 a 65 anos)", rotulo: "Principal · Empresários importadores e exportadores (40 a 65 anos)" },
      { valor: "Colaboradores da matriz e das filiais", rotulo: "Secundário · Colaboradores da matriz e das filiais" },
      { valor: "Ambos os públicos", rotulo: "Ambos os públicos" },
    ],
    canaisVideo: ["TVs internas B&M Log", "Redes sociais da B&M Log (solicitação expressa)"],
    canaisSociais: ["Instagram", "Facebook", "LinkedIn"],
    audiosVideo: ["Sem áudio, com legendas", "Trilha licenciada", "Áudio fornecido pela B&M Log", "Locução (cotada à parte)"],
    sobreposicoes: [["48", "52"], ["37", "39"]],
    // Decisão de 03/10/2026: considerado assinado durante os testes finais; registrar data e PDF depois.
    contrato: { assinadoEm: null, pdfUrl: null, minuta: "2026-10-01", consideradoAssinadoParaTestes: true },
    atendimento: { nome: "Marcelo Brum", email: "marcelo@propaga.com" },
  },
};

export const NOMES_PAPEIS: Record<string, string> = {
  solicitante: "Marketing B&M Log",
  financeiro_cliente: "Financeiro do cliente",
  atendimento: "Atendimento Propaga",
  financeiro_propaga: "Financeiro Propaga",
  criativo: "Criativo Propaga",
  midia_social: "Mídias sociais Propaga",
  admin: "Admin Propaga",
};

/** Cliente do portal padrão (tela de acesso e equipe Propaga, até existir a escolha de cliente). */
export const CLIENTE_PADRAO = "bmlog";

/** Cliente ativo da sessão: o da pessoa, ou o padrão quando não há (equipe Propaga, tela de acesso). */
export function clienteAtivo(clienteId: string | null | undefined): Cliente {
  return (clienteId ? CLIENTES[clienteId] : undefined) ?? CLIENTES[CLIENTE_PADRAO];
}
