"use client";
/* Relatórios: valores por pedido, período, unidade e etapa. Somente perfis com acesso a valores
   (Financeiro do cliente, Atendimento, Financeiro Propaga e Admin). Exporta planilha (CSV) e PDF (impressão). */
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { NOME_STATUS, VE_RELATORIOS } from "@/lib/fluxo";
import { hojeSP } from "@/lib/datas";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Aviso, Botao } from "@/components/ui";
import { brData, moeda, SeloStatus, type PedidoDoc } from "@/components/pedido";
import { CLIENTES } from "@/content/clientes";
import type { Status } from "@/lib/tipos";

interface Valores { protocolo: string; itens: { unitario: number | null; subtotal: number | null; orcado: boolean }[]; total: number; pendencias: number }
type Periodo = "7" | "30" | "ano" | "tudo";

const dataDe = (v: unknown) => (v && typeof v === "object" && "toDate" in v ? (v as { toDate: () => Date }).toDate() : new Date(0));
const isoSP = (d: Date) => hojeSP(d);
const centavos = (v: number) => Math.round(v * 100) / 100;
const ANDAMENTO: Status[] = ["producao", "apresentacao", "aprovada"];

function Kpi({ rotulo, valor, sub }: { rotulo: string; valor: string; sub: string }) {
  return (
    <div className="grid content-start gap-1 rounded border border-gray-200 bg-white p-4 break-inside-avoid">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">{rotulo}</span>
      <span className="font-display text-2xl font-semibold tabular-nums">{valor}</span>
      <span className="text-sm text-gray-600">{sub}</span>
    </div>
  );
}

function Conteudo() {
  const s = useSessao();
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  const cliente = CLIENTES[clienteId];
  const [pedidos, setPedidos] = useState<PedidoDoc[] | null>(null);
  const [valores, setValores] = useState<Record<string, Valores>>({});
  const [erro, setErro] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [unidade, setUnidade] = useState("todas");
  const [protocolo, setProtocolo] = useState("");

  useEffect(() => {
    const a = onSnapshot(collection(db(), "clientes", clienteId, "solicitacoes"),
      (q) => setPedidos(q.docs.map((d) => d.data() as PedidoDoc).sort((x, y) => dataDe(y.criadoEm).getTime() - dataDe(x.criadoEm).getTime())),
      () => setErro("Não foi possível carregar os pedidos."));
    const b = onSnapshot(collection(db(), "clientes", clienteId, "valores"),
      (q) => setValores(Object.fromEntries(q.docs.map((d) => [d.id, d.data() as Valores]))),
      () => setErro("Não foi possível carregar os valores."));
    return () => { a(); b(); };
  }, [clienteId]);

  const inicio = useMemo(() => {
    const hoje = new Date();
    if (periodo === "7") return isoSP(new Date(hoje.getTime() - 7 * 864e5));
    if (periodo === "30") return isoSP(new Date(hoje.getTime() - 30 * 864e5));
    if (periodo === "ano") return `${hojeSP().slice(0, 4)}-01-01`;
    return "0000-00-00";
  }, [periodo]);

  const sel = useMemo(() => (pedidos ?? []).filter((p) => protocolo ? p.protocolo === protocolo
    : isoSP(dataDe(p.criadoEm)) >= inicio && (unidade === "todas" || p.unidade === unidade)), [pedidos, protocolo, inicio, unidade]);

  const total = (p: PedidoDoc) => valores[p.protocolo]?.total ?? 0;
  const soma = (f: (p: PedidoDoc) => boolean) => centavos(sel.filter(f).reduce((a, p) => a + total(p), 0));
  const validos = sel.filter((p) => p.status !== "cancelada");
  const pendentes = sel.filter((p) => p.status === "enviada").reduce((a, p) => a + (valores[p.protocolo]?.pendencias ?? 0), 0);

  const porUnidade = useMemo(() => {
    const m = new Map<string, { n: number; v: number }>();
    for (const p of validos) { const x = m.get(p.unidade) ?? { n: 0, v: 0 }; x.n++; x.v = centavos(x.v + total(p)); m.set(p.unidade, x); }
    return [...m.entries()].sort((a, b) => b[1].v - a[1].v);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, valores]);

  const linhas = sel.flatMap((p) => p.itens.map((it, i) => ({ p, it, v: valores[p.protocolo]?.itens[i] })));

  function exportarPlanilha() {
    const n = (v: number | null | undefined) => (v == null ? "" : v.toFixed(2).replace(".", ","));
    const q = (t: string) => `"${String(t ?? "").replace(/"/g, '""')}"`;
    const cab = ["Protocolo", "Título", "Unidade", "Enviada em", "Etapa", "Código", "Serviço", "Modalidade e faixa", "Qtd.", "Unitário (R$)", "Subtotal (R$)", "Valor cotado"];
    const corpo = linhas.map(({ p, it, v }) => [p.protocolo, p.titulo, p.unidade, brData(isoSP(dataDe(p.criadoEm))), NOME_STATUS[p.status], it.cod, it.nome,
      it.varianteRotulo, String(it.qtd), n(v?.unitario), n(v?.subtotal), v?.orcado ? "sim" : v?.unitario == null ? "a cotar" : "não"].map(q).join(";"));
    const blob = new Blob(["﻿" + [cab.map(q).join(";"), ...corpo].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${clienteId}-${hojeSP()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Casca titulo="Relatórios">
      <div className="grid max-w-6xl gap-5">
        <p className="max-w-[75ch] text-gray-600 print:hidden">Somente preços finais {cliente.nome}. Pedidos cancelados não entram nos totais, e cada etapa é somada separadamente.</p>
        <p className="hidden text-sm print:block">{cliente.nome} · emitido em {brData(hojeSP())} · {protocolo || { "7": "últimos 7 dias", "30": "últimos 30 dias", ano: "ano corrente", tudo: "todo o período" }[periodo]}{unidade !== "todas" && !protocolo ? ` · ${unidade}` : ""}</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
            {([["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["ano", "Ano"], ["tudo", "Tudo"]] as [Periodo, string][]).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={!protocolo && periodo === k} onClick={() => { setPeriodo(k); setProtocolo(""); }}
                className={`min-h-11 rounded-full border px-4 text-sm ${!protocolo && periodo === k ? "border-ink-900 bg-ink-900 text-paper" : "border-[#C9D7DC] bg-white"}`}>{l}</button>
            ))}
          </div>
          <div className="grid gap-1.5"><label htmlFor="unidade" className="text-sm font-semibold">Unidade</label>
            <select id="unidade" value={unidade} onChange={(e) => { setUnidade(e.target.value); setProtocolo(""); }} className="min-h-11 rounded border border-[#C9D7DC] bg-white px-3">
              <option value="todas">Todas</option>{cliente.unidades.map((u) => <option key={u}>{u}</option>)}</select></div>
          <div className="grid gap-1.5"><label htmlFor="pedido" className="text-sm font-semibold">Pedido</label>
            <select id="pedido" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} className="min-h-11 max-w-72 rounded border border-[#C9D7DC] bg-white px-3">
              <option value="">Todos do período</option>{(pedidos ?? []).map((p) => <option key={p.protocolo} value={p.protocolo}>{p.protocolo} · {p.titulo}</option>)}</select></div>
          <div className="ml-auto flex gap-2">
            <Botao variante="discreto" onClick={exportarPlanilha} disabled={!linhas.length}>Exportar planilha</Botao>
            <Botao variante="discreto" onClick={() => window.print()}>Exportar PDF</Botao>
          </div>
        </div>

        {!pedidos && !erro && <p className="text-gray-600" aria-busy="true">Carregando…</p>}
        {pedidos && <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi rotulo="Pedidos" valor={String(validos.length)} sub={`${sel.length - validos.length} cancelado(s)`} />
            <Kpi rotulo="Em andamento" valor={moeda(soma((p) => ANDAMENTO.includes(p.status)))} sub={`${sel.filter((p) => ANDAMENTO.includes(p.status)).length} pedido(s) em produção ou aprovação`} />
            <Kpi rotulo="Entregue a faturar" valor={moeda(soma((p) => p.status === "entregue"))} sub={`${sel.filter((p) => p.status === "entregue").length} pedido(s)`} />
            <Kpi rotulo="Faturado" valor={moeda(soma((p) => p.status === "faturada" || p.status === "paga"))} sub={`Pago: ${moeda(soma((p) => p.status === "paga"))}`} />
            <Kpi rotulo="Aguardando aceite" valor={moeda(soma((p) => p.status === "enviada"))} sub={pendentes ? `+ ${pendentes} item(ns) a cotar` : "Nenhum item a cotar pendente"} />
          </div>

          {!protocolo && porUnidade.length > 0 && (
            <section className="grid gap-2 break-inside-avoid" aria-labelledby="h-unidade">
              <h2 id="h-unidade" className="text-lg">Por unidade</h2>
              <div className="relative overflow-x-auto rounded border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600"><tr><th className="px-3 py-2.5">Unidade</th><th className="px-3 py-2.5 text-right">Pedidos</th><th className="px-3 py-2.5 text-right">Valor</th></tr></thead>
                  <tbody>{porUnidade.map(([u, x]) => <tr key={u} className="border-t border-gray-200"><td className="px-3 py-2.5">{u}</td><td className="px-3 py-2.5 text-right tabular-nums">{x.n}</td><td className="px-3 py-2.5 text-right tabular-nums">{moeda(x.v)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}

          <section className="grid gap-2" aria-labelledby="h-itens">
            <h2 id="h-itens" className="text-lg">Itens</h2>
            <div className="relative overflow-x-auto rounded border border-gray-200 bg-white">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600">
                  <tr><th className="px-3 py-2.5">Protocolo</th><th className="px-3 py-2.5">Serviço</th><th className="px-3 py-2.5 text-right">Qtd.</th><th className="px-3 py-2.5 text-right">Unitário</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th><th className="px-3 py-2.5">Unidade</th><th className="px-3 py-2.5">Etapa</th></tr>
                </thead>
                <tbody>
                  {linhas.map(({ p, it, v }, i) => (
                    <tr key={`${p.protocolo}-${i}`} className={`border-t border-gray-200 ${p.status === "cancelada" ? "text-gray-600 line-through decoration-gray-200" : ""}`}>
                      <td className="whitespace-nowrap px-3 py-2.5"><a className="underline-offset-4 hover:underline" href={`/solicitacoes/pedido/?p=${encodeURIComponent(p.protocolo)}`}>{p.protocolo}</a></td>
                      <td className="px-3 py-2.5">{it.nome}<div className="text-gray-600">{it.varianteRotulo}{v?.orcado ? " · valor cotado" : ""}</div></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{it.qtd}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{moeda(v?.unitario)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{v?.subtotal == null ? "—" : moeda(v.subtotal)}</td>
                      <td className="px-3 py-2.5">{p.unidade}</td>
                      <td className="px-3 py-2.5"><SeloStatus status={p.status} /></td>
                    </tr>
                  ))}
                  {!linhas.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-600">Sem pedidos no período.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-600">Faturamento e pagamento aparecem quando registrados pelo Financeiro da Propaga.</p>
          </section>
        </>}
      </div>
    </Casca>
  );
}

export default function Relatorios() {
  return <Protegido papeis={VE_RELATORIOS}><Conteudo /></Protegido>;
}
