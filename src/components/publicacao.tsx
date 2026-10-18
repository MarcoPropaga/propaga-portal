"use client";
/* Publicação nas redes sociais (decisões de 18/10/2026). Painéis das abas de "Minhas tarefas" para Marcelo, Kauan e Débora.
   O mLabs é externo: o portal só organiza e registra. Regras em src/lib/publicacao.ts, execução no servidor. */
import { useState } from "react";
import { Aviso, Botao } from "@/components/ui";
import { brData } from "@/components/pedido";
import { CLIENTES } from "@/content/clientes";
import { hojeSP } from "@/lib/datas";
import { ANTECEDENCIA_DIAS, NOME_PUB, atrasadaPub, entradaUrgente, erroEntrada, semanaDe, type EtapaPub, type PubEntrada } from "@/lib/publicacao";
import { ultima, type Peca } from "@/lib/pecas";
import type { PedidoDoc } from "@/components/pedido";
import type { Papel } from "@/lib/tipos";

export type AbaPub = { k: string; rotulo: string; f: (p: Peca) => boolean };
const em = (...e: EtapaPub[]) => (p: Peca) => !!p.pub && e.includes(p.pub.etapa);
const aEncaminhar = (p: Peca) => p.etapa === "concluida" && (!p.pub || p.pub.etapa === "devolvida");

/** Abas de publicação por perfil. Prefixo "pub:" nas chaves para não colidir com as abas de peças. */
export const ABAS_PUB: Record<string, AbaPub[]> = {
  midia_social: [
    { k: "pub:receber", rotulo: "A receber", f: em("receber") },
    { k: "pub:calendario", rotulo: "Calendário", f: em("recebida", "ajuste") },
    { k: "pub:analise", rotulo: "Em aprovação", f: em("analise", "debora") },
    { k: "pub:aprovadas", rotulo: "Aprovadas", f: em("aprovada", "preparo") },
    { k: "pub:agendadas", rotulo: "Agendadas", f: em("agendada") },
    { k: "pub:publicadas", rotulo: "Publicadas", f: em("publicada") },
  ],
  atendimento: [
    { k: "pub:encaminhar", rotulo: "Encaminhar às redes", f: aEncaminhar },
    { k: "pub:analise", rotulo: "Calendário para analisar", f: em("analise", "devolvida") },
    { k: "pub:andamento", rotulo: "Redes: andamento", f: em("receber", "recebida", "ajuste", "debora", "aprovada", "preparo", "agendada") },
    { k: "pub:publicadas", rotulo: "Publicadas", f: em("publicada") },
  ],
  solicitante: [
    { k: "pub:debora", rotulo: "Calendário para aprovar", f: em("debora") },
    { k: "pub:agendadas", rotulo: "Redes: agendadas e publicadas", f: em("aprovada", "preparo", "agendada", "publicada") },
  ],
};
ABAS_PUB.admin = ABAS_PUB.atendimento.slice(0, 2).concat(ABAS_PUB.midia_social.slice(0, 5), ABAS_PUB.solicitante.slice(0, 1), ABAS_PUB.atendimento.slice(3))
  .filter((a, i, v) => v.findIndex((b) => b.k === a.k) === i);
export const abasPubDo = (papel: Papel | null) => ABAS_PUB[papel ?? ""] ?? [];
export const ehAbaPub = (k: string) => k.startsWith("pub:");

type Enviar = (tipo: "publicacao", dados: unknown) => Promise<{ ok: true; resultado?: Record<string, unknown> } | { ok: false; msg: string }>;
type Ctx = { papel: Papel | null; enviar: Enviar; onMsg: (tipo: "ok" | "erro", msg: string) => void };
const ref = (pd: PedidoDoc, p: Peca) => ({ protocolo: pd.protocolo, id: p.id });
const UM = "inline-flex min-h-10 items-center rounded border border-[#C9D7DC] px-3 text-sm font-semibold hover:bg-paper";

export function PainelPublicacao({ aba, pedidos, ctx }: { aba: AbaPub; pedidos: PedidoDoc[]; ctx: Ctx }) {
  const hoje = hojeSP();
  const blocos = pedidos.map((pd) => ({ pd, pecas: (pd.pecas ?? []).filter(aba.f) })).filter((b) => b.pecas.length);
  if (!blocos.length) return <p className="rounded border border-dashed border-[#C9D7DC] bg-white px-4 py-8 text-center text-gray-600">Nada por aqui.</p>;
  const calendario = aba.k === "pub:calendario";
  // Calendário agrupado pela semana da publicação quando já preenchido; sem data, tudo em "A definir".
  return (
    <div className="grid gap-4">
      {aba.k === "pub:receber" && <p className="text-sm text-gray-600">Confirme o recebimento e confira o arquivo final de cada arte. Se estiver incorreto ou faltar informação, devolva ao Marcelo com o motivo.</p>}
      {calendario && <p className="text-sm text-gray-600">Envie o calendário com {ANTECEDENCIA_DIAS} dias de antecedência: canais, data, horário e legenda de cada peça. O agendamento no mLabs é feito por você, fora do portal.</p>}
      {blocos.map(({ pd, pecas }) => (
        <section key={pd.protocolo} className="grid gap-3 rounded-md border border-gray-200 bg-white p-4" aria-label={pd.protocolo}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <a href={`/solicitacoes/pedido/?p=${encodeURIComponent(pd.protocolo)}`} className="font-display text-sm font-semibold text-marca-700 underline-offset-4 hover:underline">{pd.protocolo}</a>
            <h2 className="text-lg">{pd.titulo}</h2>
          </div>
          <ul className="grid gap-3">
            {pecas.map((p) => <li key={p.id}><LinhaPub pd={pd} p={p} aba={aba.k} ctx={ctx} hoje={hoje} /></li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Resumo({ p, hoje }: { p: Peca; hoje: string }) {
  const pb = p.pub; const e = pb?.entrada;
  const link = pb?.link || ultima(p)?.link;
  return (
    <div className="grid gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <b>{p.nome}</b>
        {pb && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${atrasadaPub(pb, hoje) ? "bg-alerta-100 text-alerta-700" : "bg-aviso-100 text-aviso-700"}`}>{NOME_PUB[pb.etapa]}{atrasadaPub(pb, hoje) ? " · atrasada" : ""}</span>}
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">Abrir arquivo final<span className="sr-only"> (nova aba)</span></a>}
      </div>
      {e && <p className="text-gray-600">{e.canais.join(", ")} · {brData(e.data)} às {e.hora}{entradaUrgente(e, hoje) && e.urgente ? ` · urgente: ${e.urgente}` : ""}</p>}
      {e && <p className="max-w-[75ch] whitespace-pre-wrap rounded bg-paper px-3 py-2">{e.legenda}</p>}
      {pb?.ajuste && ["ajuste", "analise", "devolvida"].includes(pb.etapa) && <p className="rounded bg-alerta-100 px-3 py-2 text-alerta-700"><b>{{ marcelo: "Marcelo", debora: "Débora", kauan: "Kauan" }[pb.ajuste.de]}</b> pediu ajuste: {pb.ajuste.motivo}</p>}
      {pb?.publicada && <p className="text-gray-600">Publicada em {brData(pb.publicada.data)}{pb.publicada.link ? <> · <a href={pb.publicada.link} target="_blank" rel="noopener noreferrer" className="underline">ver publicação<span className="sr-only"> (nova aba)</span></a></> : ` · sem link: ${pb.publicada.semLink}`}</p>}
    </div>
  );
}

function LinhaPub({ pd, p, aba, ctx, hoje }: { pd: PedidoDoc; p: Peca; aba: string; ctx: Ctx; hoje: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [modo, setModo] = useState<"" | "devolver" | "ajuste" | "arte" | "publicar">("");
  const [erro, setErro] = useState("");
  const [pubData, setPubData] = useState(hoje);
  const [pubLink, setPubLink] = useState("");
  const [semLink, setSemLink] = useState("");
  const pb = p.pub;
  async function rodar(dados: Record<string, unknown>, ok: string) {
    setOcupado(true); setErro("");
    const r = await ctx.enviar("publicacao", dados);
    setOcupado(false);
    if (r.ok) { setModo(""); setMotivo(""); ctx.onMsg("ok", ok); } else setErro(r.msg);
  }
  const r = ref(pd, p);
  const btn = (txt: string, dados: Record<string, unknown>, ok: string, variante: "primario" | "linha" = "primario") =>
    <Botao variante={variante} carregando={ocupado} onClick={() => rodar(dados, ok)}>{txt}</Botao>;
  const comMotivo = (acao: string, rotulo: string, extra: Record<string, unknown>, ok: string) => (
    <div className="grid max-w-xl gap-2">
      <label className="text-sm font-semibold" htmlFor={`m-${p.id}`}>{rotulo}</label>
      <textarea id={`m-${p.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className="rounded border border-[#C9D7DC] bg-white p-3" />
      <div className="flex gap-3">
        <Botao carregando={ocupado} disabled={motivo.trim().length < 3} onClick={() => rodar({ acao, ...extra, motivo: motivo.trim() }, ok)}>Enviar</Botao>
        <Botao variante="discreto" onClick={() => { setModo(""); setErro(""); }}>Cancelar</Botao>
      </div>
    </div>
  );
  const papel = ctx.papel;
  const kauan = papel === "midia_social" || papel === "admin";
  const marcelo = papel === "atendimento" || papel === "admin";
  const debora = papel === "solicitante" || papel === "admin";
  return (
    <div className="grid gap-3 rounded border border-gray-200 p-3">
      <Resumo p={p} hoje={hoje} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-3">
        {aba === "pub:encaminhar" && marcelo && btn(pb?.etapa === "devolvida" ? "Reencaminhar ao Kauan" : "Encaminhar ao Kauan", { acao: "encaminhar", protocolo: pd.protocolo, ids: [p.id] }, "Arte encaminhada ao Kauan.")}
        {aba === "pub:receber" && kauan && modo !== "arte" && <>
          {btn("Confirmar recebimento", { acao: "receber", itens: [r] }, "Recebimento confirmado.")}
          <Botao variante="linha" onClick={() => setModo("arte")}>Devolver arte ao Marcelo</Botao>
        </>}
        {pb && ["recebida", "ajuste"].includes(pb.etapa) && kauan && modo !== "arte" && <Botao variante="linha" onClick={() => setModo("arte")}>Devolver arte ao Marcelo</Botao>}
        {aba === "pub:analise" && marcelo && pb?.etapa === "analise" && modo !== "devolver" && <>
          {btn("Enviar à Débora", { acao: "enviarADebora", itens: [r] }, "Calendário enviado à Débora.")}
          <Botao variante="linha" onClick={() => setModo("devolver")}>Devolver ao Kauan</Botao>
        </>}
        {aba === "pub:debora" && debora && modo !== "ajuste" && <>
          {btn("Aprovar", { acao: "avaliarCalendario", decisoes: [{ ...r, tipo: "aprovada" }] }, "Publicação aprovada. Marcelo e Kauan foram avisados.")}
          <Botao variante="linha" onClick={() => setModo("ajuste")}>Pedir ajuste</Botao>
        </>}
        {aba === "pub:aprovadas" && kauan && <>
          {pb?.etapa === "aprovada" && btn("Iniciar preparo no mLabs", { acao: "preparar", itens: [r] }, "Preparo registrado.", "linha")}
          {btn("Registrar como agendada no mLabs", { acao: "agendar", itens: [r] }, "Agendamento registrado.")}
        </>}
        {aba === "pub:agendadas" && kauan && modo !== "publicar" && <Botao onClick={() => setModo("publicar")}>Registrar publicação</Botao>}
        <a href={`/solicitacoes/pedido/?p=${encodeURIComponent(pd.protocolo)}`} className={UM}>Ver pedido</a>
      </div>
      {modo === "devolver" && comMotivo("devolverCalendario", "O que o Kauan precisa ajustar?", { itens: [r] }, "Calendário devolvido ao Kauan.")}
      {modo === "arte" && comMotivo("devolverArte", "Por que a arte volta ao Marcelo? (arquivo incorreto ou informação faltando)", r, "Arte devolvida ao Marcelo.")}
      {modo === "ajuste" && (
        <div className="grid max-w-xl gap-2">
          <label className="text-sm font-semibold" htmlFor={`m-${p.id}`}>O que ajustar no calendário?</label>
          <textarea id={`m-${p.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className="rounded border border-[#C9D7DC] bg-white p-3" />
          <div className="flex gap-3">
            <Botao carregando={ocupado} disabled={motivo.trim().length < 3} onClick={() => rodar({ acao: "avaliarCalendario", decisoes: [{ ...r, tipo: "ajuste", nota: motivo.trim() }] }, "Ajuste enviado ao Marcelo.")}>Enviar ajuste</Botao>
            <Botao variante="discreto" onClick={() => { setModo(""); setErro(""); }}>Cancelar</Botao>
          </div>
        </div>
      )}
      {modo === "publicar" && (
        <div className="grid max-w-xl gap-3">
          <label className="grid gap-1 text-sm font-semibold">Data da publicação<input type="date" max={hoje} value={pubData} onChange={(e) => setPubData(e.target.value)} className="min-h-11 rounded border border-[#C9D7DC] bg-white px-3 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold">Link da publicação<input type="url" inputMode="url" placeholder="https://" value={pubLink} onChange={(e) => setPubLink(e.target.value)} className="min-h-11 rounded border border-[#C9D7DC] bg-white px-3 font-normal" /></label>
          {!pubLink.trim() && <label className="grid gap-1 text-sm font-semibold">Sem link? Explique<input value={semLink} onChange={(e) => setSemLink(e.target.value)} className="min-h-11 rounded border border-[#C9D7DC] bg-white px-3 font-normal" /></label>}
          <div className="flex gap-3">
            <Botao carregando={ocupado} disabled={!pubLink.trim() && semLink.trim().length < 3}
              onClick={() => rodar({ acao: "publicar", itens: [{ ...r, data: pubData, ...(pubLink.trim() ? { link: pubLink.trim() } : { semLink: semLink.trim() }) }] }, "Publicação registrada.")}>Registrar</Botao>
            <Botao variante="discreto" onClick={() => { setModo(""); setErro(""); }}>Cancelar</Botao>
          </div>
        </div>
      )}
      {aba === "pub:calendario" && kauan && pb && ["recebida", "ajuste"].includes(pb.etapa) && <FormCalendario pd={pd} p={p} ctx={ctx} hoje={hoje} />}
    </div>
  );
}

function FormCalendario({ pd, p, ctx, hoje }: { pd: PedidoDoc; p: Peca; ctx: Ctx; hoje: string }) {
  const canais = CLIENTES[pd.clienteId as keyof typeof CLIENTES]?.canaisSociais ?? Object.values(CLIENTES)[0].canaisSociais;
  const antes = p.pub?.entrada;
  const [e, setE] = useState<PubEntrada>({ canais: antes?.canais ?? [], data: antes?.data ?? "", hora: antes?.hora ?? "", legenda: antes?.legenda ?? "", urgente: antes?.urgente ?? "" });
  const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState(false);
  const urgente = !!e.data && entradaUrgente(e, hoje);
  async function enviar() {
    const m = erroEntrada(e, hoje, canais); if (m) { setErro(m); return; }
    setOcupado(true); setErro("");
    const r = await ctx.enviar("publicacao", { acao: "enviarCalendario", itens: [{ protocolo: pd.protocolo, id: p.id, ...e, urgente: urgente ? e.urgente : undefined }] });
    setOcupado(false);
    if (r.ok) ctx.onMsg("ok", "Calendário enviado ao Marcelo."); else setErro(r.msg);
  }
  const id = `c-${p.id}`;
  const campo = "min-h-11 rounded border border-[#C9D7DC] bg-white px-3 font-normal";
  return (
    <form className="grid max-w-2xl gap-3 border-t border-gray-200 pt-3" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }} noValidate>
      <fieldset className="grid gap-1">
        <legend className="text-sm font-semibold">Canais</legend>
        <div className="flex flex-wrap gap-3">
          {canais.map((c) => (
            <label key={c} className="inline-flex min-h-10 items-center gap-2">
              <input type="checkbox" checked={e.canais.includes(c)} onChange={(x) => setE({ ...e, canais: x.target.checked ? [...e.canais, c] : e.canais.filter((y) => y !== c) })} />{c}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-d`}>Data<input id={`${id}-d`} type="date" min={hoje} value={e.data} onChange={(x) => setE({ ...e, data: x.target.value })} className={campo} /></label>
        <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-h`}>Horário<input id={`${id}-h`} type="time" value={e.hora} onChange={(x) => setE({ ...e, hora: x.target.value })} className={campo} /></label>
      </div>
      {e.data && <p className="text-xs text-gray-600">Semana de {brData(semanaDe(e.data))}.</p>}
      <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-l`}>Legenda<textarea id={`${id}-l`} rows={4} maxLength={3000} value={e.legenda} onChange={(x) => setE({ ...e, legenda: x.target.value })} className="rounded border border-[#C9D7DC] bg-white p-3 font-normal" /></label>
      {urgente && <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-u`}>Menos de {ANTECEDENCIA_DIAS} dias: justifique a urgência<input id={`${id}-u`} value={e.urgente ?? ""} onChange={(x) => setE({ ...e, urgente: x.target.value })} className={campo} /></label>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div><Botao type="submit" carregando={ocupado}>Enviar calendário ao Marcelo</Botao></div>
    </form>
  );
}
