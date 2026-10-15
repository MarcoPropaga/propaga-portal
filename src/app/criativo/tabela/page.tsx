"use client";
/* Minha tabela — valores dos criativos (só os criativos e o administrador).
   Serviços fora da tabela: o criativo propõe, o admin aprova e o serviço entra aqui (Marco, 15/10/2026). */
import { useState } from "react";
import { Protegido } from "@/components/auth/protegido";
import { Casca } from "@/components/casca";
import { useSessao } from "@/components/auth/sessao";
import { Aviso, Botao } from "@/components/ui";
import { brDataHora } from "@/components/pedido";
import { NOME_COLUNA, REGRA_FORA_TABELA, VE_TABELA_CRIATIVO, type PropostaItem } from "@/lib/criativo";
import { useFila } from "@/lib/usarFila";
import { moeda, useAdicionais, useTabelaCriativo } from "@/lib/usarTabelaCriativo";
import type { Papel } from "@/lib/tipos";

const cx = "min-h-11 rounded border border-[#C9D7DC] bg-white px-3";
const numero = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));

function Decidir({ pr }: { pr: PropostaItem }) {
  const enviar = useFila();
  const [valor, setValor] = useState(String(pr.valor).replace(".", ","));
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function ir(acao: "aprovar" | "recusar") {
    setOcupado(true); setMsg(null);
    const r = await enviar("tabelaCriativo", acao === "aprovar" ? { acao, id: pr.id, valor: numero(valor) } : { acao, id: pr.id, motivo: motivo.trim() });
    setOcupado(false);
    if (!r.ok) setMsg({ tipo: "erro", msg: r.msg });
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5"><label htmlFor={`v-${pr.id}`} className="text-sm">Valor acordado (R$)</label>
          <input id={`v-${pr.id}`} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className={`${cx} w-36 text-right`} /></div>
        <Botao onClick={() => ir("aprovar")} carregando={ocupado && !recusando}>Aprovar e incluir na tabela</Botao>
        {!recusando && <Botao variante="linha" className="!border-alerta-700 !text-alerta-700" onClick={() => setRecusando(true)}>Recusar</Botao>}
      </div>
      {recusando && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-0 flex-1 gap-1.5"><label htmlFor={`m-${pr.id}`} className="text-sm">Motivo (vai para o criativo)</label>
            <input id={`m-${pr.id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} className={`${cx} w-full`} /></div>
          <Botao variante="linha" className="!border-alerta-700 !text-alerta-700" onClick={() => ir("recusar")} carregando={ocupado}>Confirmar recusa</Botao>
          <Botao variante="discreto" onClick={() => setRecusando(false)}>Voltar</Botao>
        </div>
      )}
      {msg && <Aviso tipo={msg.tipo}>{msg.msg}</Aviso>}
    </div>
  );
}

function Conteudo() {
  const { tab, erro } = useTabelaCriativo();
  const ad = useAdicionais();
  const s = useSessao();
  const admin = s.papel === "admin";
  const pend = (ad?.propostas ?? []).filter((x) => x.status === "pendente");
  const decididas = (ad?.propostas ?? []).filter((x) => x.status !== "pendente").slice(-10).reverse();
  return (
    <Casca titulo={admin ? "Tabela de valores dos criativos" : "Minha tabela de valores"}>
      <div className="grid max-w-5xl gap-5">
        <p className="max-w-[75ch] text-gray-600">Valores unitários dos serviços de criação. Só os criativos e a administração da Propaga veem esta tabela. No fim do mês, o relatório usa estes valores para cada peça concluída ou cancelada.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        {pend.length > 0 && (
          <section className="grid gap-3 rounded border border-marca-500 bg-white p-4" aria-labelledby="pend">
            <h2 id="pend" className="text-lg">{admin ? "Serviços novos para aprovar" : "Propostas aguardando aprovação"} <span className="text-gray-600">({pend.length})</span></h2>
            {pend.map((pr) => (
              <div key={pr.id} className="grid gap-2 border-t border-gray-200 pt-3 first-of-type:border-0 first-of-type:pt-0">
                <p><b>{pr.nome}</b> · {NOME_COLUNA[pr.coluna]} · <span className="tabular-nums">{moeda(pr.valor)}</span></p>
                <p className="text-sm text-gray-600">Proposto por {pr.criativo} em {brDataHora(pr.em)} · pedido {pr.protocolo} · serviço pedido: {pr.servico}{pr.obs ? ` · ${pr.obs}` : ""}</p>
                {admin && <Decidir pr={pr} />}
              </div>
            ))}
          </section>
        )}

        {!tab && !erro && <p className="text-gray-600" aria-busy="true">Carregando…</p>}
        {tab && (
          <div className="relative overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600">
                <tr><th className="px-3 py-2.5">Material / serviço</th><th className="px-3 py-2.5 text-right">Adaptação</th><th className="px-3 py-2.5 text-right">Nova criação</th><th className="px-3 py-2.5">Observações</th></tr>
              </thead>
              <tbody>
                {tab.itens.map((i) => (
                  <tr key={i.id} className={`border-t border-gray-200 ${i.acordado ? "bg-marca-100/30" : ""}`}>
                    <td className="px-3 py-2.5 font-semibold">{i.nome}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{i.sobConsulta ? "—" : moeda(i.adaptacao)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{i.sobConsulta ? "Sob consulta" : moeda(i.nova)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{[i.obs, i.acordado].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-gray-600">{REGRA_FORA_TABELA} Projetos complexos e pontuais seguem sob consulta: o valor é informado no relatório do mês. Tabela revisada · versão {tab?.versao ?? "—"}.</p>

        {decididas.length > 0 && (
          <section className="grid gap-2" aria-labelledby="hist">
            <h2 id="hist" className="text-lg">Propostas decididas</h2>
            <ul className="grid gap-1.5 text-sm">
              {decididas.map((pr) => (
                <li key={pr.id} className="rounded border border-gray-200 bg-white px-3 py-2">
                  <b>{pr.nome}</b> · {NOME_COLUNA[pr.coluna]} · {moeda(pr.valor)} — {pr.status === "aprovada" ? "aprovada" : `recusada: ${pr.motivo}`} por {pr.decididoPor} em {brDataHora(pr.decididoEm)} <span className="text-gray-600">({pr.criativo} · {pr.protocolo})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Casca>
  );
}

export default function MinhaTabela() {
  return <Protegido papeis={VE_TABELA_CRIATIVO as Papel[]}><Conteudo /></Protegido>;
}
