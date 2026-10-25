/* Habilidades do criativo (aprovadas por Marco em 25/10/2026).
   12 habilidades cobrem os 68 serviços do catálogo B&M Log v1.0; 4 ficam fora do catálogo (entram pelo fluxo de material novo).
   Cada criativo marca até 2 habilidades primárias (recebem os pedidos por padrão) e quantas secundárias quiser. */

export interface Habilidade {
  id: string;
  nome: string;
  detalhe: string;
  /** false = fora do catálogo atual; atende material novo (etapa 5). */
  noCatalogo: boolean;
  /** Códigos do catálogo B&M Log v1.0 que pertencem a esta habilidade. */
  servicos: string[];
}

export const HABILIDADES: Habilidade[] = [
  { id: "redes-estaticas", nome: "Redes sociais: imagens estáticas", detalhe: "Feed, carrossel, stories, capas e cards de WhatsApp.", noCatalogo: true, servicos: ["01", "02", "03", "04", "07", "08", "09"] },
  { id: "video-curto", nome: "Vídeo curto e motion simples", detalhe: "Reels, vídeos curtos para redes e posts em movimento.", noCatalogo: true, servicos: ["05", "19"] },
  { id: "video-institucional", nome: "Vídeo institucional e promocional (30 s ou mais)", detalhe: "Institucional, promocional e conteúdo para TV interna.", noCatalogo: true, servicos: ["20", "21", "22", "23"] },
  { id: "impressos", nome: "Impressos e material promocional", detalhe: "Flyer, folder, catálogo, cartões, tags e selos.", noCatalogo: true, servicos: ["24", "25", "26", "27", "28", "29", "30", "31"] },
  { id: "brindes", nome: "Brindes e produtos personalizados", detalhe: "Camiseta, caneca, caderno, calendário e adesivo.", noCatalogo: true, servicos: ["32", "33", "34", "35", "36"] },
  { id: "eventos", nome: "Eventos e sinalização", detalhe: "Stand, banner, backdrop, outdoor, mobile de teto e material de feira.", noCatalogo: true, servicos: ["37", "39", "40", "41", "42", "43"] },
  { id: "endomarketing", nome: "Endomarketing e comunicação interna", detalhe: "Digital e impressa, para o público interno.", noCatalogo: true, servicos: ["44", "45", "46", "47", "48", "52"] },
  { id: "campanhas", nome: "Campanhas integradas e direção de arte", detalhe: "Conceito e kits com várias peças.", noCatalogo: true, servicos: ["49", "50", "51", "53", "A01", "A02", "A05", "A06", "A07", "A14", "A15"] },
  { id: "apresentacoes", nome: "Apresentações e documentos corporativos", detalhe: "Decks, manuais, PDFs, fichas e estudos de caso.", noCatalogo: true, servicos: ["15", "16", "17", "18", "A03", "A04", "A08", "A09", "A10"] },
  { id: "web-email", nome: "E-mail, web e landing pages", detalhe: "E-mail marketing, assinatura, banners de site e landing pages.", noCatalogo: true, servicos: ["10", "11", "12", "13", "14", "A11", "A12", "A13"] },
  { id: "fotografia", nome: "Fotografia e tratamento de imagem", detalhe: "Tratamento de fotografias fornecidas.", noCatalogo: true, servicos: ["A17"] },
  { id: "redacao", nome: "Redação e conteúdo editorial", detalhe: "Textos e cobertura editorial.", noCatalogo: true, servicos: ["A16"] },
  { id: "identidade-visual", nome: "Identidade visual e manual da marca", detalhe: "Logotipos e manual da marca completo.", noCatalogo: false, servicos: [] },
  { id: "embalagem", nome: "Embalagem e rótulos", detalhe: "Projeto gráfico de embalagens e rótulos.", noCatalogo: false, servicos: [] },
  { id: "ilustracao", nome: "Ilustração e infográficos", detalhe: "Ilustração editorial e infográficos.", noCatalogo: false, servicos: [] },
  { id: "animacao", nome: "Animação e motion avançado", detalhe: "Animação 2D e 3D, motion design completo.", noCatalogo: false, servicos: [] },
];

export const MAX_PRIMARIAS = 2;
