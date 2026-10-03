/* Clientes do portal: dados PÚBLICOS (vão para o navegador). Unidades e públicos aprovados em 02/10/2026.
   O catálogo com valores de referência fica em src/content/catalogos e só é usado pelo servidor;
   o navegador lê o catálogo do Firestore (clientes/{id}/catalogo/{versao}), protegido por login e 2FA. */

export interface Cliente {
  id: string;
  nome: string;
  nomePortal: string;
  /** Prefixo do protocolo: BML-2026-0001. */
  prefixo: string;
  /** Versão vigente do catálogo (contrato assinado). */
  catalogoVersao: string;
  unidades: string[];
  publicos: { valor: string; rotulo: string }[];
  /** Destino e áudio dos vídeos. O primeiro é o padrão. */
  canaisVideo: string[];
  audiosVideo: string[];
  /** Pares de serviços com escopo sobreposto: o portal alerta quando os dois estão no mesmo pedido. */
  sobreposicoes: [string, string][];
}

export const CLIENTES: Record<string, Cliente> = {
  bmlog: {
    id: "bmlog",
    nome: "B&M Log",
    nomePortal: "Portal B&M Log",
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
    audiosVideo: ["Sem áudio, com legendas", "Trilha licenciada", "Áudio fornecido pela B&M Log", "Locução (cotada à parte)"],
    sobreposicoes: [["48", "52"], ["37", "39"]],
  },
};

export const NOMES_PAPEIS: Record<string, string> = {
  solicitante: "Solicitante",
  financeiro_cliente: "Financeiro do cliente",
  atendimento: "Atendimento Propaga",
  financeiro_propaga: "Financeiro Propaga",
  admin: "Administrador",
};
