"use client";
/* Aprovações por peça (decisões de Marco, 03/10/2026). Fluxo em src/lib/pecas.ts.
   Débora avalia · Marcelo orienta a refação e revisa · Mariane executa no Drive compartilhado.
   O relatório muda na hora da avaliação: aprovada = concluída, cancelada = 50%, refação = em refação. */
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Aviso, Botao } from "@/components/ui";
import { brData, brDataHora, type PedidoDoc } from "@/components/pedido";
import { MAX_RODADAS, VE_TAREFAS, type Acao } from "@/lib/fluxo";
import { hojeSP, somarDiasUteis } from "@/lib/datas";
import { atrasada, contarPendencias, linhasParaItens, tarefasDoPedido, type TarefaPedido, pendentePara, prazoEtapa, previewDrive, situacaoInterna, situacaoRelatorio, ultima, ultimaDecisao, type Peca, type TipoDecisao } from "@/lib/pecas";
import { useFila, usePedidos } from "@/lib/usarFila";
import { FormPublicar } from "@/components/publicar";
import { FormAcao } from "@/components/formAcao";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CLIENTES } from "@/content/clientes";
import type { Papel } from "@/lib/tipos";

/* Abas de "Minhas tarefas": `t` = tarefa do pedido (aceitar, criar, entregar, faturar, receber); `f` = filtro de peças. */
type Aba = { k: string; rotulo: string; f: (p: Peca) => boolean; t?: TarefaPedido };
const nenhuma = () => false;
const decidida = (t: TipoDecisao) => (p: Peca) => p.etapa !== "cliente" && ultimaDecisao(p)?.tipo === t;
const ATEND: Aba[] = [
  { k: "aceitar", rotulo: "Aceitar pedidos", f: nenhuma, t: "aceitar" },
  { k: "ajustar", rotulo: "Ajustar solicitação", f: nenhuma, t: "ajustar" },
  { k: "revisao", rotulo: "Revisar criativo", f: (p) => p.etapa === "revisao" },
  { k: "triagem", rotulo: "Orientar refação", f: (p) => p.etapa === "triagem" },
  { k: "entregar", rotulo: "Veiculação/impressão", f: nenhuma, t: "entregar" },
  { k: "criativo", rotulo: "Com a Mariane", f: (p) => p.etapa === "criativo" },
  { k: "cliente", rotulo: "Com a Débora", f: (p) => p.etapa === "cliente" },
  { k: "concluidas", rotulo: "Concluídas", f: decidida("aprovada") },
  { k: "canceladas", rotulo: "Canceladas", f: decidida("cancelada") },
];
const FIN: Aba[] = [
  { k: "faturar", rotulo: "Faturar", f: nenhuma, t: "faturar" },
  { k: "receber", rotulo: "Registrar pagamento", f: nenhuma, t: "receber" },
];
const ABAS: Record<string, Aba[]> = {
  solicitante: [
    { k: "propostas", rotulo: "Solicitações para aprovar", f: nenhuma, t: "proposta" },
    { k: "aguardando", rotulo: "Peças para aprovar", f: (p) => p.etapa === "cliente" },
    { k: "andamento", rotulo: "Na Propaga", f: decidida("refacao") },
    { k: "concluidas", rotulo: "Concluídas", f: decidida("aprovada") },
    { k: "canceladas", rotulo: "Canceladas", f: decidida("cancelada") },
  ],
  atendimento: ATEND,
  criativo: [
    { k: "criar", rotulo: "Criar peças", f: nenhuma, t: "criar" },
    { k: "refazer", rotulo: "Refazer", f: (p) => p.etapa === "criativo" && p.tarefa === "refazer" },
    { k: "final", rotulo: "Finalizar aprovadas", f: (p) => p.etapa === "criativo" && p.tarefa === "final" },
    { k: "enviadas", rotulo: "Enviadas ao Marcelo", f: (p) => p.etapa === "revisao" },
    { k: "feitas", rotulo: "Concluídas", f: (p) => p.etapa === "concluida" },
  ],
  financeiro_propaga: FIN,
  admin: [{ k: "propostas", rotulo: "Com a Débora (solicitação)", f: nenhuma, t: "proposta" }, ...ATEND.slice(0, 5), ...FIN, ...ATEND.slice(5)],
};
const abasDo = (papel: Papel | null) => ABAS[papel ?? ""] ?? ATEND;
const ACAO_DA_TAREFA: Partial<Record<TarefaPedido, Acao>> = { aceitar: "aceitarPedido", entregar: "entregar", faturar: "faturar", receber: "registrarPagamento" };

const SELO: Record<string, string> = {
  aguardando: "bg-aviso-100 text-aviso-700", concluida: "bg-[#E3F2EA] text-[#1E7047]", refacao: "bg-alerta-100 text-alerta-700", cancelada: "bg-gray-200 text-gray-600",
};
function Selo({ p, interno }: { p: Peca; interno?: boolean }) {
  const r = situacaoRelatorio(p);
  return <span className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${interno ? "bg-[#E8EEF7] text-[#24456B]" : SELO[r.chave]}`}>{interno ? situacaoInterna(p) : r.rotulo}</span>;
}
function Prazo({ p }: { p: Peca }) {
  const z = prazoEtapa(p); if (!z) return null;
  const at = atrasada(p, hojeSP());
  return <span className={`text-xs ${at ? "font-semibold text-alerta-700" : "text-gray-600"}`}>{at ? "Atrasada · " : ""}prazo {brData(z)}</span>;
}

function Modal({ titulo, children, onFechar }: { titulo: string; children: ReactNode; onFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (ref.current?.querySelector("textarea, input, button:not([data-fechar])") as HTMLElement | null)?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [onFechar]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#001E2D]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-t">
      <div ref={ref} className="grid max-h-[90vh] w-full max-w-xl gap-4 overflow-auto rounded-lg bg-white p-5">
        <h2 id="modal-t" className="text-xl">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
const cx = "w-full rounded border border-[#C9D7DC] bg-white p-2.5";
const Nota = ({ cor = "marca", children }: { cor?: "marca" | "alerta" | "cinza" | "ok"; children: ReactNode }) => (
  <div className={`rounded-r border-l-4 px-3 py-2 text-sm leading-relaxed ${{ marca: "border-marca-700 bg-marca-100", alerta: "border-alerta-700 bg-alerta-100", cinza: "border-gray-600 bg-gray-200/60", ok: "border-[#1E7047] bg-[#E3F2EA]" }[cor]}`}>{children}</div>
);
const Lista = ({ itens }: { itens?: string[] }) => <ol className="m-0 list-decimal pl-5">{(itens ?? []).map((t, i) => <li key={i}>{t}</li>)}</ol>;

/* ---------------- visualizador ---------------- */
function Visualizador({ ped, pecas, inicio, papel, rascunho, setRascunho, onFechar }: {
  ped: PedidoDoc; pecas: Peca[]; inicio: number; papel: Papel | null;
  rascunho: Record<string, Rascunho>; setRascunho: (id: string, r: Rascunho | null) => void; onFechar: () => void;
}) {
  const [i, setI] = useState(inicio);
  const p = pecas[i], v = ultima(p), prev = previewDrive(v.link);
  const decide = (papel === "solicitante" || papel === "admin") && p.etapa === "cliente";
  const r = rascunho[p.id];
  const [texto, setTexto] = useState(""); const [erro, setErro] = useState("");
  useEffect(() => { setTexto(r ? (r.tipo === "refacao" ? (r.itens ?? []).join("\n") : r.nota ?? "") : ""); setErro(""); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); const t = (e.target as HTMLElement).tagName;
      if (t !== "TEXTAREA" && t !== "INPUT") { if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, pecas.length - 1)); if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0)); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [onFechar, pecas.length]);
  const proxima = () => { const j = pecas.findIndex((q, k) => k > i && q.etapa === "cliente" && !rascunho[q.id]); if (j >= 0) setI(j); else onFechar(); };
  function escolher(tipo: TipoDecisao) {
    if (tipo === "aprovada") { setRascunho(p.id, { tipo }); proxima(); return; }
    setRascunho(p.id, { tipo, pendente: true }); setTexto(""); setErro("");
  }
  function salvar() {
    if (!r) return;
    if (r.tipo === "refacao") { const itens = linhasParaItens(texto); if (!itens.length) { setErro("Liste ao menos um ajuste (um por linha)."); return; } setRascunho(p.id, { tipo: "refacao", itens }); }
    else { if (texto.trim().length < 3) { setErro("Escreva a justificativa."); return; } setRascunho(p.id, { tipo: "cancelada", nota: texto.trim() }); }
    proxima();
  }
  const extra = (ped.rodadas || 0) >= MAX_RODADAS;
  return (
    <div className="fixed inset-0 z-30 grid grid-rows-[auto_minmax(0,1fr)] bg-[#0B1E28] text-white" role="dialog" aria-modal="true" aria-labelledby="vis-t">
      <div className="flex items-center gap-3 border-b border-white/10 bg-ink-900 px-3 py-2.5 md:px-4">
        <button type="button" onClick={onFechar} className="grid size-10 place-items-center rounded border border-white/25" aria-label="Fechar">✕</button>
        <div className="min-w-0 flex-1"><b id="vis-t" className="block truncate font-display">{p.nome} · v{v.v}</b><span className="hidden text-sm text-[#A9CBD6] md:block">{ped.protocolo} · {ped.titulo}</span></div>
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="grid size-10 place-items-center rounded border border-white/25 disabled:opacity-30" aria-label="Peça anterior">‹</button>
        <span className="text-sm tabular-nums">{i + 1} de {pecas.length}</span>
        <button type="button" disabled={i === pecas.length - 1} onClick={() => setI(i + 1)} className="grid size-10 place-items-center rounded border border-white/25 disabled:opacity-30" aria-label="Próxima peça">›</button>
      </div>
      <div className="grid min-h-0 overflow-auto md:grid-cols-[minmax(0,1fr)_400px] md:overflow-hidden">
        <div className="relative h-[62vh] md:h-auto">
          {prev ? <iframe key={prev} src={prev} title={`Pré-visualização de ${p.nome}`} className="size-full border-0 bg-[#0B1E28]" allow="autoplay" />
            : <div className="grid size-full place-items-center p-6 text-center text-[#A9CBD6]">Este link não tem pré-visualização. Abra no Drive.</div>}
          <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/40 px-2 py-1 text-xs text-[#A9CBD6]">Drive compartilhado · entre com a conta Google que tem acesso</span>
        </div>
        <div className="grid content-start gap-4 overflow-auto bg-white p-4 text-ink-900">
          <div className="flex flex-wrap gap-2">
            <a href={v.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded border border-ink-900 px-4 font-semibold">Abrir no Drive<span className="sr-only"> (nova aba)</span></a>
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
            <dt className="text-gray-600">Situação</dt><dd><Selo p={p} interno={papel !== "solicitante"} /></dd>
            <dt className="text-gray-600">Refações</dt><dd>{ped.rodadas || 0} ({MAX_RODADAS} incluídas)</dd>
            <dt className="text-gray-600">Enviada</dt><dd>{brDataHora(v.em)}</dd>
          </dl>
          {decide && (
            <div className="grid gap-3 border-t border-gray-200 pt-3">
              <h3 className="text-base">Sua avaliação desta peça</h3>
              <div className="flex flex-wrap gap-2">
                <Botao type="button" className="!bg-[#1E7047] !px-3 !text-white" aria-pressed={r?.tipo === "aprovada"} onClick={() => escolher("aprovada")}>{r?.tipo === "aprovada" ? "✓ " : ""}Aprovar</Botao>
                <Botao type="button" variante="linha" className="!border-alerta-700 !px-3 !text-alerta-700" aria-pressed={r?.tipo === "refacao"} onClick={() => escolher("refacao")}>{r?.tipo === "refacao" ? "✓ " : ""}Pedir refação</Botao>
                <Botao type="button" variante="discreto" className="!px-3" aria-pressed={r?.tipo === "cancelada"} onClick={() => escolher("cancelada")}>{r?.tipo === "cancelada" ? "✓ " : ""}Cancelar</Botao>
              </div>
              {r && r.tipo !== "aprovada" && (
                <div className="grid gap-2">
                  {r.tipo === "refacao" && extra && <Nota cor="alerta"><b>Esta é a {(ped.rodadas || 0) + 1}ª refação.</b> As {MAX_RODADAS} incluídas já foram usadas: edições diferentes das pedidas antes acrescentam 30% ao valor da peça.</Nota>}
                  {r.tipo === "cancelada" && <Nota cor="cinza"><b>Atenção:</b> a peça já foi apresentada. Cancelada, será cobrado 50% do seu valor.</Nota>}
                  <label htmlFor="txt" className="text-sm font-semibold">{r.tipo === "refacao" ? "Ajustes, um por linha" : "Justificativa do cancelamento"}</label>
                  <textarea id="txt" rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} className={cx}
                    placeholder={r.tipo === "refacao" ? "1. Aumentar o título\n2. Trocar a foto do capacete" : "Ex.: a campanha foi suspensa."} aria-describedby={erro ? "txt-e" : undefined} />
                  {erro && <span id="txt-e" className="text-sm font-semibold text-alerta-700">{erro}</span>}
                  <Botao type="button" variante="linha" className="w-fit" onClick={salvar}>Salvar e ir para a próxima</Botao>
                </div>
              )}
              <p className="text-xs text-gray-600">Fica como rascunho até você enviar a avaliação do pedido.</p>
            </div>
          )}
          <div className="grid gap-1.5 border-t border-gray-200 pt-3 text-sm">
            <h3 className="text-base">Histórico</h3>
            {[...p.hist].reverse().map((h, k) => <div key={k} className="grid grid-cols-[104px_1fr] gap-2"><span className="text-gray-600">{brDataHora(h.em)}</span><span>{h.txt}<span className="text-gray-600"> · {h.por}</span></span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

type Rascunho = { tipo: TipoDecisao; itens?: string[]; nota?: string; pendente?: boolean };

/* ---------------- página ---------------- */
function Conteudo() {
  const s = useSessao();
  const papel = s.papel;
  const busca = useSearchParams();
  const [filtro, setFiltro] = useState(busca.get("p") ?? "");
  const { lista, erro } = usePedidos();
  const enviar = useFila();
  const abas = abasDo(papel);
  const [aba, setAba] = useState<string>(abas[0].k);
  const [vis, setVis] = useState<{ prot: string; ids: string[]; i: number } | null>(null);
  const [rasc, setRasc] = useState<Record<string, Rascunho>>({});
  const [modal, setModal] = useState<{ tipo: string; prot: string; id?: string } | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const todos = useMemo(() => (lista ?? []).filter((p) => (!filtro || p.protocolo === filtro) && (papel !== "solicitante" || p.solicitanteUid === s.usuario?.uid))
    .sort((a, b) => b.protocolo.localeCompare(a.protocolo)), [lista, filtro, papel, s.usuario?.uid]);
  const pedidos = useMemo(() => todos.filter((p) => p.temPecas), [todos]);
  const [abrindo, setAbrindo] = useState<string | null>(null); // formulário de tarefa de pedido aberto
  const [acaoAberta, setAcaoAberta] = useState<Acao | null>(null);
  const pendentes = contarPendencias(papel, todos);
  const abaAtual = abas.find((a) => a.k === aba) ?? abas[0];
  const doPedido = (t?: TarefaPedido) => (t ? todos.filter((p) => tarefasDoPedido(papel, p).includes(t)) : []);
  const tarefasPed = doPedido(abaAtual.t);
  const blocos = abaAtual.t ? [] : pedidos.map((pd) => ({ pd, pecas: (pd.pecas ?? []).filter(abaAtual.f) })).filter((b) => b.pecas.length);
  const contar = (a: Aba) => (a.t ? doPedido(a.t).length : pedidos.reduce((t, pd) => t + (pd.pecas ?? []).filter(a.f).length, 0));

  // Abre na primeira aba com algo pendente.
  const iniciou = useRef(false);
  useEffect(() => {
    if (iniciou.current || !lista) return; iniciou.current = true;
    const k = abas.find((a) => contar(a) > 0)?.k; if (k) setAba(k);
  }, [lista]); // eslint-disable-line react-hooks/exhaustive-deps

  async function executar(dados: Record<string, unknown>, okMsg: string) {
    setOcupado(true); setAviso(null);
    const r = await enviar("peca", dados);
    setOcupado(false);
    if (r.ok) { setModal(null); setAviso({ tipo: "ok", msg: (r.resultado?.pronto ? `${okMsg} Pedido pronto para entrega.` : okMsg) }); return true; }
    if (modal) return r.msg; // erro aparece dentro da janela
    setAviso({ tipo: "erro", msg: r.msg }); return false;
  }
  const setRascunho = (id: string, r: Rascunho | null) => setRasc((x) => { const y = { ...x }; if (r) y[id] = r; else delete y[id]; return y; });
  const ped = (prot: string) => pedidos.find((p) => p.protocolo === prot)!;
  const abrir = (pd: PedidoDoc, pecas: Peca[], id: string) => setVis({ prot: pd.protocolo, ids: pecas.map((x) => x.id), i: Math.max(0, pecas.findIndex((x) => x.id === id)) });

  const texto = ({
    solicitante: pendentes ? `${pendentes} ${pendentes > 1 ? "itens aguardam" : "item aguarda"} você: solicitações criadas pelo Marcelo para aprovar e peças para avaliar.` : "Nada aguardando você agora.",
    criativo: pendentes ? `${pendentes} ${pendentes > 1 ? "tarefas" : "tarefa"} para você: criar peças, refazer e preparar arquivos finais.` : "Nenhuma tarefa pendente.",
    financeiro_propaga: pendentes ? `${pendentes} ${pendentes > 1 ? "pedidos aguardam" : "pedido aguarda"} faturamento ou registro de pagamento.` : "Nenhuma tarefa pendente.",
} as Record<string, string>)[papel ?? ""] ?? (pendentes ? `${pendentes} ${pendentes > 1 ? "tarefas" : "tarefa"} para você: aceitar pedidos, revisar o criativo, orientar refações e registrar entregas.` : "Nenhuma tarefa pendente.");

  return (
    <Casca titulo="Minhas tarefas">
      <div className="grid max-w-6xl gap-5">
        <p className="max-w-[75ch] text-gray-600">{texto}</p>
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600" aria-label="Fluxo de cada peça">
          {["Débora solicita (ou aprova a do Marcelo)", "Marcelo confere e envia à Mariane", "Mariane cria", "Marcelo revisa", "Débora aprova, pede refação ou cancela", "Marcelo encaminha para veiculação/impressão"].map((t, k) => (
            <li key={t} className="flex items-center gap-1.5">{k > 0 && <span aria-hidden="true">→</span>}<span className="rounded-full border border-[#C9D7DC] bg-white px-2.5 py-1">{k + 1} · {t}</span></li>
          ))}
        </ol>
        {filtro && <Aviso>Mostrando só o pedido {filtro}. <button type="button" className="font-semibold underline" onClick={() => setFiltro("")}>Ver todos</button></Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {aviso && <Aviso tipo={aviso.tipo}>{aviso.msg}</Aviso>}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro">
          {abas.map((a) => {
            const n = contar(a);
            return <button key={a.k} type="button" aria-pressed={abaAtual.k === a.k} onClick={() => setAba(a.k)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium ${abaAtual.k === a.k ? "border-ink-900 bg-ink-900 text-paper" : "border-[#C9D7DC] bg-white"}`}>{a.rotulo} <span className="tabular-nums opacity-80">{n}</span></button>;
          })}
        </div>
        {!lista && !erro && <p className="text-gray-600" aria-busy="true">Carregando…</p>}
        {tarefasPed.map((pd) => (
          <section key={pd.protocolo} className="grid gap-3 rounded-md border border-gray-200 bg-white p-4" aria-label={pd.protocolo}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <a href={`/solicitacoes/pedido/?p=${encodeURIComponent(pd.protocolo)}`} className="font-display text-sm font-semibold text-marca-700 underline-offset-4 hover:underline">{pd.protocolo}</a>
              <h2 className="text-lg">{pd.titulo}</h2>
              <span className="text-sm text-gray-600">{pd.unidade} · {["aceitar", "proposta", "ajustar"].includes(abaAtual.t!) ? `desejada ${brData(pd.prazo.desejada)}` : `entrega final ${brData(pd.prazo.final)}`}</span>
            </div>
            {pd.criadoPor && abaAtual.t !== "criar" && <p className="text-sm text-gray-600">Criada por <b>{pd.criadoPor.nome}</b> em nome de {pd.solicitanteNome}{pd.status === "enviada" ? " · aprovada pela Débora" : ""}.</p>}
            {abaAtual.t === "ajustar" && <AjustePedido protocolo={pd.protocolo} />}
            {["aceitar", "criar", "proposta", "ajustar"].includes(abaAtual.t!) && (
              <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[120px_minmax(0,1fr)]">
                <dt className="text-gray-600">Solicitante</dt><dd>{pd.solicitanteNome}</dd>
                <dt className="text-gray-600">Objetivo</dt><dd>{pd.objetivo}</dd>
                <dt className="text-gray-600">Público</dt><dd>{pd.publico}</dd>
                <dt className="text-gray-600">Peças</dt><dd>{pd.itens.map((it) => `${it.qtd}× ${it.nome} (${it.varianteRotulo})`).join(" · ")}</dd>
                {pd.obs && <><dt className="text-gray-600">Observações</dt><dd className="whitespace-pre-wrap">{pd.obs}</dd></>}
                {abaAtual.t === "criar" && <><dt className="text-gray-600">1ª apresentação</dt><dd>{brData(pd.prazo.primeira)}</dd></>}
              </dl>
            )}
            {abaAtual.t === "entregar" && <p className="text-sm text-gray-600">{(pd.pecas ?? []).filter((x) => x.etapa === "concluida").length} peça(s) com arquivo final em 04 Aprovados · {(pd.pecas ?? []).filter((x) => x.etapa === "encerrada").length} cancelada(s).</p>}
            {abrindo === pd.protocolo
              ? (abaAtual.t === "criar"
                ? <FormPublicar pedido={pd} onFechar={() => setAbrindo(null)} onOk={(m) => setAviso({ tipo: "ok", msg: m })} />
                : <FormAcao acao={acaoAberta ?? ACAO_DA_TAREFA[abaAtual.t!]!} pedido={pd} onFechar={() => { setAbrindo(null); setAcaoAberta(null); }} onOk={(m) => setAviso({ tipo: "ok", msg: m })} />)
              : abaAtual.t === "proposta" ? (
                <div className="flex flex-wrap gap-3">
                  <Botao onClick={() => { setAcaoAberta("aprovarProposta"); setAbrindo(pd.protocolo); }}>Aprovar solicitação</Botao>
                  <Botao variante="linha" onClick={() => { setAcaoAberta("ajustarProposta"); setAbrindo(pd.protocolo); }}>Pedir ajuste ao Marcelo</Botao>
                  <Botao variante="linha" className="!border-alerta-700 !text-alerta-700" onClick={() => { setAcaoAberta("recusarProposta"); setAbrindo(pd.protocolo); }}>Recusar</Botao>
                  <a href={`/solicitacoes/pedido/?p=${encodeURIComponent(pd.protocolo)}`} className="inline-flex min-h-11 items-center rounded border border-[#C9D7DC] px-4 text-sm font-semibold">Ver solicitação completa</a>
                </div>
              ) : abaAtual.t === "ajustar" ? (
                <div className="flex flex-wrap gap-3">
                  <a href={`/nova-solicitacao/?editar=${encodeURIComponent(pd.protocolo)}`} className="inline-flex min-h-11 items-center rounded bg-marca-500 px-5 font-semibold text-ink-900 hover:brightness-105">Editar e reenviar à Débora</a>
                  <Botao variante="linha" onClick={() => { setAcaoAberta("cancelar"); setAbrindo(pd.protocolo); }}>Cancelar solicitação</Botao>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Botao onClick={() => { setAcaoAberta(null); setAbrindo(pd.protocolo); }}>{({ aceitar: "Aceitar e enviar à Mariane", criar: "Enviar peças criadas ao Marcelo", entregar: "Encaminhar para veiculação/impressão", faturar: "Registrar faturamento", receber: "Registrar pagamento" } as Record<string, string>)[abaAtual.t!]}</Botao>
                  {abaAtual.t === "aceitar" && <a href={`/nova-solicitacao/?editar=${encodeURIComponent(pd.protocolo)}`} className="inline-flex min-h-11 items-center rounded border border-[#C9D7DC] px-4 text-sm font-semibold">Editar solicitação</a>}
                  {abaAtual.t !== "faturar" && abaAtual.t !== "receber" && <a href={pd.drive.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded border border-[#C9D7DC] px-4 text-sm font-semibold">Abrir pasta do pedido<span className="sr-only"> (nova aba)</span></a>}
                  <a href={`/solicitacoes/pedido/?p=${encodeURIComponent(pd.protocolo)}`} className="inline-flex min-h-11 items-center rounded border border-[#C9D7DC] px-4 text-sm font-semibold">Ver pedido completo</a>
                </div>
              )}
          </section>
        ))}
        {lista && !blocos.length && !tarefasPed.length && <p className="rounded border border-dashed border-[#C9D7DC] bg-white px-4 py-8 text-center text-gray-600">Nada por aqui.</p>}

        {blocos.map(({ pd, pecas }) => (
          <section key={pd.protocolo} className="grid gap-3 rounded-md border border-gray-200 bg-white p-4" aria-label={pd.protocolo}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <a href={`/solicitacoes/pedido/?p=${encodeURIComponent(pd.protocolo)}`} className="font-display text-sm font-semibold text-marca-700 underline-offset-4 hover:underline">{pd.protocolo}</a>
              <h2 className="text-lg">{pd.titulo}</h2>
              <span className="text-sm text-gray-600">{pd.unidade} · refações {pd.rodadas || 0} ({MAX_RODADAS} incluídas)</span>
            </div>
            <Bloco pd={pd} pecas={pecas} aba={abaAtual.k} papel={papel} rasc={rasc} abrir={abrir}
              acao={(tipo, id) => setModal({ tipo, prot: pd.protocolo, id })} executar={executar} ocupado={ocupado} />
          </section>
        ))}

        <p className="rounded bg-[#EAF3F5] px-4 py-3 text-sm leading-relaxed">
          As peças ficam no Drive compartilhado da B&M Log: versões em <b>03 Provas</b>, arquivos finais em <b>04 Aprovados</b>. Para ver a pré-visualização aqui, entre no Google com a conta que tem acesso ao Drive.
          Relatório: aprovada = concluída · cancelada após apresentada = 50% do valor · a partir da 3ª refação, edições novas = +30%.
        </p>
      </div>

      {vis && <Visualizador ped={ped(vis.prot)} pecas={vis.ids.map((id) => ped(vis.prot).pecas!.find((x) => x.id === id)!).filter(Boolean)} inicio={vis.i} papel={papel}
        rascunho={rasc} setRascunho={setRascunho} onFechar={() => setVis(null)} />}
      {modal && <Janela modal={modal} pd={ped(modal.prot)} rasc={rasc} executar={executar} ocupado={ocupado} limpar={(ids) => ids.forEach((id) => setRascunho(id, null))} onFechar={() => setModal(null)} />}
    </Casca>
  );
}

function Miniatura({ p, onAbrir, rotulo }: { p: Peca; onAbrir: () => void; rotulo: ReactNode }) {
  return (
    <button type="button" onClick={onAbrir} className="grid gap-1 rounded border border-gray-200 bg-paper p-3 text-left hover:border-marca-700">
      <b className="truncate text-sm">{p.nome}</b>
      <span className="text-xs text-gray-600">v{ultima(p).v}</span>
      {rotulo}
    </button>
  );
}

function Bloco({ pd, pecas, aba, papel, rasc, abrir, acao, executar, ocupado }: {
  pd: PedidoDoc; pecas: Peca[]; aba: string; papel: Papel | null; rasc: Record<string, Rascunho>;
  abrir: (pd: PedidoDoc, pecas: Peca[], id: string) => void; acao: (tipo: string, id?: string) => void;
  executar: (d: Record<string, unknown>, ok: string) => Promise<boolean | string>; ocupado: boolean;
}) {
  const ehCliente = papel === "solicitante";
  const pasta = <a href={pd.drive.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded border border-[#C9D7DC] px-4 text-sm font-semibold">Abrir pasta do pedido<span className="sr-only"> (nova aba)</span></a>;

  // Admin também avalia (pedidos que ele mesmo abriu ou em nome da Débora), pela aba "Com a Débora".
  if ((ehCliente && aba === "aguardando") || (papel === "admin" && aba === "cliente")) {
    const feitas = pecas.filter((x) => rasc[x.id] && !rasc[x.id].pendente).length;
    return <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {pecas.map((x) => <Miniatura key={x.id} p={x} onAbrir={() => abrir(pd, pecas, x.id)} rotulo={rasc[x.id] && !rasc[x.id].pendente
          ? <span className="w-fit rounded-full bg-marca-100 px-2.5 py-0.5 text-xs font-semibold">{{ aprovada: "Aprovar", refacao: "Refazer", cancelada: "Cancelar" }[rasc[x.id].tipo]} · rascunho</span>
          : <Prazo p={x} />} />)}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Botao onClick={() => abrir(pd, pecas, (pecas.find((x) => !rasc[x.id] || rasc[x.id].pendente) ?? pecas[0]).id)}>{feitas ? "Continuar avaliação" : "Avaliar peças"}</Botao>
        <span className="text-sm text-gray-600">{feitas} de {pecas.length} avaliadas</span>
        {feitas === pecas.length && <Botao variante="linha" onClick={() => acao("avaliar")}>Enviar avaliação</Botao>}
      </div>
    </>;
  }

  if (aba === "triagem") return <>
    <div className="grid gap-2">{pecas.map((x) => { const d = ultimaDecisao(x)!; return (
      <div key={x.id} className="grid gap-2 rounded border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-3"><button type="button" className="font-semibold underline-offset-4 hover:underline" onClick={() => abrir(pd, pecas, x.id)}>{x.nome} · v{ultima(x).v}</button><Prazo p={x} /></div>
        <Nota cor="alerta"><b>Débora pediu:</b><Lista itens={d.itens} /></Nota>
      </div>); })}</div>
    <div className="flex flex-wrap gap-3"><Botao onClick={() => acao("encaminhar")}>Orientar e encaminhar à Mariane</Botao>{pasta}</div>
  </>;

  if (aba === "revisao" && papel !== "criativo") return <>
    <div className="grid gap-2">{pecas.map((x) => { const v = ultima(x); return (
      <div key={x.id} className="grid gap-2 rounded border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-3"><b>{x.nome} · v{v.v} da Mariane</b><Prazo p={x} />{!x.orientacao && <span className="text-xs text-gray-600">primeira versão</span>}</div>
        {x.orientacao && <Nota><b>Orientação:</b><Lista itens={x.orientacao.itens} /><span className="text-gray-600">Mariane marcou {v.feitos ?? 0} de {x.orientacao.itens.length} como feitos.</span></Nota>}
        {v.nota && <Nota cor="ok"><b>Mariane:</b> {v.nota}</Nota>}
        <div className="flex flex-wrap gap-2">
          <Botao variante="discreto" onClick={() => abrir(pd, pecas, x.id)}>Ver versão</Botao>
          <Botao variante="linha" className="!border-alerta-700 !text-alerta-700" onClick={() => acao("devolver", x.id)}>Devolver à Mariane</Botao>
          <Botao disabled={ocupado} onClick={() => executar({ acao: "liberar", protocolo: pd.protocolo, ids: [x.id] }, "Versão enviada à Débora.")}>Enviar à Débora</Botao>
        </div>
      </div>); })}</div>
    {pecas.length > 1 && <Botao className="w-fit" disabled={ocupado} onClick={() => executar({ acao: "liberar", protocolo: pd.protocolo, ids: pecas.map((x) => x.id) }, `${pecas.length} peças enviadas à Débora.`)}>Enviar todas à Débora ({pecas.length})</Botao>}
  </>;

  if (papel === "criativo" && ["refazer", "final"].includes(aba)) return <>
    <div className="grid gap-2">{pecas.map((x) => { const d = ultimaDecisao(x); return (
      <div key={x.id} className="grid gap-2 rounded border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-3"><button type="button" className="font-semibold underline-offset-4 hover:underline" onClick={() => abrir(pd, pecas, x.id)}>{x.nome} · v{ultima(x).v}</button><Prazo p={x} /></div>
        {x.tarefa === "refazer" && <>
          <Nota cor="alerta"><b>Débora pediu:</b><Lista itens={d?.itens} /></Nota>
          <Nota><b>Orientação do Marcelo:</b><Lista itens={x.orientacao?.itens} /></Nota>
          <Botao className="w-fit" onClick={() => acao("enviarVersao", x.id)}>Enviar nova versão ao Marcelo</Botao>
        </>}
        {x.tarefa === "final" && <>
          <p className="text-sm text-gray-600">Aprovada. Exporte o arquivo final e coloque na pasta <b>04 Aprovados</b>.</p>
          <Botao className="w-fit !bg-[#1E7047] !text-white" disabled={ocupado} onClick={() => executar({ acao: "finalizar", protocolo: pd.protocolo, id: x.id }, "Arquivo final registrado.")}>Arquivo final em 04 Aprovados</Botao>
        </>}
        {x.tarefa === "ciencia" && <>
          <Nota cor="cinza"><b>Justificativa:</b> {d?.nota}</Nota>
          <p className="text-sm text-gray-600">Interrompa o trabalho nesta peça.</p>
          <Botao variante="linha" className="w-fit" disabled={ocupado} onClick={() => executar({ acao: "ciente", protocolo: pd.protocolo, id: x.id }, "Ciência registrada.")}>Ciente</Botao>
        </>}
      </div>); })}</div>
    <div>{pasta}</div>
  </>;

  return <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
    {pecas.map((x) => <Miniatura key={x.id} p={x} onAbrir={() => abrir(pd, pecas, x.id)} rotulo={<><Selo p={x} interno={!ehCliente} /><Prazo p={x} /></>} />)}
  </div>;
}

/* ---------------- janelas de ação ---------------- */
function Janela({ modal, pd, rasc, executar, ocupado, limpar, onFechar }: {
  modal: { tipo: string; prot: string; id?: string }; pd: PedidoDoc; rasc: Record<string, Rascunho>;
  executar: (d: Record<string, unknown>, ok: string) => Promise<boolean | string>; ocupado: boolean; limpar: (ids: string[]) => void; onFechar: () => void;
}) {
  const pecas = pd.pecas ?? [];
  const peca = modal.id ? pecas.find((x) => x.id === modal.id) : undefined;
  const [prazo, setPrazo] = useState(somarDiasUteis(hojeSP(), 2));
  const tri = pecas.filter((x) => x.etapa === "triagem");
  const [orient, setOrient] = useState<Record<string, string>>(() => Object.fromEntries(tri.map((x) => [x.id, (ultimaDecisao(x)?.itens ?? []).join("\n")])));
  const [c30, setC30] = useState<Record<string, boolean>>(() => Object.fromEntries(tri.map((x) => [x.id, true])));
  const [link, setLink] = useState(""); const [nota, setNota] = useState(""); const [feitos, setFeitos] = useState<boolean[]>(() => (peca?.orientacao?.itens ?? []).map(() => false));
  const [dev, setDev] = useState("");
  const [erro, setErro] = useState("");
  const rodape = (ok: string, fn: () => void) => <>
    {erro && <Aviso tipo="erro">{erro}</Aviso>}
    <div className="flex flex-wrap gap-3"><Botao carregando={ocupado} onClick={fn}>{ok}</Botao><Botao variante="linha" data-fechar onClick={onFechar}>Voltar</Botao></div>
  </>;

  if (modal.tipo === "avaliar") {
    const naVez = pecas.filter((x) => x.etapa === "cliente");
    const g = (t: TipoDecisao) => naVez.filter((x) => rasc[x.id]?.tipo === t);
    const [ap, rf, cn] = [g("aprovada"), g("refacao"), g("cancelada")];
    return <Modal titulo="Enviar avaliação" onFechar={onFechar}>
      <p><b>{pd.protocolo}</b> · {pd.titulo}</p>
      {ap.length > 0 && <div><b className="text-[#1E7047]">Aprovadas ({ap.length}) · entram no relatório como concluídas</b><ul className="list-disc pl-5">{ap.map((x) => <li key={x.id}>{x.nome}</li>)}</ul></div>}
      {rf.length > 0 && <div><b className="text-alerta-700">Refação ({rf.length}){(pd.rodadas || 0) >= MAX_RODADAS ? " · sujeita a +30%" : ""}</b><ul className="list-disc pl-5">{rf.map((x) => <li key={x.id}>{x.nome}: {rasc[x.id].itens?.join("; ")}</li>)}</ul></div>}
      {cn.length > 0 && <div><b>Canceladas ({cn.length}) · cobrança de 50%</b><ul className="list-disc pl-5">{cn.map((x) => <li key={x.id}>{x.nome}: {rasc[x.id].nota}</li>)}</ul></div>}
      <p className="rounded bg-[#EAF3F5] px-3 py-2 text-sm">O relatório é atualizado na hora. Aprovadas e canceladas seguem direto para o criativo; as refações passam pelo Marcelo.</p>
      {rodape("Enviar avaliação", async () => {
        const ok = await executar({ acao: "avaliar", protocolo: pd.protocolo, decisoes: naVez.map((x) => ({ id: x.id, tipo: rasc[x.id].tipo, itens: rasc[x.id].itens, nota: rasc[x.id].nota })) }, "Avaliação enviada.");
        if (ok === true) limpar(naVez.map((x) => x.id)); else if (typeof ok === "string") setErro(ok);
      })}
    </Modal>;
  }

  if (modal.tipo === "encaminhar") return <Modal titulo="Orientar e encaminhar à Mariane" onFechar={onFechar}>
    <p><b>{pd.protocolo}</b> · {pd.titulo}</p>
    {tri.map((x) => <div key={x.id} className="grid gap-2 border-t border-gray-200 pt-3">
      <b>{x.nome} · v{ultima(x).v}</b>
      <label htmlFor={`or-${x.id}`} className="text-sm font-semibold">Orientação para a Mariane (um ajuste por linha)</label>
      <textarea id={`or-${x.id}`} rows={4} className={cx} value={orient[x.id] ?? ""} onChange={(e) => setOrient({ ...orient, [x.id]: e.target.value })} />
      {(pd.rodadas || 0) > MAX_RODADAS && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-marca-700" checked={!!c30[x.id]} onChange={(e) => setC30({ ...c30, [x.id]: e.target.checked })} />
        <span>Edições novas, diferentes das pedidas antes: cobrar +30% no valor desta peça. Desmarque se repete pedido anterior ou corrige erro da Propaga.</span></label>}
    </div>)}
    <div className="grid gap-1.5"><label htmlFor="prazo" className="text-sm font-semibold">Prazo da nova versão</label><input id="prazo" type="date" min={hojeSP()} className={cx} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
    {rodape("Encaminhar à Mariane", async () => {
      const refacoes = tri.map((x) => ({ id: x.id, itens: linhasParaItens(orient[x.id] ?? ""), cobrar30: (pd.rodadas || 0) > MAX_RODADAS ? !!c30[x.id] : undefined }));
      if (refacoes.some((r) => !r.itens.length)) { setErro("Escreva a orientação de cada peça."); return; }
      const r = await executar({ acao: "encaminhar", protocolo: pd.protocolo, prazo, refacoes }, "Encaminhado à Mariane."); if (typeof r === "string") setErro(r);
    })}
  </Modal>;

  if (modal.tipo === "enviarVersao" && peca) {
    const itens = peca.orientacao?.itens ?? [];
    return <Modal titulo={`Enviar v${ultima(peca).interna ? ultima(peca).v : ultima(peca).v + 1} ao Marcelo`} onFechar={onFechar}>
      <p><b>{peca.nome}</b> · {pd.protocolo}</p>
      <fieldset className="grid gap-1.5"><legend className="mb-1 text-sm font-semibold">Confira cada ajuste</legend>
        {itens.map((t, k) => <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-marca-700" checked={feitos[k] ?? false} onChange={(e) => { const f = [...feitos]; f[k] = e.target.checked; setFeitos(f); }} /><span>{t}</span></label>)}
      </fieldset>
      <div className="grid gap-1.5"><label htmlFor="lk" className="text-sm font-semibold">Link do arquivo na pasta 03 Provas</label><input id="lk" type="url" className={cx} placeholder="https://drive.google.com/file/d/…" value={link} onChange={(e) => setLink(e.target.value)} /></div>
      <div className="grid gap-1.5"><label htmlFor="nt" className="text-sm font-semibold">Observação {feitos.every(Boolean) ? "(opcional)" : "(obrigatória: o que ficou pendente e por quê)"}</label><textarea id="nt" rows={3} className={cx} value={nota} onChange={(e) => setNota(e.target.value)} /></div>
      {rodape("Enviar ao Marcelo", async () => {
        if (!/^https:\/\/drive\.google\.com\//.test(link.trim())) { setErro("Cole o link do arquivo no Google Drive."); return; }
        const n = feitos.filter(Boolean).length;
        if (n < itens.length && nota.trim().length < 3) { setErro("Marque todos os ajustes ou explique o que ficou pendente."); return; }
        const r = await executar({ acao: "enviarVersao", protocolo: pd.protocolo, id: peca.id, link: link.trim(), feitos: n, nota: nota.trim() || undefined }, "Nova versão enviada ao Marcelo."); if (typeof r === "string") setErro(r);
      })}
    </Modal>;
  }

  if (modal.tipo === "devolver" && peca) return <Modal titulo="Devolver à Mariane" onFechar={onFechar}>
    <p><b>{peca.nome}</b> · v{ultima(peca).v}</p>
    <p className="rounded bg-[#EAF3F5] px-3 py-2 text-sm">Ajuste interno: não conta como refação da Débora.</p>
    <div className="grid gap-1.5"><label htmlFor="dv" className="text-sm font-semibold">O que ainda precisa mudar (um por linha)</label><textarea id="dv" rows={4} className={cx} value={dev} onChange={(e) => setDev(e.target.value)} /></div>
    {rodape("Devolver", async () => {
      const itens = linhasParaItens(dev); if (!itens.length) { setErro("Liste ao menos um ajuste."); return; }
      const r = await executar({ acao: "devolver", protocolo: pd.protocolo, id: peca.id, itens }, "Devolvido à Mariane."); if (typeof r === "string") setErro(r);
    })}
  </Modal>;
  return null;
}

export default function Aprovacoes() {
  return <Protegido papeis={VE_TAREFAS}><Suspense><Conteudo /></Suspense></Protegido>;
}

/** Último pedido de ajuste da Débora (histórico do pedido), para o Marcelo ver o que mudar. */
function AjustePedido({ protocolo }: { protocolo: string }) {
  const s = useSessao();
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  const [txt, setTxt] = useState<{ nota: string; nome: string } | null>(null);
  useEffect(() => {
    getDocs(query(collection(db(), "clientes", clienteId, "solicitacoes", protocolo, "eventos"), where("acao", "==", "ajustarProposta")))
      .then((q) => { const e = q.docs.map((d) => d.data() as { nota: string; nome: string; em: { seconds: number } }).sort((a, b) => b.em.seconds - a.em.seconds)[0]; if (e) setTxt(e); })
      .catch(() => {});
  }, [clienteId, protocolo]);
  if (!txt) return null;
  return <p className="whitespace-pre-wrap rounded border-l-4 border-aviso-700 bg-aviso-100 px-3 py-2 text-sm"><b>{txt.nome} pediu:</b> {txt.nota}</p>;
}
