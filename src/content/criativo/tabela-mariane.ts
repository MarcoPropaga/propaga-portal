/* Tabela de valores da Mariane Garcia (Criativo Propaga) — "Tabela_de_Valores_Mariane_Final", revisada (Marco, 15/10/2026).
   SIGILO: só o servidor importa este arquivo (tests/sigilo.test.ts). No portal, a tabela fica em criativo/tabela,
   que só a Mariane e o administrador leem. Os valores aparecem para a Marisa apenas no relatório mensal enviado.
   Valores por peça/serviço. null = não se aplica; sobConsulta = valor informado pela Mariane no relatório. */
import type { ItemTabelaCriativo, TabelaCriativo } from "@/lib/criativo";
import type { Catalogo } from "@/lib/tipos";

export const ITENS_MARIANE: ItemTabelaCriativo[] = [
  { id: "post", nome: "Post simples", adaptacao: 10, nova: 45 },
  { id: "story-post", nome: "Story (mesma arte do post simples)", adaptacao: 10, nova: null, obs: "Adaptação da arte já criada para o post." },
  { id: "carrossel", nome: "Carrossel padrão", adaptacao: null, nova: 90, obs: "Capa + 2 ou capa + 3 páginas." },
  { id: "carrossel-g", nome: "Carrossel acima do padrão", adaptacao: null, nova: 120, obs: "Capa + 4 ou mais páginas." },
  { id: "cartao-1", nome: "Cartão de visita (impresso ou digital) · 1 alteração", adaptacao: 10, nova: null, obs: "Valor por adaptação, conforme o número de alterações." },
  { id: "cartao-5", nome: "Cartão de visita (impresso ou digital) · 2 a 5 alterações", adaptacao: 20, nova: null, obs: "Valor único por cartão para 2 a 5 alterações." },
  { id: "canva", nome: "Arte para Canva", adaptacao: null, nova: 50, obs: "Por peça criada exclusivamente para o Canva." },
  { id: "tv", nome: "Arte avulsa para TV", adaptacao: 10, nova: 45 },
  { id: "banner-site", nome: "Banner para site", adaptacao: 10, nova: 45 },
  { id: "fundo", nome: "Fundo de tela simples / background de reunião", adaptacao: 10, nova: 20 },
  { id: "manipulacao", nome: "Manipulação de imagem", adaptacao: null, nova: 45, obs: "Edições não complexas, como remoção de objetos, ajustes de cor etc." },
  { id: "story", nome: "Story avulso", adaptacao: 10, nova: 45 },
  { id: "reels", nome: "Capa de Reels", adaptacao: 10, nova: 20 },
  { id: "tpl-tv", nome: "Template para TV", adaptacao: null, nova: 50, obs: "Criação preparada para uso no Canva." },
  { id: "tpl-story", nome: "Template para Story", adaptacao: null, nova: 50, obs: "Criação preparada para uso no Canva." },
  { id: "assinatura", nome: "Assinatura de e-mail", adaptacao: 10, nova: null },
  { id: "complexo", nome: "Criação do zero / projeto complexo", adaptacao: null, nova: null, sobConsulta: true, obs: "Valor definido conforme a complexidade e a demanda." },
];

/* Serviço do catálogo da Propaga → item da tabela da Mariane (sugestão; ela confere no relatório).
   Modalidade da variante: "novo" → Nova criação; "edicao" → Adaptação. Serviço sem equivalente → projeto complexo. */
const POR_SERVICO: Record<string, string> = {
  "01": "post", "03": "post", "04": "post", "07": "post", "08": "post", "09": "post",
  "44": "post", "46": "post", "47": "post",
  "11": "assinatura", "12": "banner-site", "26": "cartao-1", "45": "fundo", "A17": "manipulacao",
};
/* Variantes específicas: "cod:índice". */
const POR_VARIANTE: Record<string, string> = {
  "02:0": "carrossel", "02:1": "carrossel-g",
  "21:0": "tv",
};

export const VERSAO_TABELA_MARIANE = "2026-10.2"; // 16/10: PNG incluso nos serviços (sai da tabela); Canva = nova criação; cartão de 2 a 5 alterações

/** Monta o documento publicado em criativo/tabela: itens + sugestão por serviço/variante do catálogo vigente. */
export function montarTabelaMariane(cat: Catalogo): TabelaCriativo {
  const mapa: TabelaCriativo["mapa"] = {};
  for (const s of cat.servicos) {
    s.variantes.forEach((v, i) => {
      const item = POR_VARIANTE[`${s.cod}:${i}`] ?? POR_SERVICO[s.cod] ?? "complexo";
      mapa[`${s.cod}:${i}`] = { item, coluna: v.modalidade === "edicao" ? "adaptacao" : "nova" };
    });
  }
  return { versao: VERSAO_TABELA_MARIANE, nome: "Mariane Garcia", itens: ITENS_MARIANE, mapa };
}
