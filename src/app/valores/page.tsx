"use client";
/* Valores do cliente: catálogo vigente com preço final (desconto de parceria já aplicado). Visível a todos os perfis. */
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Aviso } from "@/components/ui";
import { brData, moeda } from "@/components/pedido";
import { CLIENTES } from "@/content/clientes";

interface Cat {
  versao: string; data: string; status: string; categorias: { id: string; nome: string }[];
  servicos: { cod: string; categoria: string; nome: string; descricao: string; escopo: string; nota?: string; variantes: { rotulo: string; modalidade: string; preco: number | null }[] }[];
}

function Conteudo() {
  const s = useSessao();
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  const cliente = CLIENTES[clienteId];
  const [cat, setCat] = useState<Cat | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");

  useEffect(() => {
    (async () => {
      const c = await getDoc(doc(db(), "clientes", clienteId));
      const v = (c.data()?.catalogoVigente as string) || cliente.catalogoVersao;
      const k = await getDoc(doc(db(), "clientes", clienteId, "catalogo", v));
      if (!k.exists()) throw new Error();
      setCat(k.data() as Cat);
    })().catch(() => setErro("Não foi possível carregar os valores. Atualize a página."));
  }, [clienteId, cliente.catalogoVersao]);

  const grupos = useMemo(() => {
    if (!cat) return [];
    const t = busca.trim().toLowerCase();
    const lista = cat.servicos.filter((x) => (categoria === "todas" || x.categoria === categoria)
      && (!t || `${x.cod} ${x.nome} ${x.descricao}`.toLowerCase().includes(t)));
    return cat.categorias.map((c) => ({ c, itens: lista.filter((x) => x.categoria === c.id) })).filter((g) => g.itens.length);
  }, [cat, busca, categoria]);

  return (
    <Casca titulo={`Valores ${cliente.nome}`}>
      <div className="grid max-w-5xl gap-5">
        <p className="max-w-[75ch] text-gray-600">Preços finais por unidade, com o desconto de parceria de 15% já aplicado. “A cotar” significa que a Propaga define o valor conforme o contrato ao aceitar o pedido.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {!cat && !erro && <p className="text-gray-600" aria-busy="true">Carregando…</p>}
        {cat && <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#E3F2EA] px-3 py-1 text-xs font-semibold text-[#1E7047]">Catálogo v{cat.versao} · {brData(cat.data)} · {cat.status}</span>
            <span className="text-sm text-gray-600">{cat.servicos.length} serviços</span>
            <label htmlFor="busca" className="sr-only">Buscar serviço</label>
            <input id="busca" type="search" placeholder="Buscar serviço" value={busca} onChange={(e) => setBusca(e.target.value)}
              className="ml-auto min-h-11 w-72 max-w-full rounded border border-[#D6D2CE] bg-white px-3" />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Categorias">
            {[{ id: "todas", nome: "Todas" }, ...cat.categorias].map((c) => (
              <button key={c.id} type="button" aria-pressed={categoria === c.id} onClick={() => setCategoria(c.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${categoria === c.id ? "border-ink-900 bg-ink-900 text-paper" : "border-[#D6D2CE] bg-white hover:border-ink-900"}`}>{c.nome}</button>
            ))}
          </div>
          {grupos.map(({ c, itens }) => (
            <section key={c.id} aria-labelledby={`g-${c.id}`} className="grid gap-2">
              <h2 id={`g-${c.id}`} className="text-lg">{c.nome} <span className="text-sm font-normal text-gray-600">{itens.length}</span></h2>
              <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
                {itens.map((x) => (
                  <li key={x.cod} className="grid gap-3 p-4 md:grid-cols-[56px_minmax(0,1fr)_minmax(0,300px)]">
                    <span className="font-display text-sm font-semibold text-orange-700">{x.cod}</span>
                    <div className="grid min-w-0 gap-1"><b>{x.nome}</b><span className="text-sm text-gray-600">{x.descricao} {x.escopo}</span>
                      {x.nota && <span className="text-sm font-semibold text-orange-700">{x.nota}</span>}</div>
                    <dl className="grid gap-1 text-sm">
                      {x.variantes.map((v, i) => (
                        <div key={i} className="flex justify-between gap-3 border-b border-dashed border-gray-200 pb-1 last:border-0">
                          <dt className="text-gray-600">{v.rotulo}</dt><dd className={`whitespace-nowrap tabular-nums ${v.preco == null ? "text-gray-600" : "font-semibold"}`}>{moeda(v.preco)}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!grupos.length && <p className="rounded border border-dashed border-[#D6D2CE] px-4 py-8 text-center text-gray-600">Nenhum serviço encontrado.</p>}
          <p className="rounded bg-[#F1EEEA] px-4 py-3 text-sm leading-relaxed">Imagens e vídeos gerados pela Propaga estão incluídos. Filmagem, fotografia presencial, impressão, fabricação, montagem, mídia, locução, tradução e licenças específicas são orçadas à parte. Duas rodadas de ajustes consolidados por entrega.</p>
        </>}
      </div>
    </Casca>
  );
}

export default function Valores() {
  return <Protegido><Conteudo /></Protegido>;
}
