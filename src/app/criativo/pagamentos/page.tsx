"use client";
/* Pagamento dos criativos — Marisa (Financeiro Propaga) confere o relatório mensal enviado e registra o pagamento.
   Mostra só o que a Mariane enviou (peças, itens e valores); a tabela e o contrato dela não ficam acessíveis aqui. */
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Protegido } from "@/components/auth/protegido";
import { Casca } from "@/components/casca";
import { useSessao } from "@/components/auth/sessao";
import { Aviso, Botao } from "@/components/ui";
import { brData, brDataHora } from "@/components/pedido";
import { cobradoDe, nomeClienteDaLinha, situacaoDaLinha, totaisPorCliente, REGRA_CANCELADA_CRIATIVO, NOME_COLUNA, nomeMes, VE_PAGAMENTO_CRIATIVO, type RelatorioCriativo } from "@/lib/criativo";
import { useFila } from "@/lib/usarFila";
import { moeda } from "@/lib/usarTabelaCriativo";
import type { Papel } from "@/lib/tipos";

function Conteudo() {
  const [lista, setLista] = useState<RelatorioCriativo[] | null>(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState<string>(() => (typeof window !== "undefined" && new URLSearchParams(location.search).get("id")) || "");
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enviar = useFila();
  const s = useSessao();

  useEffect(() => onSnapshot(collection(db(), "relatoriosCriativo"),
    (q) => setLista(q.docs.map((d) => d.data() as RelatorioCriativo).sort((a, b) => b.mes.localeCompare(a.mes) || a.nome.localeCompare(b.nome))),
    () => setErro("Não foi possível carregar os relatórios.")), []);
  useEffect(() => { if (!aberto && lista?.length) setAberto((lista.find((r) => r.status === "enviado") ?? lista[0]).id); }, [lista, aberto]);

  const r = lista?.find((x) => x.id === aberto);
  async function pagar() {
    setOcupado(true); setMsg(null);
    const res = await enviar("pagarCriativo", { id: aberto, nota: nota.trim() || undefined });
    setOcupado(false);
    setMsg(res.ok ? { tipo: "ok", msg: `Pagamento registrado. ${r?.nome.split(" ")[0] ?? "O criativo"} foi avisado(a) por e-mail.` } : { tipo: "erro", msg: res.msg });
    if (res.ok) setNota("");
  }

  return (
    <Casca titulo="Pagamento dos criativos">
      <div className="grid max-w-6xl gap-5">
        {s.papel === "admin" && <a href="/criativo/tabela/" className="w-fit text-sm font-semibold text-marca-700 underline-offset-2 hover:underline">Ver a tabela de valores dos criativos (só administrador)</a>}
        <p className="max-w-[75ch] text-gray-600">Relatórios mensais enviados pelos criativos da Propaga, com as peças concluídas ou canceladas e os valores que cada um cobra. {REGRA_CANCELADA_CRIATIVO} Confira e registre o pagamento.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {!lista && !erro && <p className="text-gray-600" aria-busy="true">Carregando…</p>}
        {lista && !lista.length && <p className="rounded border border-dashed border-[#C9D7DC] bg-white px-4 py-8 text-center text-gray-600">Nenhum relatório enviado ainda.</p>}
        {lista && lista.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Meses">
            {lista.map((x) => (
              <button key={x.id} type="button" aria-pressed={x.id === aberto} onClick={() => { setAberto(x.id); setMsg(null); }}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium ${x.id === aberto ? "border-ink-900 bg-ink-900 text-paper" : "border-[#C9D7DC] bg-white"}`}>
                {x.nome.split(" ")[0]} · {nomeMes(x.mes)} <span className="opacity-80">{x.status === "pago" ? "· pago" : "· a pagar"}</span>
              </button>
            ))}
          </div>
        )}
        {r && <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[["Peças", String(r.linhas.length)], ["Aprovadas", String(r.linhas.filter((l) => l.situacao === "aprovada").length)], ["Canceladas", String(r.linhas.filter((l) => l.situacao === "cancelada").length)], ["Total", moeda(r.total)]].map(([a, b]) => (
              <div key={a} className="rounded border border-gray-200 bg-white px-4 py-3"><p className="text-xs uppercase tracking-wide text-gray-600">{a}</p><p className="font-display text-2xl font-semibold tabular-nums">{b}</p></div>
            ))}
          </div>
          {totaisPorCliente(r.linhas).length > 1 && <p className="text-sm text-gray-600">Por cliente: {totaisPorCliente(r.linhas).map((c) => `${c.nome} ${moeda(c.total)} (${c.pecas})`).join(" · ")}.</p>}
          <p className="text-sm text-gray-600">Enviado por {r.enviadoPor} em {brDataHora(r.enviadoEm)}{r.envios > 1 ? ` (${r.envios}ª versão)` : ""}.</p>
          <div className="relative overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600">
                <tr><th className="px-3 py-2.5">Cliente · pedido · peça</th><th className="px-3 py-2.5">Situação</th><th className="px-3 py-2.5">Serviço cobrado</th><th className="px-3 py-2.5 text-right">Valor</th></tr>
              </thead>
              <tbody>
                {r.linhas.map((l) => (
                  <tr key={l.chave} className="border-t border-gray-200 align-top">
                    <td className="px-3 py-2.5"><div className="text-xs font-semibold uppercase tracking-wide text-gray-600">{nomeClienteDaLinha(l)}</div><b>{l.peca}</b><div className="text-xs text-gray-600">{l.protocolo} · {l.titulo}</div>{l.avaliacao && <div className="text-xs font-semibold text-marca-900">Avaliação</div>}</td>
                    <td className="px-3 py-2.5">{situacaoDaLinha(l)}<div className="text-xs text-gray-600">{brData(l.fechadaEm)} · {l.refacoes ? `${l.refacoes} refação(ões)` : "sem refação"}</div></td>
                    <td className="px-3 py-2.5">{r.itens?.[l.item] ?? l.item}<div className="text-xs text-gray-600">{NOME_COLUNA[l.coluna]}</div></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{moeda(l.cobrado ?? cobradoDe(l))}{l.situacao === "cancelada" && <div className="text-xs text-gray-600">50% de {moeda(l.valor)}</div>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-ink-900 font-semibold"><td className="px-3 py-2.5" colSpan={3}>Total de {nomeMes(r.mes)}</td><td className="px-3 py-2.5 text-right tabular-nums">{moeda(r.total)}</td></tr></tfoot>
            </table>
          </div>
          {msg && <Aviso tipo={msg.tipo}>{msg.msg}</Aviso>}
          {r.status === "pago"
            ? <Aviso tipo="ok">Pago em {brDataHora(r.pagoEm)} por {r.pagoPor}{r.notaPagamento ? ` · ${r.notaPagamento}` : ""}.</Aviso>
            : (
              <section className="grid gap-3 rounded border border-marca-500 bg-white p-4 print:hidden" aria-label="Registrar pagamento">
                <label htmlFor="nota" className="text-sm font-semibold">Observação do pagamento (opcional)</label>
                <input id="nota" value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: PIX em 05/11, NF 123" className="min-h-11 w-full rounded border border-[#C9D7DC] bg-white px-3" />
                <Botao className="justify-self-start" onClick={pagar} carregando={ocupado}>Registrar pagamento de {moeda(r.total)}</Botao>
              </section>
            )}
        </>}
      </div>
    </Casca>
  );
}

export default function PagamentoCriativos() {
  return <Protegido papeis={VE_PAGAMENTO_CRIATIVO as Papel[]}><Conteudo /></Protegido>;
}
