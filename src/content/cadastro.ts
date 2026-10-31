/* Cadastro da empresa (42 campos, ficha do prospect de 30/10/2026). Mesmo módulo no navegador e no servidor.
   O prospect só baixa os posts do teste com o cadastro completo (decisão de 29/10/2026). Texto livre; "não se aplica" vale como resposta. */

export interface CampoCadastro { id: string; rotulo: string; ajuda: string }
export interface GrupoCadastro { titulo: string; campos: CampoCadastro[] }

export const CADASTRO: GrupoCadastro[] = [
  { titulo: "Identificação da empresa", campos: [
    { id: "razao", rotulo: "Razão social", ajuda: "Como consta no CNPJ" },
    { id: "fantasia", rotulo: "Nome fantasia", ajuda: "Como a marca se apresenta ao mercado" },
    { id: "cnpj", rotulo: "CNPJ da matriz", ajuda: "Só entra com o documento da empresa" },
    { id: "fundacao", rotulo: "Ano de fundação", ajuda: "Ano exato, para que todo material use o mesmo número" },
    { id: "porte", rotulo: "Porte e tipo", ajuda: "Porte, tipo de sociedade e se pertence a um grupo" },
    { id: "atividade", rotulo: "Atividade principal", ajuda: "Descrição em uma frase e o código de atividade (CNAE)" },
    { id: "sede", rotulo: "Site e endereço da sede", ajuda: "Endereço completo, usado em contrato e documentos" },
    { id: "contatos", rotulo: "Contatos institucionais", ajuda: "Telefone, e-mail geral e WhatsApp da empresa" },
  ] },
  { titulo: "Unidades e alcance", campos: [
    { id: "unidades", rotulo: "Matriz e filiais", ajuda: "Cidade, função de cada unidade, responsável local e número de pessoas" },
    { id: "regioes", rotulo: "Regiões e países atendidos", ajuda: "Onde a empresa vende e onde quer vender" },
    { id: "aprova_unidade", rotulo: "Quem aprova a comunicação de cada unidade", ajuda: "Se a matriz decide sozinha ou se a unidade também aprova" },
  ] },
  { titulo: "Pessoas e decisão", campos: [
    { id: "decisor", rotulo: "Decisor final", ajuda: "Nome, cargo, e-mail e WhatsApp" },
    { id: "marketing", rotulo: "Responsável por marketing e comunicação", ajuda: "Quem passa o briefing e recebe as entregas" },
    { id: "aprovador", rotulo: "Quem aprova peças, e o substituto", ajuda: "Inclui o prazo médio de resposta" },
    { id: "comercial", rotulo: "Responsável comercial", ajuda: "Quem fala com os clientes e propostas" },
    { id: "rh", rotulo: "Responsável por pessoas (RH)", ajuda: "Quem cuida da equipe e da comunicação interna" },
    { id: "financeiro", rotulo: "Responsável financeiro do contrato", ajuda: "Quem recebe a cobrança e aprova valores" },
    { id: "porta_voz", rotulo: "Porta-voz com a imprensa", ajuda: "Quem pode falar em nome da empresa" },
    { id: "lgpd", rotulo: "Encarregado de dados (LGPD)", ajuda: "Quem responde por dados pessoais na empresa" },
  ] },
  { titulo: "Equipe", campos: [
    { id: "colaboradores", rotulo: "Número de colaboradores", ajuda: "Por unidade e por área" },
    { id: "lideres", rotulo: "Quem lidera pessoas", ajuda: "Quantidade de líderes e os principais nomes" },
    { id: "regime", rotulo: "Regime de trabalho", ajuda: "Escritório, campo ou turnos. Define quais canais internos funcionam" },
    { id: "canais_internos", rotulo: "Canais internos que já existem", ajuda: "Mural, grupo de WhatsApp, e-mail, intranet, reunião" },
  ] },
  { titulo: "Identidade e materiais", campos: [
    { id: "logotipos", rotulo: "Logotipos", ajuda: "Versões em vetor e PNG" },
    { id: "cores_fontes", rotulo: "Cores e fontes", ajuda: "Códigos das cores e manual de marca, se existir" },
    { id: "fotos_videos", rotulo: "Fotos e vídeos", ajuda: "Arquivos autorais e autorização de uso da imagem das pessoas" },
    { id: "apresentacao", rotulo: "Apresentação institucional e portfólio", ajuda: "Tabelas de produtos ou serviços, quando houver" },
    { id: "offline", rotulo: "Materiais offline", ajuda: "Impressos, feiras, sinalização, frota e embalagens" },
  ] },
  { titulo: "Presença e canais", campos: [
    { id: "perfis", rotulo: "Perfis e site", ajuda: "Instagram, LinkedIn, Facebook, YouTube, Google Meu Negócio, WhatsApp Business" },
    { id: "resp_canais", rotulo: "Responsável por cada canal", ajuda: "Quem publica e quem responde" },
    { id: "acessos", rotulo: "Acessos", ajuda: "A empresa concede acesso pelo convite da própria plataforma. A Propaga não guarda senha" },
    { id: "resultados", rotulo: "Resultados anteriores", ajuda: "Alcance, contatos e vendas por canal, quando houver" },
  ] },
  { titulo: "Histórico com a Propaga", campos: [
    { id: "periodo", rotulo: "Período em que foi cliente", ajuda: "Ano de início e ano de término do atendimento" },
    { id: "servicos", rotulo: "Serviços prestados", ajuda: "Marketing e endomarketing, e o que cada um incluiu" },
    { id: "encerramento", rotulo: "Motivo do encerramento", ajuda: "Quem encerrou, quando e por quê" },
    { id: "ultimo_contato", rotulo: "Última entrega e último contato", ajuda: "Data, peça e quem na empresa" },
    { id: "contrato_anterior", rotulo: "Contrato anterior", ajuda: "Cláusulas de propriedade das peças, confidencialidade e guarda de dados após o fim" },
    { id: "arquivos", rotulo: "Arquivos que a Propaga ainda guarda", ajuda: "Logos, fontes, fotos, briefings, peças e guia de marca" },
  ] },
  { titulo: "Contrato e autorizações", campos: [
    { id: "contrato", rotulo: "Contrato com a Propaga", ajuda: "Prospect: termo de avaliação. Cliente: data, vigência e pacote" },
    { id: "autorizacao", rotulo: "Autorização de uso da marca e das imagens", ajuda: "Registrada no aceite do termo ou do contrato" },
    { id: "restritos", rotulo: "Assuntos restritos", ajuda: "Valores, margens, nomes de clientes, crises e temas regulados" },
    { id: "lgpd_aceite", rotulo: "Aceites e proteção de dados", ajuda: "Aceite do termo e base legal do tratamento" },
  ] },
];

export const CAMPOS_CADASTRO: CampoCadastro[] = CADASTRO.flatMap((g) => g.campos);
export const MAX_CAMPO_CADASTRO = 800;

export type ValoresCadastro = Record<string, string>;

/** Quantos campos já têm resposta (texto não vazio). */
export const preenchidos = (v: ValoresCadastro | null | undefined) => CAMPOS_CADASTRO.filter((c) => (v?.[c.id] ?? "").trim() !== "").length;
export const cadastroCompleto = (v: ValoresCadastro | null | undefined) => preenchidos(v) === CAMPOS_CADASTRO.length;
