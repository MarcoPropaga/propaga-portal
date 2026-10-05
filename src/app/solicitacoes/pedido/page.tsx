"use client";
/* Detalhe do pedido: dados, serviços, cronograma, histórico e as ações permitidas ao perfil.
   As ações vão para a /fila; o servidor valida perfil e etapa e grava a mudança. */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { avisarServidor, db } from "@/lib/firebase";
import { ETAPAS, fatorCobranca, podeExecutar, VE_VALORES_PEDIDO, type Acao } from "@/lib/fluxo";
import { hojeSP, somarDiasUteis, PRAZO_PADRAO_DIAS_UTEIS } from "@/lib/datas";
import { acaoSchema } from "@/lib/schemas";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Aviso, Botao } from "@/components/ui";
import { brData, brDataHora, moeda, Painel, SeloStatus, type PedidoDoc } from "@/components/pedido";
import { CLIENTES } from "@/content/clientes";
import type { Papel } from "@/lib/tipos";
import { contarPendencias, situacaoInterna, situacaoRelatorio, ultima } from "@/lib/pecas";
import { FormPublicar } from "@/components/publicar";
import { FormAcao } from "@/components/formAcao";

interface Evento { id: string; em: unknown; nome: string; rotulo: string; nota?: string; chave?: boolean; acao?: string }
interface Valores { itens: { unitario: number | null; subtotal: number | null; orcado: boolean }[]; total: number; pendencias: number }
type Envio = { tipo: "ocioso" } | { tipo: "aguardando"; id: string } | { tipo: "ok"; msg: string } | { tipo: "erro"; msg: string };

const cx = "min-h-11 w-full rounded border border-[#C9D7DC] bg-white px-3";
const ACOES_PECA = ["publicar", "avaliar", "encaminhar", "enviarVersao", "finalizar", "ciente", "liberar", "devolver"];
const ms = (v: unknown) => (v && typeof v === "object" && "toMillis" in v ? (v as { toMillis: () => number }).toMillis() : 0);

function Conteudo() {
  const s = useSessao();
  const protocolo = useSearchParams().get("p") ?? "";
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  const [pedido, setPedido] = useState<PedidoDoc | null | undefined>(undefined);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [valores, setValores] = useState<Valores | null>(null);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [publicando, setPublicando] = useState(false);
  const veValores = !!s.papel && VE_VALORES_PEDIDO.includes(s.papel);

  useEffect(() => {
    if (!protocolo) { setPedido(null); return; }
    const ref = doc(db(), "clientes", clienteId, "solicitacoes", protocolo);
    const a = onSnapshot(ref, (d) => setPedido(d.exists() ? (d.data() as PedidoDoc) : null), () => setPedido(null));
    const b = onSnapshot(collection(ref, "eventos"), (q) => setEventos(q.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Evento, "id">) })).sort((x, y) => ms(y.em) - ms(x.em) || y.id.localeCompare(x.id))), () => {});
    const c = veValores ? onSnapshot(doc(db(), "clientes", clienteId, "valores", protocolo), (d) => setValores(d.exists() ? (d.data() as Valores) : null), () => {}) : () => {};
    return () => { a(); b(); c(); };
  }, [protocolo, clienteId, veValores]);

  if (pedido === undefined) return <Casca titulo="Solicitação"><p className="text-gray-600" aria-busy="true">Carregando…</p></Casca>;
  if (pedido && s.papel === "criativo" && ["proposta", "ajuste", "enviada"].includes(pedido.status)) return <Casca titulo="Solicitação"><Aviso>Este pedido ainda está com o Atendimento. Ele aparece para você quando o Marcelo aceitar.</Aviso></Casca>;
  if (pedido === null) return <Casca titulo="Solicitação"><Aviso tipo="erro">Pedido não encontrado ou sem acesso para o seu perfil.</Aviso><a href="/solicitacoes/" className="mt-4 inline-block underline">Voltar para Solicitações</a></Casca>;

  // Consulta: ações ficam em Minhas tarefas. Aqui só o admin tem atalhos (cancelar o pedido / publicar em emergência).
  const ehAdmin = s.papel === "admin";
  const podeCancelar = ehAdmin && podeExecutar("cancelar", pedido.status, "admin");
  const podePublicar = ehAdmin && ["producao", "apresentacao"].includes(pedido.status);
  const minhas = contarPendencias(s.papel, [pedido]) > 0 && (s.papel !== "solicitante" || pedido.solicitanteUid === s.usuario?.uid);
  const ehCliente = s.papel === "solicitante" || s.papel === "financeiro_cliente";
  // Linha do tempo única: eventos do pedido + ações de cada peça, do mais recente para o mais antigo.
  const tms = (v: unknown) => (v && typeof v === "object" && "toMillis" in v ? (v as { toMillis: () => number }).toMillis() : Date.parse(String(v)) || 0);
  const linhaDoTempo = [
    // Ações de peça já aparecem no histórico de cada peça: não repetir o resumo do pedido.
    ...eventos.filter((e) => !String(e.rotulo).startsWith("Aviso por e-mail") && !ACOES_PECA.includes(e.acao ?? "")),
    ...(pedido.pecas ?? []).flatMap((x) => x.hist.map((h, k) => ({ id: `${x.id}-${k}`, em: h.em, nome: h.por, rotulo: `${x.nome}: ${h.txt}`, chave: false, nota: "" }))),
  ].sort((a, b) => tms(b.em) - tms(a.em));
  const idxAtual = ETAPAS.findIndex((e) => e.status === pedido.status);
  const p = pedido.prazo;

  return (
    <Casca titulo={pedido.titulo}>
      <div className="grid max-w-6xl gap-5">
        <nav aria-label="Trilha" className="text-sm text-gray-600"><a href="/solicitacoes/" className="underline-offset-4 hover:underline">Solicitações</a> / {pedido.protocolo}</nav>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-xl font-semibold">{pedido.protocolo}</span>
          <SeloStatus status={pedido.status} />
          <span className="text-sm text-gray-600">{pedido.criadoPor ? `Criada por ${pedido.criadoPor.nome} em nome de ${pedido.solicitanteNome}` : `Enviada por ${pedido.solicitanteNome}`} em {brDataHora(pedido.criadoEm)}</span>
        </div>

        {/* Etapas */}
        {(pedido.status === "proposta" || pedido.status === "ajuste") && <Aviso>{pedido.status === "proposta"
          ? "Solicitação criada pelo Marcelo, aguardando a Débora aprovar, pedir ajuste ou recusar."
          : "A Débora pediu ajuste. O Marcelo edita e reenvia para a aprovação dela. O pedido de ajuste está no histórico."}</Aviso>}
        {pedido.status === "cancelada" ? <Aviso>Este pedido foi cancelado{fatorCobranca(pedido) > 0 ? " depois de apresentado e é cobrado em 50% do seu valor, conforme o contrato" : ""}. O motivo está no histórico.</Aviso> : (
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="Etapas do pedido">
            {ETAPAS.map((e, i) => (
              <li key={e.status} aria-current={i === idxAtual ? "step" : undefined}
                className={`rounded border px-3 py-2 text-sm ${i < idxAtual ? "border-[#BFDCCB] bg-[#E3F2EA] text-[#1E7047]" : i === idxAtual ? "border-ink-900 bg-white font-semibold" : "border-gray-200 bg-paper text-gray-600"}`}>
                <span className="block text-xs opacity-70">{String(i + 1).padStart(2, "0")}</span>{e.rotulo}
              </li>
            ))}
          </ol>
        )}

        {/* Tarefas: um único lugar para agir */}
        {minhas && (
          <section className="flex flex-wrap items-center gap-3 rounded border border-marca-500 bg-marca-100 p-4" aria-label="Sua tarefa">
            <span className="mr-auto text-sm font-semibold">Há uma tarefa sua neste pedido.</span>
            <a href={`/aprovacoes/?p=${encodeURIComponent(pedido.protocolo)}`} className="inline-flex min-h-11 items-center rounded bg-marca-500 px-5 font-semibold text-ink-900">Abrir em Minhas tarefas</a>
          </section>
        )}
        {publicando && <FormPublicar pedido={pedido} onFechar={() => setPublicando(false)} />}
        {acao && <FormAcao acao={acao} pedido={pedido} onFechar={() => setAcao(null)} />}
        {!publicando && !acao && (podeCancelar || podePublicar) && (
          <section className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-4" aria-label="Atalhos do administrador">
            <span className="mr-auto text-sm text-gray-600">Atalhos do administrador</span>
            {podePublicar && <Botao variante="discreto" onClick={() => setPublicando(true)}>Publicar peças direto para a Débora</Botao>}
            {podeCancelar && <Botao variante="discreto" onClick={() => setAcao("cancelar")}>Cancelar pedido</Botao>}
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 content-start gap-5">
            <Painel titulo="Serviços" extra={<span className="text-xs text-gray-600">Catálogo v{pedido.catalogoVersao}</span>}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-gray-600">
                    <tr><th className="py-2 pr-3">Qtd.</th><th className="py-2 pr-3">Serviço</th>{veValores && <><th className="py-2 pr-3 text-right">Unitário</th><th className="py-2 text-right">Subtotal</th></>}</tr>
                  </thead>
                  <tbody>
                    {pedido.itens.map((it, i) => {
                      const v = valores?.itens[i];
                      return (
                        <tr key={i} className="border-t border-gray-200 align-top">
                          <td className="py-2.5 pr-3 tabular-nums">{it.qtd}×</td>
                          <td className="py-2.5 pr-3"><b>{it.nome}</b>{it.sobOrcamento && pedido.status === "enviada" && <span className="ml-2 rounded-full bg-aviso-100 px-2 py-0.5 text-xs font-semibold text-aviso-700">a cotar</span>}
                            <div className="text-gray-600">{[it.cod, it.varianteRotulo, it.opcao, it.canal, it.audio].filter(Boolean).join(" · ")}</div>
                            {it.obs && <div className="mt-1 whitespace-pre-wrap">{it.obs}</div>}</td>
                          {veValores && <><td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">{moeda(v?.unitario)}</td><td className="whitespace-nowrap py-2.5 text-right tabular-nums">{moeda(v?.subtotal)}</td></>}
                        </tr>
                      );
                    })}
                  </tbody>
                  {veValores && valores && (
                    <tfoot><tr className="border-t-2 border-ink-900"><td colSpan={3} className="py-2.5 pr-3 text-right font-semibold">Total{valores.pendencias ? ` (${valores.pendencias} item a cotar)` : ""}</td>
                      <td className="whitespace-nowrap py-2.5 text-right font-semibold tabular-nums">{moeda(valores.total)}</td></tr></tfoot>
                  )}
                </table>
              </div>
              {veValores && <p className="text-xs text-gray-600">Valores visíveis só para Financeiro e equipe Propaga.</p>}
            </Painel>

            {pedido.temPecas && (
              <Painel titulo="Peças" extra={<a href={`/aprovacoes/?p=${encodeURIComponent(pedido.protocolo)}`} className="text-xs font-semibold underline">Minhas tarefas</a>}>
                <ul className="divide-y divide-gray-200 text-sm">
                  {(pedido.pecas ?? []).map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <b>{x.nome}</b><span className="text-gray-600">v{ultima(x).v}</span>
                      <span className="ml-auto rounded-full bg-[#EAF3F5] px-2.5 py-0.5 text-xs font-semibold">{ehCliente ? situacaoRelatorio(x).rotulo : situacaoInterna(x)}</span>
                    </li>
                  ))}
                </ul>
              </Painel>
            )}

            <Painel titulo="Observações para a Propaga">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{pedido.obs || "—"}</p>
            </Painel>

            <Painel titulo="Linha do tempo">
              <ol className="grid gap-3">
                {linhaDoTempo.map((e) => (
                  <li key={e.id} className="grid grid-cols-[12px_1fr] gap-3">
                    <span className={`mt-1.5 size-3 rounded-full ${e.chave ? "bg-marca-500" : "bg-gray-200"}`} aria-hidden="true" />
                    <div className="min-w-0 text-sm"><b>{e.rotulo}</b><div className="text-gray-600">{e.nome} · {brDataHora(e.em)}</div>
                      {e.nota && <p className="mt-1 whitespace-pre-wrap break-words">{e.nota}</p>}</div>
                  </li>
                ))}
                {!linhaDoTempo.length && <li className="text-sm text-gray-600">Sem registros.</li>}
              </ol>
            </Painel>
          </div>

          <div className="grid min-w-0 content-start gap-5">
            <Painel titulo="Dados">
              <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                <dt className="text-gray-600">Unidade</dt><dd>{pedido.unidade}</dd>
                <dt className="text-gray-600">Público</dt><dd>{pedido.publico}</dd>
                <dt className="text-gray-600">Objetivo</dt><dd>{pedido.objetivo}</dd>
                <dt className="text-gray-600">Contato</dt><dd className="break-words">{pedido.email}</dd>
              </dl>
            </Painel>
            <Painel titulo="Prazo">
              <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                <dt className="text-gray-600">Data desejada</dt><dd>{brData(p.desejada)}{p.urgente && <b className="ml-1.5 text-alerta-700">urgente</b>}</dd>
                <dt className="text-gray-600">Início</dt><dd>{brData(p.inicio)}</dd>
                <dt className="text-gray-600">1ª apresentação</dt><dd>{brData(p.primeira)}</dd>
                <dt className="text-gray-600">Entrega final</dt><dd>{brData(p.final)}</dd>
                {p.entrega && <><dt className="text-gray-600">Entregue em</dt><dd>{brData(p.entrega)}</dd></>}
              </dl>
              {!p.inicio && pedido.status === "enviada" && <p className="text-xs text-gray-600">O cronograma é confirmado pela Propaga ao aceitar o pedido.</p>}
            </Painel>
            <Painel titulo="Arquivos no Drive">
              <a href={pedido.drive.link} target="_blank" rel="noopener noreferrer" className="break-all text-sm underline">{pedido.drive.link}<span className="sr-only"> (abre em nova aba)</span></a>
              <p className="text-sm">{pedido.drive.verificado ? <span className="text-[#1E7047]">Acesso conferido pela Propaga.</span> : <span className="text-gray-600">Acesso ainda não conferido pela Propaga.</span>}</p>
            </Painel>
          </div>
        </div>
      </div>
    </Casca>
  );
}

export default function Pedido() {
  return <Protegido><Suspense fallback={<p className="p-6 text-gray-600">Carregando…</p>}><Conteudo /></Suspense></Protegido>;
}
