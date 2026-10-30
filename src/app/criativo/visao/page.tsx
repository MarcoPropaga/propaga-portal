"use client";
/* Visão do criativo — só o administrador, só consulta (Marco, 15/10/2026).
   Mostra o que o criativo escolhido vê: pedidos com ele, tarefas, relatório do mês e tabela. Nenhuma ação é feita em nome dele. */
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Protegido } from "@/components/auth/protegido";
import { Casca } from "@/components/casca";
import { Aviso } from "@/components/ui";
import { brData, brDataHora } from "@/components/pedido";
import { cobradoDe, idRelatorio, nomeClienteDaLinha, situacaoDaLinha, NOME_COLUNA, nomeMes, pecasDoMes, totalLinhas, type RelatorioCriativo } from "@/lib/criativo";
import { NOME_STATUS } from "@/lib/fluxo";
import { hojeSP } from "@/lib/datas";
import { prazoEtapa, situacaoInterna, tarefasDoPedido } from "@/lib/pecas";
import { usePedidosDosClientes } from "@/lib/usarFila";
import { moeda, useTabelaCriativo } from "@/lib/usarTabelaCriativo";
import { useTxt } from "@/components/tema";

type Equipe = { lista: { uid: string; nome: string }[] };
const cx = "min-h-11 rounded border border-[#C9D7DC] bg-white px-3";
const meses = (n = 12) => {
  const [a, m] = hojeSP().slice(0, 7).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(a, m - 1 - i, 1)).toISOString().slice(0, 7));
};

function Conteudo() {
  const t = useTxt();
  const [equipe, setEquipe] = useState<Equipe["lista"] | null>(null);
  const [uid, setUid] = useState("");
  const [mes, setMes] = useState(() => meses()[0]);
  const { lista, erro } = usePedidosDosClientes();
  const { tab } = useTabelaCriativo();
  const [rel, setRel] = useState<RelatorioCriativo | null | undefined>(undefined);

  useEffect(() => onSnapshot(doc(db(), "equipe", "criativos"), (d) => {
    const l = ((d.data() as Equipe | undefined)?.lista ?? []);
    setEquipe(l); setUid((u) => u || l[0]?.uid || "");
  }, () => setEquipe([])), []);
  useEffect(() => {
    if (!uid) return;
    setRel(undefined);
    return onSnapshot(doc(db(), "relatoriosCriativo", idRelatorio(uid, mes)), (d) => setRel(d.exists() ? (d.data() as RelatorioCriativo) : null), () => setRel(null));
  }, [uid, mes]);

  const nome = equipe?.find((x) => x.uid === uid)?.nome ?? "";
  const pedidos = useMemo(() => (lista ?? []).filter((p) => p.criativo?.uid === uid && !["proposta", "ajuste", "enviada"].includes(p.status)), [lista, uid]);
  const abertos = pedidos.filter((p) => !["entregue", "faturada", "paga", "cancelada"].includes(p.status));
  const aCriar = abertos.filter((p) => tarefasDoPedido("criativo", p).includes("criar"));
  const tarefas = abertos.flatMap((p) => (p.pecas ?? []).filter((x) => x.etapa === "criativo").map((x) => ({ p, x })));
  const nTarefas = aCriar.length + tarefas.length;
  const previa = useMemo(() => (tab && lista && uid ? pecasDoMes(lista, mes, tab, uid) : []), [tab, lista, mes, uid]);
  const linhas = rel ? rel.linhas : previa;
  const total = rel ? rel.total : totalLinhas(previa);

  return (
    <Casca titulo="Visão do criativo">
      <div className="grid max-w-6xl gap-6">
        <p className="max-w-[75ch] text-gray-600">Veja o painel como o criativo escolhido o enxerga: os pedidos que estão com ele, as tarefas, o relatório do mês e a tabela. É só consulta: nenhuma ação é feita em nome dele. Para decidir sobre valores, use a <a className="font-semibold text-marca-700 underline" href="/criativo/tabela/">Tabela dos criativos</a>.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {equipe && !equipe.length && <Aviso tipo="erro">Nenhum criativo cadastrado ainda.</Aviso>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5"><label htmlFor="cri" className="text-sm font-semibold">Criativo</label>
            <select id="cri" value={uid} onChange={(e) => setUid(e.target.value)} className={cx}>{(equipe ?? []).map((x) => <option key={x.uid} value={x.uid}>{x.nome}</option>)}</select></div>
          <div className="grid gap-1.5"><label htmlFor="mes" className="text-sm font-semibold">Mês do relatório</label>
            <select id="mes" value={mes} onChange={(e) => setMes(e.target.value)} className={cx}>{meses().map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}</select></div>
        </div>

        {uid && <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[["Pedidos em andamento", String(abertos.length)], ["Tarefas dele agora", String(nTarefas)], [`Relatório de ${nomeMes(mes)}`, rel === undefined ? "…" : rel ? (rel.status === "pago" ? "Pago" : "Enviado") : "Não enviado"], ["Total do mês", moeda(total)]].map(([a, b]) => (
              <div key={a} className="rounded border border-gray-200 bg-white px-4 py-3"><p className="text-xs uppercase tracking-wide text-gray-600">{a}</p><p className="font-display text-2xl font-semibold tabular-nums">{b}</p></div>
            ))}
          </div>

          <section className="grid gap-2" aria-labelledby="t1">
            <h2 id="t1" className="text-lg">Tarefas de {nome.split(" ")[0]} agora</h2>
            {!nTarefas ? <p className="rounded border border-dashed border-[#C9D7DC] bg-white px-4 py-5 text-center text-gray-600">Nenhuma peça aguardando o criativo.</p> : (
              <ul className="grid gap-1.5 text-sm">
                {aCriar.map((p) => (
                  <li key={p.protocolo} className="flex flex-wrap items-baseline gap-x-3 rounded border border-gray-200 bg-white px-3 py-2">
                    <a href={`/solicitacoes/pedido/?p=${encodeURIComponent(p.protocolo)}`} className="font-semibold text-marca-700 underline-offset-2 hover:underline">{p.protocolo}</a>
                    <b>{p.titulo}</b><span>Criar as peças</span>{p.prazo.primeira && <span className="text-gray-600">1ª apresentação {brData(p.prazo.primeira)}</span>}
                  </li>
                ))}
                {tarefas.map(({ p, x }) => (
                  <li key={`${p.protocolo}:${x.id}`} className="flex flex-wrap items-baseline gap-x-3 rounded border border-gray-200 bg-white px-3 py-2">
                    <a href={`/solicitacoes/pedido/?p=${encodeURIComponent(p.protocolo)}`} className="font-semibold text-marca-700 underline-offset-2 hover:underline">{p.protocolo}</a>
                    <b>{x.nome}</b><span>{t(situacaoInterna(x))}</span>
                    {prazoEtapa(x) && <span className="text-gray-600">prazo {brData(prazoEtapa(x)!)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-2" aria-labelledby="t2">
            <h2 id="t2" className="text-lg">Pedidos com {nome.split(" ")[0]}</h2>
            {!lista && <p className="text-gray-600" aria-busy="true">Carregando…</p>}
            {lista && !pedidos.length && <p className="rounded border border-dashed border-[#C9D7DC] bg-white px-4 py-5 text-center text-gray-600">Nenhum pedido atribuído a este criativo.</p>}
            {pedidos.length > 0 && (
              <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600"><tr><th className="px-3 py-2.5">Pedido</th><th className="px-3 py-2.5">Situação</th><th className="px-3 py-2.5">Peças</th><th className="px-3 py-2.5">Entrega final</th></tr></thead>
                  <tbody>
                    {pedidos.map((p) => (
                      <tr key={p.protocolo} className="border-t border-gray-200">
                        <td className="px-3 py-2.5"><a href={`/solicitacoes/pedido/?p=${encodeURIComponent(p.protocolo)}`} className="font-semibold text-marca-700 underline-offset-2 hover:underline">{p.protocolo}</a><div>{p.titulo}</div></td>
                        <td className="px-3 py-2.5">{t(NOME_STATUS[p.status])}</td>
                        <td className="px-3 py-2.5">{(p.pecas ?? []).filter((x) => x.etapa === "concluida").length} concluída(s) · {(p.pecas ?? []).filter((x) => !["concluida", "encerrada"].includes(x.etapa)).length} em andamento</td>
                        <td className="px-3 py-2.5">{p.prazo.final ? brData(p.prazo.final) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-2" aria-labelledby="t3">
            <h2 id="t3" className="text-lg">Relatório de {nomeMes(mes)}</h2>
            <p className="text-sm text-gray-600">{rel === undefined ? "Carregando…" : rel ? `${rel.status === "pago" ? `Pago em ${brDataHora(rel.pagoEm)} por ${rel.pagoPor}` : `Enviado à Marisa em ${brDataHora(rel.enviadoEm)}`}${rel.envios > 1 ? ` · ${rel.envios}ª versão` : ""}.` : "Ainda não enviado. Abaixo, a prévia do que ele verá, com os itens sugeridos pelo portal."}</p>
            <div className="overflow-x-auto rounded border border-gray-200 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600"><tr><th className="px-3 py-2.5">Pedido · peça</th><th className="px-3 py-2.5">Situação</th><th className="px-3 py-2.5">Item da tabela</th><th className="px-3 py-2.5 text-right">Valor</th></tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.chave} className="border-t border-gray-200 align-top">
                      <td className="px-3 py-2.5"><div className="text-xs font-semibold uppercase tracking-wide text-gray-600">{nomeClienteDaLinha(l)}</div><b>{l.peca}</b><div className="text-xs text-gray-600">{l.protocolo} · {l.titulo}</div></td>
                      <td className="px-3 py-2.5">{situacaoDaLinha(l)}<div className="text-xs text-gray-600">{brData(l.fechadaEm)} · {l.refacoes ? `${l.refacoes} refação(ões)` : "sem refação"}</div></td>
                      <td className="px-3 py-2.5">{rel?.itens?.[l.item] ?? tab?.itens.find((i) => i.id === l.item)?.nome ?? l.item}<div className="text-xs text-gray-600">{NOME_COLUNA[l.coluna]}</div></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{l.valor == null ? "A informar" : moeda(l.cobrado ?? cobradoDe(l))}{l.situacao === "cancelada" && l.valor != null && <div className="text-xs text-gray-600">50% de {moeda(l.valor)}</div>}</td>
                    </tr>
                  ))}
                  {!linhas.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-600">Nenhuma peça concluída ou cancelada em {nomeMes(mes)}.</td></tr>}
                </tbody>
                {linhas.length > 0 && <tfoot><tr className="border-t-2 border-ink-900 font-semibold"><td className="px-3 py-2.5" colSpan={3}>Total de {nomeMes(mes)}</td><td className="px-3 py-2.5 text-right tabular-nums">{moeda(total)}</td></tr></tfoot>}
              </table>
            </div>
          </section>
        </>}
      </div>
    </Casca>
  );
}

export default function VisaoCriativo() {
  return <Protegido papeis={["admin"]}><Conteudo /></Protegido>;
}
