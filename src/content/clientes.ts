/* Clientes do portal: dados PÚBLICOS (vão para o navegador). Unidades e públicos aprovados em 02/10/2026.
   O catálogo com valores de referência fica em src/content/catalogos e só é usado pelo servidor;
   o navegador lê o catálogo do Firestore (clientes/{id}/catalogo/{versao}), protegido por login e 2FA. */

/** Identidade visual do portal do cliente. Muda por cliente; o fluxo e as permissões ficam no molde. */
export interface Marca {
  /** Nome curto do cliente nos textos ("B&M Log"). */
  nomeCurto: string;
  /** Equipe do cliente que solicita e aprova ('Marketing B&M Log'). */
  equipe: string;
  /** Rótulo do portal no menu e na tela de acesso. */
  rotuloPortal: string;
  /** Selo/logomarca do menu e da tela de acesso (arquivo em /public/brand). */
  selo: string;
  seloAlt: string;
  /** Cores (hex). escura = menu e títulos; destaque = botão primário e item ativo (texto escuro sobre ela). */
  cores: { escura: string; texto: string; destaque: string; claro: string; papel: string; borda: string; cinza: string;
    /** Texto sobre o destaque (botão primário, item ativo do menu). Padrão: a cor escura. A DalPet usa branco sobre o vermelho. */
    sobreDestaque?: string };
}

import type { AvaliacaoConfig } from "@/lib/avaliacao";

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
  contrato: { assinadoEm: string | null; pdfUrl: string | null; minuta: string | null; consideradoAssinadoParaTestes?: boolean };
  /** Bônus do contrato do cliente (ex.: 15% por ser cliente de longa data). Registro contratual: não altera preços no portal.
   *  Não confundir com o desconto do catálogo (`desconto`, em catalogos/, 15% da B&M Log) nem com os honorários. `ate` = fim opcional (AAAA-MM-DD); null = toda a vigência. */
  bonus?: { nome: string; percentual: number; motivo: string; ate: string | null };
  /** Prospect em teste: regras da avaliação de 48 h (ver src/lib/avaliacao.ts). Ausente = cliente contratado. */
  avaliacao?: AvaliacaoConfig;
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
      equipe: "Marketing B&M Log",
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
  // CLIENTE FICTÍCIO DE TESTE (nunca é cliente real): serve para provar marca, desconto e isolamento do molde.
  pet: {
    id: "pet",
    nome: "Pet Teste",
    nomePortal: "Portal Pet Teste",
    marca: {
      nomeCurto: "Pet Teste",
      equipe: "Marketing Pet Teste",
      rotuloPortal: "Portal MKT Pet Teste",
      selo: "/brand/selo-mkt-pet-teste.svg",
      seloAlt: "mkt Pet Teste",
      cores: { escura: "#1F4D3A", texto: "#2C7A52", destaque: "#F2B134", claro: "#E6F0E9", papel: "#F6F8F4", borda: "#E1E8E2", cinza: "#4F5F55" },
    },
    prefixo: "PET",
    catalogoVersao: "1.0",
    unidades: ["Matriz · Cidade Teste/SC", "Filial · Cidade Teste/SP", "Todas as unidades"],
    publicos: [
      { valor: "Clientes finais", rotulo: "Principal · Clientes finais" },
      { valor: "Colaboradores", rotulo: "Secundário · Colaboradores" },
      { valor: "Ambos os públicos", rotulo: "Ambos os públicos" },
    ],
    canaisVideo: ["TVs internas Pet Teste", "Redes sociais da Pet Teste (solicitação expressa)"],
    canaisSociais: ["Instagram", "Facebook"],
    audiosVideo: ["Sem áudio, com legendas", "Trilha licenciada", "Áudio fornecido pela Pet Teste", "Locução (cotada à parte)"],
    sobreposicoes: [["48", "52"], ["37", "39"]],
    contrato: { assinadoEm: null, pdfUrl: null, minuta: "2026-10-01", consideradoAssinadoParaTestes: true },
    atendimento: { nome: "Marcelo Brum", email: "marcelo@propaga.com" },
  },
  // CLIENTE FICTÍCIO DE TESTE (nunca é cliente real): serve para provar marca, desconto e isolamento do molde.
  varejo: {
    id: "varejo",
    nome: "Varejo Teste",
    nomePortal: "Portal Varejo Teste",
    marca: {
      nomeCurto: "Varejo Teste",
      equipe: "Comercial Varejo Teste",
      rotuloPortal: "Portal MKT Varejo Teste",
      selo: "/brand/selo-mkt-varejo-teste.svg",
      seloAlt: "mkt Varejo Teste",
      cores: { escura: "#3B2A5C", texto: "#7A3F9E", destaque: "#F08FB0", claro: "#EEE6F5", papel: "#F8F6FA", borda: "#E7E2EC", cinza: "#5A5064" },
    },
    prefixo: "VAR",
    catalogoVersao: "1.0",
    unidades: ["Matriz · Cidade Teste/SC", "Filial · Cidade Teste/SP", "Todas as unidades"],
    publicos: [
      { valor: "Clientes finais", rotulo: "Principal · Clientes finais" },
      { valor: "Colaboradores", rotulo: "Secundário · Colaboradores" },
      { valor: "Ambos os públicos", rotulo: "Ambos os públicos" },
    ],
    canaisVideo: ["TVs internas Varejo Teste", "Redes sociais da Varejo Teste (solicitação expressa)"],
    canaisSociais: ["Instagram", "TikTok", "YouTube"],
    audiosVideo: ["Sem áudio, com legendas", "Trilha licenciada", "Áudio fornecido pela Varejo Teste", "Locução (cotada à parte)"],
    sobreposicoes: [["48", "52"], ["37", "39"]],
    contrato: { assinadoEm: null, pdfUrl: null, minuta: "2026-10-01", consideradoAssinadoParaTestes: true },
    atendimento: { nome: "Marcelo Brum", email: "marcelo@propaga.com" },
  },
  // PROSPECT DalPet (teste de 48 h, decidido em 30/10/2026). Cadastro como na B&M Log; tudo que a DalPet ainda não confirmou
  // é configuração marcada [A CONFIRMAR], nunca dado inventado. Logo e cores vieram do site atual; a DalPet confirma o que é oficial.
  dalpet: {
    id: "dalpet",
    nome: "DalPet",
    nomePortal: "Portal DalPet",
    marca: {
      nomeCurto: "DalPet",
      equipe: "Equipe DalPet",
      rotuloPortal: "Portal DalPet",
      selo: "/brand/selo-mkt-dalpet.svg",
      seloAlt: "DalPet",
      // escura #756959 (títulos do site); destaque #E30818 (botões do site) com texto branco; claro e texto são tons nossos
      // (o bege #E9E4D7 do site não passa em AA com o marrom; o vermelho do logo #EC1C24 não passa com texto branco).
      cores: { escura: "#756959", texto: "#C8000F", destaque: "#E30818", claro: "#F1ECE0", papel: "#F4F5F0", borda: "#E4E2D8", cinza: "#4A4A4A", sobreDestaque: "#FFFFFF" },
    },
    prefixo: "DPT",
    catalogoVersao: "1.0",
    // Configuração de 31/10/2026, a partir do site da DalPet (unidades e públicos ainda sem validação da empresa).
    unidades: ["Matriz · Itajaí/SC", "Fábrica · Três Barras/SC", "Todas as unidades"],
    publicos: [
      { valor: "Tutores de cães e gatos", rotulo: "Principal · Tutores de cães e gatos" },
      { valor: "Lojistas e revendedores", rotulo: "Secundário · Lojistas e revendedores" },
      { valor: "Ambos os públicos", rotulo: "Ambos os públicos" },
    ],
    canaisVideo: ["Redes sociais da DalPet"],
    canaisSociais: ["Instagram", "Facebook"], // configuração: confirmar com a DalPet
    audiosVideo: ["Sem áudio, com legendas", "Trilha licenciada", "Áudio fornecido pela DalPet", "Locução (cotada à parte)"],
    sobreposicoes: [["48", "52"], ["37", "39"]],
    // Contrato novo, um por cliente conforme o pacote; ainda não existe (minuta null = ainda não redigida). O de 2021–2024 não vale.
    contrato: { assinadoEm: null, pdfUrl: null, minuta: null },
    bonus: { nome: "Bônus 15%", percentual: 15, motivo: "cliente de longa data", ate: null }, // decisão de 29/10/2026
    // Teste: 48 h, 3 pedidos de 1 post (post estático 01 e carrossel 02), download por 7 dias depois (decisões de 29 e 30/10/2026).
    avaliacao: { horas: 48, maxPedidos: 3, servicos: ["01", "02"], diasDownload: 7 },
    atendimento: { nome: "Marcelo Brum", email: "marcelo@propaga.com" },
  },
};

export const NOMES_PAPEIS: Record<string, string> = {
  solicitante: "{equipe}",
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
