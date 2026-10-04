"use client";
/* Publicar peças (primeira versão): a Mariane cria e envia ao Marcelo; o Marcelo pode publicar direto para a Débora. */
import { useState } from "react";
import { useSessao } from "@/components/auth/sessao";
import { Aviso, Botao } from "@/components/ui";
import type { PedidoDoc } from "@/components/pedido";
import { useFila } from "@/lib/usarFila";

/* Publicar peças para aprovação (Marcelo): uma linha por peça, já sugerida a partir dos serviços do pedido. */
export function FormPublicar({ pedido, onFechar, onOk }: { pedido: PedidoDoc; onFechar: () => void; onOk?: (msg: string) => void }) {
  const s = useSessao();
  const criativo = s.papel === "criativo";
  const enviar = useFila();
  const sugestao = pedido.temPecas ? [{ nome: "", item: 0 as number | null, link: "" }]
    : pedido.itens.flatMap((it, i) => Array.from({ length: Math.min(it.qtd, 10) }, (_, k) => ({ nome: it.qtd > 1 ? `${it.nome} ${k + 1}` : it.nome, item: i as number | null, link: "" })));
  const [linhas, setLinhas] = useState(sugestao);
  const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState(false);
  const muda = (k: number, campo: "nome" | "item" | "link", v: string) => setLinhas(linhas.map((l, j) => j !== k ? l : { ...l, [campo]: campo === "item" ? (v === "" ? null : Number(v)) : v }));
  async function confirmar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    const pecas = linhas.filter((l) => l.nome.trim() || l.link.trim()).map((l) => ({ nome: l.nome.trim(), item: l.item, link: l.link.trim() }));
    if (!pecas.length) { setErro("Inclua ao menos uma peça."); return; }
    const ruim = pecas.findIndex((l) => l.nome.length < 2 || !/^https:\/\/drive\.google\.com\//.test(l.link));
    if (ruim >= 0) { setErro(`Confira a peça ${ruim + 1}: nome e link do arquivo no Google Drive (pasta 03 Provas).`); return; }
    setOcupado(true);
    const r = await enviar("peca", { acao: "publicar", protocolo: pedido.protocolo, pecas });
    setOcupado(false);
    if (r.ok) { onOk?.(criativo ? "Peças enviadas ao Marcelo para revisão." : "Peças enviadas à Débora."); onFechar(); } else setErro(r.msg);
  }
  const cx2 = "min-h-11 w-full rounded border border-[#C9D7DC] bg-white px-3";
  return (
    <form onSubmit={confirmar} noValidate className="grid gap-4 rounded border border-marca-500 bg-white p-4 md:p-5" aria-labelledby="pub-t">
      <h3 id="pub-t" className="text-base">{criativo ? "Enviar peças criadas ao Marcelo" : pedido.temPecas ? "Publicar mais peças" : "Publicar peças para aprovação"}</h3>
      <p className="text-sm text-gray-600">Uma linha por peça, com o link do arquivo na pasta <b>03 Provas</b> do Drive. {criativo ? "O Marcelo revisa e envia à Débora." : "A Débora avalia peça por peça na página Aprovações."}</p>
      <div className="grid gap-3">
        {linhas.map((l, k) => (
          <fieldset key={k} className="grid gap-2 rounded border border-gray-200 p-3 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end">
            <legend className="sr-only">Peça {k + 1}</legend>
            <div className="grid gap-1"><label htmlFor={`pn-${k}`} className="text-xs font-semibold">Peça {k + 1}</label><input id={`pn-${k}`} className={cx2} value={l.nome} onChange={(e) => muda(k, "nome", e.target.value)} /></div>
            <div className="grid gap-1"><label htmlFor={`pi-${k}`} className="text-xs font-semibold">Serviço</label>
              <select id={`pi-${k}`} className={cx2} value={l.item ?? ""} onChange={(e) => muda(k, "item", e.target.value)}>
                {pedido.itens.map((it, i) => <option key={i} value={i}>{i + 1}. {it.nome}</option>)}<option value="">Sem vínculo</option>
              </select></div>
            <div className="grid gap-1"><label htmlFor={`pl-${k}`} className="text-xs font-semibold">Link no Drive</label><input id={`pl-${k}`} type="url" className={cx2} placeholder="https://drive.google.com/file/d/…" value={l.link} onChange={(e) => muda(k, "link", e.target.value)} /></div>
            <Botao type="button" variante="discreto" className="!px-3" onClick={() => setLinhas(linhas.filter((_, j) => j !== k))} aria-label={`Remover peça ${k + 1}`}>Remover</Botao>
          </fieldset>
        ))}
      </div>
      <Botao type="button" variante="discreto" className="w-fit" onClick={() => setLinhas([...linhas, { nome: "", item: 0, link: "" }])}>+ Adicionar peça</Botao>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-3"><Botao type="submit" carregando={ocupado}>{criativo ? "Enviar ao Marcelo" : "Enviar à Débora"}</Botao><Botao type="button" variante="linha" onClick={onFechar}>Voltar</Botao></div>
    </form>
  );
}

