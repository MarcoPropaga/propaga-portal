"use client";
/* Meu relatório — peças da Mariane fechadas no mês, com os valores da tabela dela, e envio à Marisa (Financeiro Propaga). */
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Protegido } from "@/components/auth/protegido";
import { Casca } from "@/components/casca";
import { useSessao } from "@/components/auth/sessao";
import { Aviso, Botao } from "@/components/ui";
import { brData, brDataHora } from "@/components/pedido";
import { idRelatorio, aplicarAjustes, cobradoDe, REGRA_CANCELADA_CRIATIVO, REGRA_COMPLEXO_CRIATIVO, colunasDo, NOME_COLUNA, nomeMes, pecasDoMes, totalLinhas, valorTabela,   type Coluna, type LinhaCriativo, type RelatorioCriativo } from "@/lib/criativo";
import { hojeSP } from "@/lib/datas";
import { useFila, usePedidos } from "@/lib/usarFila";
import { moeda, useTabelaCriativo } from "@/lib/usarTabelaCriativo";
import type { Papel } from "@/lib/tipos";
import { useTxt } from "@/components/tema";
import { CLIENTE_PADRAO } from "@/content/clientes";

const ultimosMeses = (n = 12) => {
  const [a, m] = hojeSP().slice(0, 7).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(a, m - 1 - i, 1)); return d.toISOString().slice(0, 7); });
};
const cx = "min-h-10 w-full rounded border border-[#C9D7DC] bg-white px-2 text-sm";

function Conteudo() {
  const t = useTxt();
  const meses = useMemo(() => ultimosMeses(), []);
  const [mes, setMes] = useState(() => (typeof window !== "undefined" && new URLSearchParams(location.search).get("mes")) || meses[0]);
  const { tab, erro: erroTab } = useTabelaCriativo();
  const { lista, erro } = usePedidos(true, CLIENTE_PADRAO);
  const enviar = useFila();
  const uid = useSessao().usuario?.uid ?? "";
  const [rel, setRel] = useState<RelatorioCriativo | null | undefined>(undefined);
  const [edits, setEdits] = useState<Record<string, { item: string; coluna: Coluna; valor?: number }>>({});
  const [corrigir, setCorrigir] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { setRel(undefined); setEdits({}); setCorrigir(false); setAviso(null);
    return onSnapshot(doc(db(), "relatoriosCriativo", idRelatorio(uid, mes)), (d) => setRel(d.exists() ? (d.data() as RelatorioCriativo) : null), () => setRel(null)); }, [mes, uid]);

  const base = useMemo(() => (tab && lista ? pecasDoMes(lista, mes, tab, uid) : []), [tab, lista, mes, uid]);
  // Ao corrigir um relatório já enviado, parte do que foi enviado.
  useEffect(() => {
    if (!corrigir || !rel) return;
    setEdits(Object.fromEntries(rel.linhas.map((l) => [l.chave, { item: l.item, coluna: l.coluna, valor: l.valor ?? undefined }])));
  }, [corrigir, rel]);
  const linhas: LinhaCriativo[] = useMemo(() => base.map((l) => {
    const e = edits[l.chave]; if (!e || !tab) return l;
    const it = tab.itens.find((x) => x.id === e.item);
    return { ...l, item: e.item, coluna: e.coluna, valor: it?.sobConsulta ? (e.valor ?? null) : valorTabela(tab, e.item, e.coluna) };
  }), [base, edits, tab]);

  const enviado = !!rel && !corrigir;
  const vis = enviado ? rel!.linhas : linhas;
  const total = totalLinhas(vis);
  const nomeItem = (id: string) => tab?.itens.find((x) => x.id === id)?.nome ?? rel?.itens?.[id] ?? id;

  function mudar(l: LinhaCriativo, p: Partial<{ item: string; coluna: Coluna; valor?: number }>) {
    const atual: { item: string; coluna: Coluna; valor?: number } = Object.assign({ item: l.item, coluna: l.coluna, valor: l.valor ?? undefined }, edits[l.chave], p);
    if (p.item && tab) { const cols = colunasDo(tab, p.item); if (!cols.includes(atual.coluna)) atual.coluna = cols[0]; }
    setEdits({ ...edits, [l.chave]: atual });
  }

  async function enviarMarisa() {
    if (!tab) return;
    const ajustes = linhas.map((l) => ({ chave: l.chave, item: l.item, coluna: l.coluna, ...(l.valor != null ? { valor: l.valor } : {}) }));
    const r = aplicarAjustes(tab, base, ajustes);
    if (typeof r === "string") { setAviso({ tipo: "erro", msg: r }); return; }
    setOcupado(true); setAviso(null);
    const res = await enviar("relatorioCriativo", { mes, ajustes });
    setOcupado(false);
    if (res.ok) { setCorrigir(false); setAviso({ tipo: "ok", msg: `Relatório de ${nomeMes(mes)} enviado para a Marisa.` }); }
    else setAviso({ tipo: "erro", msg: res.msg });
  }

  const aprov = vis.filter((l) => l.situacao === "aprovada").length, canc = vis.length - aprov;
  const refs = vis.reduce((t, l) => t + l.refacoes, 0);

  return (
    <Casca titulo="Meu relatório do mês">
      <div className="grid max-w-6xl gap-5">
        <p className="max-w-[75ch] text-gray-600">{t("Peças que você criou e que foram concluídas ou canceladas pela {cliente} no mês, com os valores da sua tabela. Confira cada linha e envie para a Marisa (Financeiro Propaga).")}</p>
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="grid gap-1.5">
            <label htmlFor="mes" className="text-sm font-semibold">Mês</label>
            <select id="mes" value={mes} onChange={(e) => setMes(e.target.value)} className="min-h-11 rounded border border-[#C9D7DC] bg-white px-3">
              {meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
            </select>
          </div>
          {rel && (
            <span className={`mb-2 rounded-full px-3 py-1 text-xs font-semibold ${rel.status === "pago" ? "bg-[#E3F2EA] text-[#1E7047]" : "bg-marca-100 text-marca-900"}`}>
              {rel.status === "pago" ? `Pago em ${brDataHora(rel.pagoEm)} por ${rel.pagoPor}` : `Enviado à Marisa em ${brDataHora(rel.enviadoEm)}${rel.envios > 1 ? ` · ${rel.envios}ª versão` : ""}`}
            </span>
          )}
        </div>
        {(erroTab || erro) && <Aviso tipo="erro">{erroTab || erro}</Aviso>}
        {aviso && <Aviso tipo={aviso.tipo}>{aviso.msg}</Aviso>}
        {(!tab || !lista || rel === undefined) && !erroTab && !erro && <p className="text-gray-600" aria-busy="true">Carregando…</p>}

        {tab && lista && rel !== undefined && <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[["Peças", String(vis.length)], ["Aprovadas", String(aprov)], ["Canceladas", String(canc)], ["Total", moeda(total)]].map(([a, b]) => (
              <div key={a} className="rounded border border-gray-200 bg-white px-4 py-3"><p className="text-xs uppercase tracking-wide text-gray-600">{a}</p><p className="font-display text-2xl font-semibold tabular-nums">{b}</p></div>
            ))}
          </div>
          <div className="relative overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600">
                <tr><th className="px-3 py-2.5">Pedido · peça</th><th className="px-3 py-2.5">Situação</th><th className="px-3 py-2.5">Item da sua tabela</th><th className="min-w-[160px] px-3 py-2.5">Tipo</th><th className="px-3 py-2.5 text-right">Valor</th></tr>
              </thead>
              <tbody>
                {vis.map((l) => {
                  const it = tab.itens.find((x) => x.id === l.item);
                  return (
                    <tr key={l.chave} className="border-t border-gray-200 align-top">
                      <td className="px-3 py-2.5"><b>{l.peca}</b><div className="text-xs text-gray-600">{l.protocolo} · {l.titulo}</div><div className="text-xs text-gray-600">Pedido do Marcelo: {l.servico}</div></td>
                      <td className="px-3 py-2.5">{l.situacao === "aprovada" ? "Aprovada" : t("Cancelada pela {cliente}")}<div className="text-xs text-gray-600">{brData(l.fechadaEm)} · {l.refacoes ? `${l.refacoes} refação(ões)` : "sem refação"}</div></td>
                      <td className="px-3 py-2.5">{enviado ? nomeItem(l.item) : (
                        <select aria-label={`Item da tabela para ${l.peca}`} className={cx} value={l.item} onChange={(e) => mudar(l, { item: e.target.value })}>
                          {tab.itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                        </select>)}</td>
                      <td className="px-3 py-2.5">{enviado ? NOME_COLUNA[l.coluna] : (
                        <select aria-label={`Tipo para ${l.peca}`} className={cx} value={l.coluna} onChange={(e) => mudar(l, { coluna: e.target.value as Coluna })}>
                          {colunasDo(tab, l.item).map((c) => <option key={c} value={c}>{NOME_COLUNA[c]}</option>)}
                        </select>)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{!enviado && it?.sobConsulta ? (
                        <div className="flex items-center justify-end gap-1.5"><span className="text-gray-600">R$</span>
                          <input aria-label={`Valor de ${l.peca} (sob consulta)`} inputMode="decimal" placeholder="Sob consulta" className={`${cx} w-28 text-right`}
                            defaultValue={l.valor != null ? String(l.valor).replace(".", ",") : ""}
                            onChange={(e) => { const v = Number(e.target.value.replace(/\./g, "").replace(",", ".")); mudar(l, { valor: v > 0 ? v : undefined }); }} /></div>
                      ) : l.valor == null ? <span className="text-alerta-700">Informe o valor</span> : moeda(cobradoDe(l))}{l.situacao === "cancelada" && l.valor != null && <div className="text-xs font-normal text-gray-600">50% de {moeda(l.valor)}</div>}</td>
                    </tr>
                  );
                })}
                {!vis.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-600">Nenhuma peça concluída ou cancelada em {nomeMes(mes)}.</td></tr>}
              </tbody>
              {vis.length > 0 && <tfoot><tr className="border-t-2 border-ink-900 font-semibold"><td className="px-3 py-2.5" colSpan={4}>Total de {nomeMes(mes)} · {vis.length} peça(s){refs ? ` · ${refs} refação(ões) sem valor extra` : ""}</td><td className="px-3 py-2.5 text-right tabular-nums">{moeda(total)}</td></tr></tfoot>}
            </table>
          </div>
          <p className="text-sm text-gray-600">{t(REGRA_CANCELADA_CRIATIVO)} {REGRA_COMPLEXO_CRIATIVO} O item foi sugerido pelo serviço que o Marcelo escolheu; ajuste quando não corresponder.</p>
          <div className="flex flex-wrap gap-3 print:hidden">
            {!rel && vis.length > 0 && <Botao onClick={enviarMarisa} carregando={ocupado}>Enviar para a Marisa</Botao>}
            {rel?.status === "enviado" && !corrigir && <Botao variante="linha" onClick={() => setCorrigir(true)}>Corrigir e reenviar</Botao>}
            {corrigir && <><Botao onClick={enviarMarisa} carregando={ocupado}>Reenviar para a Marisa</Botao><Botao variante="discreto" onClick={() => { setCorrigir(false); setEdits({}); }}>Cancelar correção</Botao></>}
            {vis.length > 0 && <Botao variante="discreto" onClick={() => window.print()}>Imprimir ou salvar em PDF</Botao>}
          </div>
        </>}
      </div>
    </Casca>
  );
}

export default function MeuRelatorio() {
  return <Protegido papeis={["criativo"]}><Conteudo /></Protegido>;
}
