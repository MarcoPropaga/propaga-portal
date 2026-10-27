"use client";
/* Publicação nas redes sociais (decisões de 18/10/2026). Abas de "Minhas tarefas" para Kauan, Marcelo e Débora.
   O mLabs é externo: o portal só organiza e registra. Regras em src/lib/publicacao.ts, execução no servidor. */
import { useState } from "react";
import { Aviso, Botao } from "@/components/ui";
import { brData, type PedidoDoc } from "@/components/pedido";
import { hojeSP } from "@/lib/datas";
import { ANTECEDENCIA_DIAS, NOME_CAL, NOME_MES, arteDe, atrasadaPub, erroItem, itensDe, semanaDe, urgenteCal, type CalEntrada, type CalItem, type Calendario } from "@/lib/publicacao";
import { ultima } from "@/lib/pecas";
import type { Papel } from "@/lib/tipos";
import { useTxt } from "@/components/tema";
import { useClienteAtivo } from "@/components/cliente-ativo";

type Arte = ReturnType<typeof arteDe>;
export type AbaPub = { k: string; rotulo: string; cal: (it: CalItem, arte: Arte) => boolean };
const em = (...e: CalItem["etapa"][]) => (it: CalItem) => e.includes(it.etapa);

const KAUAN: AbaPub[] = [
  { k: "pub:calendario", rotulo: "Montar calendário", cal: em("ajuste") },
  { k: "pub:aprovacao", rotulo: "Em aprovação", cal: em("analise", "debora") },
  { k: "pub:aguardando", rotulo: "Aguardando a arte", cal: (i, a) => i.etapa === "aprovado" && !a.pronta },
  { k: "pub:publicar", rotulo: "Para publicar", cal: (i, a) => i.etapa === "aprovado" && a.pronta },
  { k: "pub:agendadas", rotulo: "Agendadas", cal: em("agendada") },
  { k: "pub:publicadas", rotulo: "Publicadas", cal: em("publicada") },
];
const MARCELO: AbaPub[] = [
  { k: "pub:analisar", rotulo: "Calendário para analisar", cal: em("analise") },
  { k: "pub:vincular", rotulo: "Vincular materiais", cal: (i) => (i.etapa === "aprovado" && !i.peca) || i.etapa === "devolvida" },
  { k: "pub:andamento", rotulo: "Redes: andamento", cal: (i) => i.etapa !== "publicada" },
  { k: "pub:publicadas", rotulo: "Publicadas", cal: em("publicada") },
];
const DEBORA: AbaPub[] = [
  { k: "pub:aprovar", rotulo: "Calendário para aprovar", cal: em("debora") },
  { k: "pub:andamento", rotulo: "Redes: andamento", cal: (i) => i.etapa !== "publicada" },
  { k: "pub:publicadas", rotulo: "Publicadas", cal: em("publicada") },
];
const pegar = (v: AbaPub[], ...k: string[]) => v.filter((a) => k.includes(a.k));
export const ABAS_PUB: Record<string, AbaPub[]> = {
  midia_social: KAUAN, atendimento: MARCELO, solicitante: DEBORA,
  admin: [...pegar(MARCELO, "pub:analisar", "pub:vincular"), ...pegar(DEBORA, "pub:aprovar"), ...pegar(KAUAN, "pub:calendario", "pub:publicar"), ...pegar(MARCELO, "pub:andamento", "pub:publicadas")],
};
export const abasPubDo = (papel: Papel | null) => ABAS_PUB[papel ?? ""] ?? [];
export const ehAbaPub = (k: string) => k.startsWith("pub:");

type Enviar = (tipo: "publicacao", dados: unknown) => Promise<{ ok: true; resultado?: Record<string, unknown> } | { ok: false; msg: string }>;
type Ctx = { papel: Papel | null; enviar: Enviar; onMsg: (tipo: "ok" | "erro", msg: string) => void; pedidos: PedidoDoc[] };
const ref = (i: CalItem) => ({ mes: i.mes, id: i.id });
const campo = "min-h-11 rounded border border-[#C9D7DC] bg-white px-3 font-normal";

export function PainelPublicacao({ aba, cals, ctx }: { aba: AbaPub; cals: Calendario[]; ctx: Ctx }) {
  const t = useTxt();
  const hoje = hojeSP();
  const itens = itensDe(cals).map((i) => ({ i, arte: arteDe(i, ctx.pedidos) })).filter((x) => aba.cal(x.i, x.arte));
  const meses = [...new Set(itens.map((x) => x.i.mes))];
  const [ocupado, setOcupado] = useState(false);
  const lote = async (acao: "enviarADebora" | "aprovar", lista: CalItem[]) => {
    setOcupado(true);
    const r = acao === "aprovar"
      ? await ctx.enviar("publicacao", { acao: "avaliarCalendario", decisoes: lista.map((i) => ({ ...ref(i), tipo: "aprovada" })) })
      : await ctx.enviar("publicacao", { acao, itens: lista.map(ref) });
    setOcupado(false);
    ctx.onMsg(r.ok ? "ok" : "erro", r.ok ? (acao === "aprovar" ? t("Calendário aprovado. {atendimento} e Kauan foram avisados.") : t("Calendário enviado ao {equipe}.")) : r.msg);
  };
  const emLote = aba.k === "pub:analisar" ? "enviarADebora" : aba.k === "pub:aprovar" ? "aprovar" : null;
  return (
    <div className="grid gap-4">
      {aba.k === "pub:calendario" && <FormCalendario cals={cals} ctx={ctx} hoje={hoje} />}
      {aba.k === "pub:aguardando" && <p className="text-sm text-gray-600">{t("O calendário está aprovado. Falta a Mariane criar a arte, o {equipe} aprovar e o arquivo final ficar pronto; você será avisado.")}</p>}
      {aba.k === "pub:publicar" && <p className="text-sm text-gray-600">{t("Arte aprovada e arquivo final pronto. Agende no mLabs (fora do portal) e registre aqui. Se o arquivo estiver incorreto, devolva ao {atendimento} com o motivo.")}</p>}
      {emLote && itens.length > 1 && (
        <div><Botao carregando={ocupado} onClick={() => lote(emLote, itens.map((x) => x.i))}>{emLote === "aprovar" ? `Aprovar todos (${itens.length})` : t(`Enviar todos ao {equipe} (${itens.length})`)}</Botao></div>
      )}
      {!itens.length && aba.k !== "pub:calendario" && <p className="rounded border border-dashed border-[#C9D7DC] bg-white px-4 py-8 text-center text-gray-600">Nada por aqui.</p>}
      {meses.map((mes) => (
        <section key={mes} className="grid gap-3 rounded-md border border-gray-200 bg-white p-4" aria-label={NOME_MES(mes)}>
          <h2 className="text-lg capitalize">{NOME_MES(mes)}</h2>
          <ul className="grid gap-3">
            {itens.filter((x) => x.i.mes === mes).map(({ i, arte }) => <li key={`${i.mes}${i.id}`}><LinhaCal it={i} arte={arte} aba={aba.k} ctx={ctx} hoje={hoje} /></li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Resumo({ it, arte, hoje, ctx }: { it: CalItem; arte: Arte; hoje: string; ctx: Ctx }) {
  const t = useTxt();
  const x = it.peca ? ctx.pedidos.find((p) => p.protocolo === it.peca!.protocolo)?.pecas?.find((q) => q.id === it.peca!.id) : null;
  const link = arte.pronta && x ? ultima(x)?.link : null;
  return (
    <div className="grid gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <b>{it.titulo}</b>
        {it.avulso && <span className="rounded-full bg-[#E8EEF7] px-2.5 py-0.5 text-xs font-semibold text-[#24456B]">Fora do calendário aprovado</span>}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${atrasadaPub(it, hoje) ? "bg-alerta-100 text-alerta-700" : "bg-aviso-100 text-aviso-700"}`}>{t(NOME_CAL[it.etapa])}{atrasadaPub(it, hoje) ? " · atrasado" : ""}</span>
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">Abrir arquivo final<span className="sr-only"> (nova aba)</span></a>}
      </div>
      <p className="text-gray-600">{it.canais.join(", ")} · {brData(it.data)} às {it.hora}{urgenteCal(it, hoje) && it.urgente ? ` · urgente: ${it.urgente}` : ""}</p>
      <p className="max-w-[75ch] whitespace-pre-wrap rounded bg-paper px-3 py-2">{it.legenda}</p>
      {it.peca && <p className="text-gray-600">Peça: <a className="underline" href={`/solicitacoes/pedido/?p=${encodeURIComponent(it.peca.protocolo)}`}>{it.peca.nome} ({it.peca.protocolo})</a>{x ? ` · ${arte.pronta ? "arquivo final pronto" : "em andamento"}` : ""}</p>}
      {!it.peca && it.etapa === "aprovado" && <p className="text-gray-600">{t("Aguardando o {atendimento} vincular a peça da Mariane.")}</p>}
      {it.ajuste && ["ajuste", "analise", "devolvida"].includes(it.etapa) && <p className="rounded bg-alerta-100 px-3 py-2 text-alerta-700"><b>{{ marcelo: t("{atendimento}"), debora: t("{equipe}"), kauan: "Kauan" }[it.ajuste.de]}</b> pediu ajuste: {it.ajuste.motivo}</p>}
      {it.publicada && <p className="text-gray-600">Publicada em {brData(it.publicada.data)}{it.publicada.link ? <> · <a href={it.publicada.link} target="_blank" rel="noopener noreferrer" className="underline">ver publicação<span className="sr-only"> (nova aba)</span></a></> : ` · sem link: ${it.publicada.semLink}`}</p>}
    </div>
  );
}

function LinhaCal({ it, arte, aba, ctx, hoje }: { it: CalItem; arte: Arte; aba: string; ctx: Ctx; hoje: string }) {
  const t = useTxt();
  const [ocupado, setOcupado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [modo, setModo] = useState<"" | "devolver" | "ajuste" | "arte" | "publicar">("");
  const [erro, setErro] = useState("");
  const [pubData, setPubData] = useState(hoje);
  const [pubLink, setPubLink] = useState("");
  const [semLink, setSemLink] = useState("");
  const [peca, setPeca] = useState("");
  async function rodar(dados: Record<string, unknown>, ok: string) {
    setOcupado(true); setErro("");
    const r = await ctx.enviar("publicacao", dados);
    setOcupado(false);
    if (r.ok) { setModo(""); setMotivo(""); ctx.onMsg("ok", ok); } else setErro(r.msg);
  }
  const r = ref(it);
  const btn = (txt: string, dados: Record<string, unknown>, ok: string) => <Botao carregando={ocupado} onClick={() => rodar(dados, ok)}>{txt}</Botao>;
  const comMotivo = (acao: string, rotulo: string, extra: Record<string, unknown>, ok: string, id: string) => (
    <div className="grid max-w-xl gap-2">
      <label className="text-sm font-semibold" htmlFor={id}>{rotulo}</label>
      <textarea id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className="rounded border border-[#C9D7DC] bg-white p-3" />
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
  const id = `${it.mes}-${it.id}`;
  // Peças que o Marcelo pode vincular: não canceladas e ainda sem post (ou já deste post).
  const opcoes = ctx.pedidos.filter((p) => p.status !== "cancelada").flatMap((p) => (p.pecas ?? [])
    .filter((x) => x.etapa !== "encerrada" && (!x.cal || (x.cal.mes === it.mes && x.cal.id === it.id)))
    .map((x) => ({ v: `${p.protocolo}|${x.id}`, t: `${p.protocolo} · ${x.nome}` })));
  return (
    <div className="grid gap-3 rounded border border-gray-200 p-3">
      <Resumo it={it} arte={arte} hoje={hoje} ctx={ctx} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex flex-wrap items-end gap-3">
        {aba === "pub:analisar" && marcelo && modo !== "devolver" && <>
          {btn(t("Enviar ao {equipe}"), { acao: "enviarADebora", itens: [r] }, t("Enviado ao {equipe}."))}
          <Botao variante="linha" onClick={() => setModo("devolver")}>Devolver ao Kauan</Botao>
        </>}
        {aba === "pub:aprovar" && debora && modo !== "ajuste" && <>
          {btn("Aprovar", { acao: "avaliarCalendario", decisoes: [{ ...r, tipo: "aprovada" }] }, t("Aprovado. {atendimento} e Kauan foram avisados."))}
          <Botao variante="linha" onClick={() => setModo("ajuste")}>Pedir ajuste</Botao>
        </>}
        {aba === "pub:vincular" && marcelo && <>
          {it.etapa === "devolvida" && btn("Arte corrigida: reenviar ao Kauan", { acao: "reenviarArte", itens: [r] }, "Arte reenviada ao Kauan.")}
          <label className="grid gap-1 text-sm font-semibold" htmlFor={`v-${id}`}>Peça da Mariane
            <select id={`v-${id}`} value={peca} onChange={(e) => setPeca(e.target.value)} className={campo}>
              <option value="">Escolha a peça…</option>
              {opcoes.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select>
          </label>
          <Botao variante="linha" carregando={ocupado} disabled={!peca} onClick={() => { const [protocolo, pecaId] = peca.split("|"); void rodar({ acao: "vincular", ...r, protocolo, pecaId }, "Peça vinculada ao post."); }}>Vincular</Botao>
        </>}
        {aba === "pub:publicar" && kauan && modo !== "arte" && <>
          {btn("Registrar como agendada no mLabs", { acao: "agendar", itens: [r] }, "Agendamento registrado.")}
          <Botao variante="linha" onClick={() => setModo("arte")}>{t("Devolver arte ao {atendimento}")}</Botao>
        </>}
        {aba === "pub:agendadas" && kauan && modo !== "publicar" && <Botao onClick={() => setModo("publicar")}>Registrar publicação</Botao>}
      </div>
      {modo === "devolver" && comMotivo("devolverCalendario", "O que o Kauan precisa ajustar?", { itens: [r] }, "Devolvido ao Kauan.", `m-${id}`)}
      {modo === "arte" && comMotivo("devolverArte", t("Por que a arte volta ao {atendimento}? (arquivo incorreto ou informação faltando)"), r, t("Arte devolvida ao {atendimento}."), `m-${id}`)}
      {modo === "ajuste" && (
        <div className="grid max-w-xl gap-2">
          <label className="text-sm font-semibold" htmlFor={`m-${id}`}>O que ajustar neste post?</label>
          <textarea id={`m-${id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className="rounded border border-[#C9D7DC] bg-white p-3" />
          <div className="flex gap-3">
            <Botao carregando={ocupado} disabled={motivo.trim().length < 3} onClick={() => rodar({ acao: "avaliarCalendario", decisoes: [{ ...r, tipo: "ajuste", nota: motivo.trim() }] }, t("Ajuste enviado ao {atendimento}."))}>Enviar ajuste</Botao>
            <Botao variante="discreto" onClick={() => { setModo(""); setErro(""); }}>Cancelar</Botao>
          </div>
        </div>
      )}
      {modo === "publicar" && (
        <div className="grid max-w-xl gap-3">
          <label className="grid gap-1 text-sm font-semibold">Data da publicação<input type="date" max={hoje} value={pubData} onChange={(e) => setPubData(e.target.value)} className={campo} /></label>
          <label className="grid gap-1 text-sm font-semibold">Link da publicação<input type="url" inputMode="url" placeholder="https://" value={pubLink} onChange={(e) => setPubLink(e.target.value)} className={campo} /></label>
          {!pubLink.trim() && <label className="grid gap-1 text-sm font-semibold">Sem link? Explique<input value={semLink} onChange={(e) => setSemLink(e.target.value)} className={campo} /></label>}
          <div className="flex gap-3">
            <Botao carregando={ocupado} disabled={!pubLink.trim() && semLink.trim().length < 3}
              onClick={() => rodar({ acao: "publicar", itens: [{ ...r, data: pubData, ...(pubLink.trim() ? { link: pubLink.trim() } : { semLink: semLink.trim() }) }] }, "Publicação registrada.")}>Registrar</Botao>
            <Botao variante="discreto" onClick={() => { setModo(""); setErro(""); }}>Cancelar</Botao>
          </div>
        </div>
      )}
    </div>
  );
}

/* Calendário do mês (Kauan): vários posts de uma vez, mais as correções dos posts devolvidos. */
type Rascunho = { chave: string; mes?: string; id?: string; motivo?: string } & CalEntrada;
const vazio = (): Rascunho => ({ chave: Math.random().toString(36).slice(2), titulo: "", canais: [], data: "", hora: "", legenda: "", urgente: "" });

function FormCalendario({ cals, ctx, hoje }: { cals: Calendario[]; ctx: Ctx; hoje: string }) {
  const t = useTxt();
  const canais = useClienteAtivo().cliente.canaisSociais;
  const devolvidos = itensDe(cals).filter((i) => i.etapa === "ajuste");
  const [edits, setEdits] = useState<Record<string, Rascunho>>({});
  const [novos, setNovos] = useState<Rascunho[]>([vazio()]);
  const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState(false);
  const corrigidos: Rascunho[] = devolvidos.map((i) => edits[`${i.mes}${i.id}`] ?? { chave: `${i.mes}${i.id}`, mes: i.mes, id: i.id, motivo: i.ajuste?.motivo, titulo: i.titulo, canais: i.canais, data: i.data, hora: i.hora, legenda: i.legenda, urgente: i.urgente ?? "" });
  const trocar = (r: Rascunho) => r.id ? setEdits((e) => ({ ...e, [r.chave]: r })) : setNovos((n) => n.map((x) => x.chave === r.chave ? r : x));
  const preenchido = (r: Rascunho) => !!(r.titulo.trim() || r.legenda.trim() || r.data || r.canais.length);
  async function enviar() {
    const lista = [...corrigidos, ...novos.filter(preenchido)];
    if (!lista.length) { setErro("Inclua ao menos um post."); return; }
    for (const r of lista) { const m = erroItem({ ...r, urgente: urgenteCal(r, hoje) ? r.urgente : undefined }, hoje, canais); if (m) { setErro(`"${r.titulo.trim() || "Post sem tema"}": ${m}`); return; } }
    setOcupado(true); setErro("");
    const itens = lista.map((r) => ({ mes: r.mes, id: r.id, avulso: r.avulso || undefined, titulo: r.titulo, canais: r.canais, data: r.data, hora: r.hora, legenda: r.legenda, urgente: urgenteCal(r, hoje) ? r.urgente : undefined }));
    const res = await ctx.enviar("publicacao", { acao: "enviarCalendario", itens });
    setOcupado(false);
    if (res.ok) { setEdits({}); setNovos([vazio()]); ctx.onMsg("ok", t("Calendário enviado ao {atendimento}.")); } else setErro(res.msg);
  }
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }} noValidate>
      <p className="max-w-[75ch] text-sm text-gray-600">Monte o calendário do mês: tema, canais, data, horário e legenda de cada post. Envie com pelo menos {ANTECEDENCIA_DIAS} dias de antecedência. {t("O {atendimento} analisa e o {equipe} aprova;")} o agendamento no mLabs é feito por você, fora do portal.</p>
      {corrigidos.length > 0 && <h2 className="text-lg">Posts devolvidos para ajuste</h2>}
      {corrigidos.map((r) => <LinhaRascunho key={r.chave} r={r} canais={canais} hoje={hoje} onChange={trocar} />)}
      <h2 className="text-lg">Novos posts</h2>
      {novos.map((r) => <LinhaRascunho key={r.chave} r={r} canais={canais} hoje={hoje} onChange={trocar} onRemover={novos.length > 1 ? () => setNovos((n) => n.filter((x) => x.chave !== r.chave)) : undefined} />)}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-3">
        <Botao type="button" variante="linha" onClick={() => setNovos((n) => [...n, vazio()])}>Adicionar post</Botao>
        <Botao type="submit" carregando={ocupado}>{t("Enviar calendário ao {atendimento}")}</Botao>
      </div>
    </form>
  );
}

function LinhaRascunho({ r, canais, hoje, onChange, onRemover }: { r: Rascunho; canais: string[]; hoje: string; onChange: (r: Rascunho) => void; onRemover?: () => void }) {
  const t = useTxt();
  const id = `r-${r.chave}`;
  const urgente = !!r.data && urgenteCal(r, hoje);
  return (
    <fieldset className="grid gap-3 rounded border border-gray-200 bg-white p-3">
      <legend className="px-1 text-sm font-semibold">{r.titulo.trim() || "Post"}</legend>
      {r.motivo && <p className="rounded bg-alerta-100 px-3 py-2 text-sm text-alerta-700">Ajuste pedido: {r.motivo}</p>}
      <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-t`}>Tema ou orientação do post<input id={`${id}-t`} value={r.titulo} maxLength={300} onChange={(e) => onChange({ ...r, titulo: e.target.value })} className={campo} /></label>
      <label className="inline-flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" checked={!!r.avulso} onChange={(e) => onChange({ ...r, avulso: e.target.checked })} />{t("Fora do calendário aprovado (pedido avulso do {equipe})")}
      </label>
      <div className="flex flex-wrap gap-3" role="group" aria-label="Canais">
        {canais.map((c) => (
          <label key={c} className="inline-flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={r.canais.includes(c)} onChange={(e) => onChange({ ...r, canais: e.target.checked ? [...r.canais, c] : r.canais.filter((y: string) => y !== c) })} />{c}
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-d`}>Data<input id={`${id}-d`} type="date" min={hoje} value={r.data} onChange={(e) => onChange({ ...r, data: e.target.value })} className={campo} /></label>
        <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-h`}>Horário<input id={`${id}-h`} type="time" value={r.hora} onChange={(e) => onChange({ ...r, hora: e.target.value })} className={campo} /></label>
      </div>
      {r.data && <p className="text-xs text-gray-600">Semana de {brData(semanaDe(r.data))}.</p>}
      <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-l`}>Legenda<textarea id={`${id}-l`} rows={3} maxLength={3000} value={r.legenda} onChange={(e) => onChange({ ...r, legenda: e.target.value })} className="rounded border border-[#C9D7DC] bg-white p-3 font-normal" /></label>
      {urgente && <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-u`}>Menos de {ANTECEDENCIA_DIAS} dias: justifique a urgência<input id={`${id}-u`} value={r.urgente ?? ""} onChange={(e) => onChange({ ...r, urgente: e.target.value })} className={campo} /></label>}
      {onRemover && <div><Botao type="button" variante="discreto" onClick={onRemover}>Remover post</Botao></div>}
    </fieldset>
  );
}
