"use client";
/* Detalhe do pedido: dados, serviços, cronograma, histórico e as ações permitidas ao perfil.
   As ações vão para a /fila; o servidor valida perfil e etapa e grava a mudança. */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { avisarServidor, db } from "@/lib/firebase";
import { acoesDisponiveis, ETAPAS, fatorCobranca, MAX_RODADAS, REGRAS, VE_RELATORIOS, type Acao } from "@/lib/fluxo";
import { hojeSP, somarDiasUteis, PRAZO_PADRAO_DIAS_UTEIS } from "@/lib/datas";
import { acaoSchema } from "@/lib/schemas";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Aviso, Botao } from "@/components/ui";
import { brData, brDataHora, moeda, Painel, SeloStatus, type PedidoDoc } from "@/components/pedido";
import { CLIENTES } from "@/content/clientes";
import type { Papel } from "@/lib/tipos";

interface Evento { id: string; em: unknown; nome: string; rotulo: string; nota?: string; chave?: boolean }
interface Valores { itens: { unitario: number | null; subtotal: number | null; orcado: boolean }[]; total: number; pendencias: number }
type Envio = { tipo: "ocioso" } | { tipo: "aguardando"; id: string } | { tipo: "ok"; msg: string } | { tipo: "erro"; msg: string };

const cx = "min-h-11 w-full rounded border border-[#C9D7DC] bg-white px-3";
const ms = (v: unknown) => (v && typeof v === "object" && "toMillis" in v ? (v as { toMillis: () => number }).toMillis() : 0);

/* Textos de apoio de cada ação. */
const AJUDA: Partial<Record<Acao, string>> = {
  aceitarPedido: "Confirme o cronograma e informe o valor dos itens a cotar, conforme o contrato. O pedido entra em produção e o solicitante é avisado.",
  disponibilizarVersao: "Coloque os arquivos na pasta 03 Provas do Drive. O solicitante é avisado para aprovar ou pedir ajustes.",
  pedirAjustes: `Descreva com clareza o que precisa mudar. Cada pedido de ajuste conta uma rodada (até ${MAX_RODADAS}).`,
  aprovar: "Ao aprovar, a Propaga prepara os arquivos finais para entrega.",
  entregar: "Confirme que os arquivos finais estão na pasta 04 Aprovados.",
  confirmarRecebimento: "Confirme que recebeu os arquivos finais.",
  faturar: "Registre o faturamento (ex.: número da nota fiscal).",
  registrarPagamento: "Registre o recebimento do pagamento.",
  cancelar: "O cancelamento encerra o pedido. Informe o motivo.",
};
const NOTA_OBRIGATORIA: Acao[] = ["pedirAjustes", "cancelar"];

function FormAcao({ acao, pedido, clienteId, onFechar }: { acao: Acao; pedido: PedidoDoc; clienteId: string; onFechar: () => void }) {
  const s = useSessao();
  const hoje = hojeSP();
  const primeiraPadrao = somarDiasUteis(hoje, PRAZO_PADRAO_DIAS_UTEIS);
  const finalPadrao = [pedido.prazo.desejada, somarDiasUteis(primeiraPadrao, 3)].sort()[1];
  const [nota, setNota] = useState("");
  const [link, setLink] = useState("");
  const [cron, setCron] = useState({ inicio: hoje, primeira: primeiraPadrao, final: finalPadrao });
  const [valores, setValores] = useState<Record<number, string>>({});
  const [driveOk, setDriveOk] = useState(false);
  const [erro, setErro] = useState("");
  const [envio, setEnvio] = useState<Envio>({ tipo: "ocioso" });
  const aCotar = pedido.itens.map((it, i) => ({ it, i })).filter((x) => x.it.sobOrcamento);

  useEffect(() => {
    if (envio.tipo !== "aguardando") return;
    return onSnapshot(doc(db(), "fila", envio.id), (d) => {
      const x = d.data() as { status: string; mensagem?: string } | undefined;
      if (x?.status === "ok") { setEnvio({ tipo: "ok", msg: "Registrado." }); setTimeout(onFechar, 800); }
      if (x?.status === "erro") setEnvio({ tipo: "erro", msg: x.mensagem || "Não foi possível registrar." });
    });
  }, [envio, onFechar]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (NOTA_OBRIGATORIA.includes(acao) && nota.trim().length < 3) { setErro(acao === "cancelar" ? "Informe o motivo do cancelamento." : "Descreva os ajustes necessários."); return; }
    const num = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));
    const dados: Record<string, unknown> = { protocolo: pedido.protocolo, acao };
    if (nota.trim()) dados.nota = nota.trim();
    if (acao === "disponibilizarVersao" && link.trim()) dados.link = link.trim();
    if (acao === "aceitarPedido") {
      dados.cronograma = cron;
      dados.driveVerificado = driveOk;
      const faltando = aCotar.filter(({ i }) => !(num(valores[i] ?? "") > 0));
      if (faltando.length) { setErro(`Informe o valor do item ${faltando.map((x) => x.i + 1).join(", ")} (a cotar).`); return; }
      dados.valores = aCotar.map(({ i }) => ({ indice: i, valor: num(valores[i]) }));
      if (cron.inicio < hoje) { setErro("A data de início não pode estar no passado."); return; }
    }
    const r = acaoSchema.safeParse(dados);
    if (!r.success) { setErro(r.error.issues[0]?.message ?? "Confira os dados."); return; }
    try {
      const ref = await addDoc(collection(db(), "fila"), { tipo: "acao", uid: s.usuario!.uid, clienteId, dados: r.data, status: "pendente", criadoEm: serverTimestamp() });
      avisarServidor();
      setEnvio({ tipo: "aguardando", id: ref.id });
    } catch { setEnvio({ tipo: "erro", msg: "Não foi possível registrar. Verifique sua conexão." }); }
  }

  const ocupado = envio.tipo === "aguardando" || envio.tipo === "ok";
  return (
    <form onSubmit={confirmar} noValidate className="grid gap-4 rounded border border-ink-900 bg-white p-4 md:p-5" aria-labelledby="form-acao-titulo">
      <h3 id="form-acao-titulo" className="text-base">{REGRAS[acao].rotulo}</h3>
      {AJUDA[acao] && <p className="text-sm text-gray-600">{AJUDA[acao]}</p>}
      {acao === "cancelar" && (pedido.versao || 0) > 0 && (
        <p className="rounded border-l-4 border-alerta-700 bg-alerta-100 px-3 py-2 text-sm leading-relaxed"><b>Atenção:</b> este pedido já foi apresentado para aprovação. Se for cancelado, será cobrado <b>50% do seu valor</b>, conforme o contrato.</p>
      )}

      {acao === "aceitarPedido" && <>
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">Cronograma</legend>
          {([["inicio", "Início"], ["primeira", "1ª apresentação"], ["final", "Entrega final"]] as const).map(([k, l]) => (
            <div key={k} className="grid gap-1.5"><label htmlFor={`c-${k}`} className="text-sm">{l}</label>
              <input id={`c-${k}`} type="date" min={hoje} value={cron[k]} onChange={(e) => setCron({ ...cron, [k]: e.target.value })} className={cx} /></div>
          ))}
        </fieldset>
        <p className="text-sm text-gray-600">Data desejada pelo cliente: <b>{brData(pedido.prazo.desejada)}</b>{pedido.prazo.urgente && " · pedido urgente"}.</p>
        {aCotar.length > 0 && (
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold">Valor unitário dos itens a cotar (preço final ao cliente)</legend>
            {aCotar.map(({ it, i }) => (
              <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_180px]">
                <label htmlFor={`v-${i}`} className="text-sm">Item {i + 1}: {it.qtd}× {it.nome} <span className="text-gray-600">· {it.varianteRotulo}</span></label>
                <div className="flex items-center gap-2"><span className="text-sm text-gray-600">R$</span>
                  <input id={`v-${i}`} inputMode="decimal" placeholder="0,00" value={valores[i] ?? ""} onChange={(e) => setValores({ ...valores, [i]: e.target.value })} className={cx} /></div>
              </div>
            ))}
          </fieldset>
        )}
        <label className="flex items-start gap-2.5"><input type="checkbox" className="mt-1 size-4 accent-marca-700" checked={driveOk} onChange={(e) => setDriveOk(e.target.checked)} />
          <span>Conferi o acesso à pasta do Drive e os materiais.</span></label>
      </>}

      {acao === "disponibilizarVersao" && (
        <div className="grid gap-1.5"><label htmlFor="link" className="text-sm font-semibold">Link dos arquivos no Drive (opcional)</label>
          <input id="link" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className={cx} /></div>
      )}

      <div className="grid gap-1.5">
        <label htmlFor="nota" className="text-sm font-semibold">{acao === "cancelar" ? "Motivo" : acao === "pedirAjustes" ? "Ajustes necessários" : "Observação (opcional)"}
          {NOTA_OBRIGATORIA.includes(acao) && <span className="text-alerta-700" aria-hidden="true"> *</span>}</label>
        <textarea id="nota" rows={acao === "pedirAjustes" ? 5 : 3} maxLength={3000} value={nota} onChange={(e) => setNota(e.target.value)} className="w-full rounded border border-[#C9D7DC] bg-white p-3" />
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {envio.tipo === "aguardando" && <Aviso>Registrando… costuma levar poucos segundos (no máximo 1 minuto).</Aviso>}
      {envio.tipo === "ok" && <Aviso tipo="ok">{envio.msg}</Aviso>}
      {envio.tipo === "erro" && <Aviso tipo="erro">{envio.msg}</Aviso>}
      <div className="flex flex-wrap gap-3">
        <Botao type="submit" carregando={envio.tipo === "aguardando"} disabled={ocupado}>{REGRAS[acao].rotulo}</Botao>
        <Botao type="button" variante="discreto" onClick={onFechar} disabled={envio.tipo === "aguardando"}>Voltar</Botao>
      </div>
    </form>
  );
}

function Conteudo() {
  const s = useSessao();
  const protocolo = useSearchParams().get("p") ?? "";
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  const [pedido, setPedido] = useState<PedidoDoc | null | undefined>(undefined);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [valores, setValores] = useState<Valores | null>(null);
  const [acao, setAcao] = useState<Acao | null>(null);
  const veValores = !!s.papel && VE_RELATORIOS.includes(s.papel);

  useEffect(() => {
    if (!protocolo) { setPedido(null); return; }
    const ref = doc(db(), "clientes", clienteId, "solicitacoes", protocolo);
    const a = onSnapshot(ref, (d) => setPedido(d.exists() ? (d.data() as PedidoDoc) : null), () => setPedido(null));
    const b = onSnapshot(collection(ref, "eventos"), (q) => setEventos(q.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Evento, "id">) })).sort((x, y) => ms(y.em) - ms(x.em) || y.id.localeCompare(x.id))), () => {});
    const c = veValores ? onSnapshot(doc(db(), "clientes", clienteId, "valores", protocolo), (d) => setValores(d.exists() ? (d.data() as Valores) : null), () => {}) : () => {};
    return () => { a(); b(); c(); };
  }, [protocolo, clienteId, veValores]);

  if (pedido === undefined) return <Casca titulo="Solicitação"><p className="text-gray-600" aria-busy="true">Carregando…</p></Casca>;
  if (pedido === null) return <Casca titulo="Solicitação"><Aviso tipo="erro">Pedido não encontrado ou sem acesso para o seu perfil.</Aviso><a href="/solicitacoes/" className="mt-4 inline-block underline">Voltar para Solicitações</a></Casca>;

  const acoes = s.papel ? acoesDisponiveis(pedido.status, s.papel as Papel, { rodadas: pedido.rodadas || 0, recebidoPeloCliente: pedido.recebidoPeloCliente })
    .filter(() => !(s.papel === "solicitante" && pedido.solicitanteUid !== s.usuario?.uid)) : [];
  const principais = acoes.filter((a) => a !== "cancelar");
  const cancelarAoLado = pedido.status === "apresentacao";
  const idxAtual = ETAPAS.findIndex((e) => e.status === pedido.status);
  const p = pedido.prazo;

  return (
    <Casca titulo={pedido.titulo}>
      <div className="grid max-w-6xl gap-5">
        <nav aria-label="Trilha" className="text-sm text-gray-600"><a href="/solicitacoes/" className="underline-offset-4 hover:underline">Solicitações</a> / {pedido.protocolo}</nav>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-xl font-semibold">{pedido.protocolo}</span>
          <SeloStatus status={pedido.status} />
          <span className="text-sm text-gray-600">Enviada por {pedido.solicitanteNome} em {brDataHora(pedido.criadoEm)}</span>
        </div>

        {/* Etapas */}
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

        {/* Ações */}
        {acoes.length > 0 && (
          acao ? <FormAcao acao={acao} pedido={pedido} clienteId={clienteId} onFechar={() => setAcao(null)} /> : (
            <section className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-4" aria-label="Ações disponíveis">
              <span className="mr-auto text-sm font-semibold">Sua próxima ação{pedido.status === "apresentacao" ? ` · versão ${pedido.versao || 1}, rodada de ajustes ${pedido.rodadas || 0} de ${MAX_RODADAS}` : ""}</span>
              {principais.map((a, i) => <Botao key={a} variante={i === 0 ? "primario" : "linha"} onClick={() => setAcao(a)}>{REGRAS[a].rotulo}</Botao>)}
              {acoes.includes("cancelar") && <Botao variante={cancelarAoLado ? "linha" : "discreto"} onClick={() => setAcao("cancelar")}>{cancelarAoLado ? "Cancelar" : "Cancelar pedido"}</Botao>}
            </section>
          )
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

            <Painel titulo="Observações para a Propaga">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{pedido.obs || "—"}</p>
            </Painel>

            <Painel titulo="Histórico">
              <ol className="grid gap-3">
                {eventos.map((e) => (
                  <li key={e.id} className="grid grid-cols-[12px_1fr] gap-3">
                    <span className={`mt-1.5 size-3 rounded-full ${e.chave ? "bg-marca-500" : "bg-gray-200"}`} aria-hidden="true" />
                    <div className="min-w-0 text-sm"><b>{e.rotulo}</b><div className="text-gray-600">{e.nome} · {brDataHora(e.em)}</div>
                      {e.nota && <p className="mt-1 whitespace-pre-wrap break-words">{e.nota}</p>}</div>
                  </li>
                ))}
                {!eventos.length && <li className="text-sm text-gray-600">Sem registros.</li>}
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
