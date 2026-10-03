"use client";
/* Lista de solicitações. Solicitante vê só as próprias (regra do banco); demais perfis veem todas do cliente. */
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { NOME_STATUS } from "@/lib/fluxo";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Aviso } from "@/components/ui";
import { brData, brDataHora, SeloStatus, type PedidoDoc } from "@/components/pedido";
import { CLIENTES } from "@/content/clientes";
import type { Status } from "@/lib/tipos";

const ordem = (v: unknown) => (v && typeof v === "object" && "toMillis" in v ? (v as { toMillis: () => number }).toMillis() : 0);

function Conteudo() {
  const s = useSessao();
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  const [lista, setLista] = useState<PedidoDoc[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [etapa, setEtapa] = useState<"abertas" | "todas" | Status>("abertas");

  useEffect(() => {
    const col = collection(db(), "clientes", clienteId, "solicitacoes");
    const q = s.papel === "solicitante" ? query(col, where("solicitanteUid", "==", s.usuario!.uid)) : col;
    return onSnapshot(q, (snap) => setLista(snap.docs.map((d) => d.data() as PedidoDoc).sort((a, b) => ordem(b.criadoEm) - ordem(a.criadoEm))),
      () => setErro("Não foi possível carregar as solicitações. Atualize a página."));
  }, [clienteId, s.papel, s.usuario]);

  const filtrada = useMemo(() => (lista ?? []).filter((p) => {
    if (etapa === "abertas" && ["paga", "cancelada"].includes(p.status)) return false;
    if (etapa !== "abertas" && etapa !== "todas" && p.status !== etapa) return false;
    const t = busca.trim().toLowerCase();
    return !t || [p.protocolo, p.titulo, p.unidade, p.solicitanteNome].some((x) => x?.toLowerCase().includes(t));
  }), [lista, etapa, busca]);

  const podeSolicitar = s.papel === "solicitante" || s.papel === "admin";
  return (
    <Casca titulo="Solicitações">
      <div className="grid max-w-6xl gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="busca" className="text-sm font-semibold">Buscar</label>
            <input id="busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Protocolo, título ou unidade"
              className="min-h-11 w-72 max-w-full rounded border border-[#C9D7DC] bg-white px-3" />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="etapa" className="text-sm font-semibold">Etapa</label>
            <select id="etapa" value={etapa} onChange={(e) => setEtapa(e.target.value as typeof etapa)} className="min-h-11 rounded border border-[#C9D7DC] bg-white px-3">
              <option value="abertas">Em andamento</option>
              <option value="todas">Todas</option>
              {(Object.keys(NOME_STATUS) as Status[]).filter((x) => x !== "rascunho").map((x) => <option key={x} value={x}>{NOME_STATUS[x]}</option>)}
            </select>
          </div>
          {podeSolicitar && <a href="/nova-solicitacao/" className="ml-auto inline-flex min-h-11 items-center rounded bg-marca-500 px-5 font-semibold text-ink-900 hover:brightness-105">+ Nova solicitação</a>}
        </div>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {!lista && !erro && <p className="text-gray-600" aria-busy="true">Carregando…</p>}
        {lista && (
          <div className="relative overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Solicitações ({filtrada.length})</caption>
              <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600">
                <tr><th className="px-3 py-2.5">Protocolo</th><th className="px-3 py-2.5">Solicitação</th><th className="px-3 py-2.5">Unidade</th>
                  <th className="px-3 py-2.5">Data desejada</th><th className="px-3 py-2.5">Etapa</th><th className="px-3 py-2.5">Enviada em</th></tr>
              </thead>
              <tbody>
                {filtrada.map((p) => (
                  <tr key={p.protocolo} className="border-t border-gray-200 hover:bg-paper">
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold"><a className="underline-offset-4 hover:underline" href={`/solicitacoes/pedido/?p=${encodeURIComponent(p.protocolo)}`}>{p.protocolo}</a></td>
                    <td className="px-3 py-2.5"><a href={`/solicitacoes/pedido/?p=${encodeURIComponent(p.protocolo)}`} className="font-semibold">{p.titulo}</a>
                      <div className="text-gray-600">{p.solicitanteNome} · {p.itens.length} serviço{p.itens.length > 1 ? "s" : ""}</div></td>
                    <td className="px-3 py-2.5">{p.unidade}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{brData(p.prazo.desejada)}{p.prazo.urgente && <span className="ml-1.5 text-xs font-semibold text-alerta-700">urgente</span>}</td>
                    <td className="px-3 py-2.5"><SeloStatus status={p.status} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{brDataHora(p.criadoEm)}</td>
                  </tr>
                ))}
                {!filtrada.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-600">{lista.length ? "Nenhuma solicitação com esses filtros." : "Nenhuma solicitação ainda."}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Casca>
  );
}

export default function Solicitacoes() {
  return <Protegido><Conteudo /></Protegido>;
}
