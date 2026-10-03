/* Regras da nova solicitação que dependem do catálogo — as mesmas no navegador e no servidor.
   Funciona com o catálogo público (preço final) e com o interno (referência): só usa nome, opções e variantes. */
import type { Cliente } from "@/content/clientes";

export interface ServicoBase {
  cod: string;
  categoria: string;
  nome: string;
  opcao: { k: string; o: string[] } | null;
  video: boolean;
  variantes: { rotulo: string; modalidade: string }[];
}

export interface ItemEntrada {
  cod: string;
  variante: number;
  qtd: number;
  opcao?: string;
  canal?: string;
  audio?: string;
  obs?: string;
}

/** Erros por campo (chave = id do campo na tela). Vazio = itens válidos. */
export function validarItens(servicos: ServicoBase[], itens: ItemEntrada[], cliente: Cliente): Record<string, string> {
  const e: Record<string, string> = {};
  itens.forEach((it, i) => {
    const n = i + 1;
    const s = servicos.find((x) => x.cod === it.cod);
    if (!s) { e[`it${i}-cod`] = `Serviço ${n}: escolha um serviço do catálogo.`; return; }
    if (!s.variantes[it.variante]) e[`it${i}-variante`] = `Serviço ${n}: escolha a modalidade e a faixa.`;
    if (s.opcao && !s.opcao.o.includes(it.opcao ?? "")) e[`it${i}-opcao`] = `Serviço ${n}: escolha ${s.opcao.k.toLowerCase()}.`;
    if (s.video) {
      if (!cliente.canaisVideo.includes(it.canal ?? "")) e[`it${i}-canal`] = `Serviço ${n}: escolha o canal do vídeo.`;
      if (!cliente.audiosVideo.includes(it.audio ?? "")) e[`it${i}-audio`] = `Serviço ${n}: escolha o áudio do vídeo.`;
    }
  });
  return e;
}

/** Remove campos que não se aplicam ao serviço (ex.: canal em peça que não é vídeo). */
export function normalizarItem(s: ServicoBase, it: ItemEntrada): ItemEntrada {
  const obs = it.obs?.trim();
  return {
    cod: it.cod,
    variante: it.variante,
    qtd: it.qtd,
    ...(s.opcao ? { opcao: it.opcao } : {}),
    ...(s.video ? { canal: it.canal, audio: it.audio } : {}),
    ...(obs ? { obs } : {}),
  };
}

/** Pares de serviços do pedido com escopo sobreposto. */
export function sobreposicoes(cliente: Cliente, itens: { cod: string }[]): [string, string][] {
  return cliente.sobreposicoes.filter(([a, b]) => itens.some((i) => i.cod === a) && itens.some((i) => i.cod === b));
}

/** Descrição curta do item para listas e e-mails (sem valores). */
export function descreverItem(s: ServicoBase, it: ItemEntrada): string {
  const v = s.variantes[it.variante];
  return [v?.rotulo, it.opcao, it.canal, it.audio].filter(Boolean).join(" · ");
}
