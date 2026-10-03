"use client";
/* Nova solicitação — o cliente escolhe serviços do catálogo vigente, organiza o briefing e envia.
   Sem valores nesta tela (decisão de 02/10/2026): preços ficam em Valores e Relatórios.
   O envio vai para a /fila; o servidor valida de novo, numera o protocolo e avisa por e-mail. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { avisarServidor, db } from "@/lib/firebase";
import { solicitacaoSchema } from "@/lib/schemas";
import { normalizarItem, sobreposicoes, validarItens, type ServicoBase } from "@/lib/solicitacao";
import { hojeSP, somarDiasUteis, PRAZO_PADRAO_DIAS_UTEIS } from "@/lib/datas";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Aviso, Botao } from "@/components/ui";
import { CLIENTES, type Cliente } from "@/content/clientes";

/* ---------- tipos ---------- */
interface ServicoPublico extends ServicoBase { descricao: string; escopo: string; nota?: string; variantes: { rotulo: string; modalidade: string; preco: number | null }[] }
interface CatalogoPublico { versao: string; status: string; categorias: { id: string; nome: string }[]; servicos: ServicoPublico[] }
interface ItemForm { cod: string; variante: number; qtd: number; opcao: string; canal: string; audio: string; obs: string }
interface Rascunho {
  titulo: string; unidade: string; email: string; objetivo: string; publico: string; itens: ItemForm[];
  drive: { link: string; conferido: boolean }; obs: string; prazo: { desejada: string; urgente: boolean }; conferido: boolean;
}
type Envio = { tipo: "ocioso" } | { tipo: "aguardando"; id: string; desde: number } | { tipo: "ok"; protocolo: string } | { tipo: "erro"; msg: string };

const vazio = (email: string): Rascunho => ({
  titulo: "", unidade: "", email, objetivo: "", publico: "", itens: [],
  drive: { link: "", conferido: false }, obs: "", prazo: { desejada: "", urgente: false }, conferido: false,
});
const limpo = <T,>(o: T): T => JSON.parse(JSON.stringify(o)); // Firestore não aceita undefined
const brData = (iso: string) => iso.split("-").reverse().join("/");
const pad = (n: number) => String(n).padStart(2, "0");
const SUBPASTAS = ["01 Briefing", "02 Materiais", "03 Provas", "04 Aprovados"];

/* ---------- peças de interface ---------- */
const cx = "min-h-11 w-full rounded border bg-white px-3";
const borda = (erro?: string) => (erro ? "border-alerta-700 ring-1 ring-alerta-700" : "border-[#C9D7DC]");

function Rotulo({ id, children, obrigatorio = true }: { id: string; children: ReactNode; obrigatorio?: boolean }) {
  return <label htmlFor={id} className="text-sm font-semibold">{children}{obrigatorio && <span className="text-alerta-700" aria-hidden="true"> *</span>}</label>;
}
function Erro({ id, erro }: { id: string; erro?: string }) {
  return erro ? <p id={`${id}-erro`} className="text-sm font-medium text-alerta-700">{erro}</p> : null;
}
function Selecao({ id, rotulo, valor, opcoes, vazio: ph, erro, onChange, obrigatorio }: {
  id: string; rotulo: string; valor: string | number; opcoes: [string | number, string][]; vazio?: string; erro?: string;
  onChange: (v: string) => void; obrigatorio?: boolean;
}) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Rotulo id={id} obrigatorio={obrigatorio}>{rotulo}</Rotulo>
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value)} aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined} className={`${cx} ${borda(erro)}`}>
        {ph && <option value="">{ph}</option>}
        {opcoes.map(([v, l]) => <option key={String(v)} value={v}>{l}</option>)}
      </select>
      <Erro id={id} erro={erro} />
    </div>
  );
}
function Texto({ id, rotulo, valor, erro, onChange, obrigatorio = true, ...p }: {
  id: string; rotulo: string; valor: string; erro?: string; onChange: (v: string) => void; obrigatorio?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Rotulo id={id} obrigatorio={obrigatorio}>{rotulo}</Rotulo>
      <input id={id} value={valor} onChange={(e) => onChange(e.target.value)} aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined} className={`${cx} ${borda(erro)}`} {...p} />
      <Erro id={id} erro={erro} />
    </div>
  );
}
function Nota({ tipo = "info", children }: { tipo?: "info" | "alerta"; children: ReactNode }) {
  return <div className={`rounded px-4 py-3 text-sm leading-relaxed ${tipo === "alerta" ? "bg-aviso-100 text-aviso-700" : "bg-[#EAF3F5]"}`}>{children}</div>;
}
function Secao({ n, chave, titulo, extra, children }: { n: number; chave: string; titulo: string; extra?: ReactNode; children: ReactNode }) {
  const [aberta, setAberta] = useState(true);
  return (
    <section id={`sec-${chave}`} aria-labelledby={`h-${chave}`} className="rounded border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3.5 md:px-5">
        <span className="font-display text-sm font-semibold text-marca-700">{pad(n)}</span>
        <h2 id={`h-${chave}`} className="mr-auto text-lg">{titulo}</h2>
        {extra}
        <button type="button" onClick={() => setAberta(!aberta)} aria-expanded={aberta} aria-controls={`b-${chave}`}
          className="grid size-9 place-items-center rounded hover:bg-paper" aria-label={`${aberta ? "Recolher" : "Expandir"} ${titulo}`}>
          <svg viewBox="0 0 24 24" className={`size-5 transition ${aberta ? "" : "-rotate-90"}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </header>
      <div id={`b-${chave}`} hidden={!aberta} className="grid gap-4 border-t border-gray-200 px-4 py-5 md:px-5">{children}</div>
    </section>
  );
}

/* ---------- item de serviço ---------- */
function ItemServico({ i, it, cat, cliente, erros, onChange, onRemover }: {
  i: number; it: ItemForm; cat: CatalogoPublico; cliente: Cliente; erros: Record<string, string>;
  onChange: (novo: ItemForm) => void; onRemover: () => void;
}) {
  const s = cat.servicos.find((x) => x.cod === it.cod) ?? cat.servicos[0];
  const v = s.variantes[it.variante];
  const sobOrcamento = v?.preco == null;
  const id = (k: string) => `it${i}-${k}`;
  const trocarServico = (cod: string) => {
    const novo = cat.servicos.find((x) => x.cod === cod)!;
    onChange({ ...it, cod, variante: 0, opcao: "", canal: novo.video ? cliente.canaisVideo[0] : "", audio: novo.video ? cliente.audiosVideo[0] : "" });
  };
  return (
    <div className="relative grid gap-4 rounded border border-[#C9D7DC] p-4 pr-14">
      <h3 className="text-base">Serviço {i + 1}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Selecao id={id("cat")} rotulo="Categoria" valor={s.categoria} opcoes={cat.categorias.map((c) => [c.id, c.nome])}
          onChange={(c) => trocarServico(cat.servicos.find((x) => x.categoria === c)!.cod)} />
        <Selecao id={id("cod")} rotulo="Serviço" valor={s.cod} erro={erros[id("cod")]}
          opcoes={cat.servicos.filter((x) => x.categoria === s.categoria).map((x) => [x.cod, `${x.cod} · ${x.nome}`])} onChange={trocarServico} />
        <Selecao id={id("variante")} rotulo="Modalidade e faixa" valor={it.variante} erro={erros[id("variante")]}
          opcoes={s.variantes.map((x, j) => [j, x.rotulo])} onChange={(x) => onChange({ ...it, variante: Number(x) })} />
        <Texto id={id("qtd")} rotulo="Quantidade" type="number" min={1} max={99} inputMode="numeric" valor={String(it.qtd)} erro={erros[id("qtd")]}
          onChange={(x) => onChange({ ...it, qtd: Math.max(1, Math.min(99, parseInt(x, 10) || 1)) })} />
      </div>
      {(s.opcao || s.video) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {s.opcao && <Selecao id={id("opcao")} rotulo={s.opcao.k} valor={it.opcao} vazio="Selecione" erro={erros[id("opcao")]}
            opcoes={s.opcao.o.map((o) => [o, o])} onChange={(x) => onChange({ ...it, opcao: x })} />}
          {s.video && <>
            <Selecao id={id("canal")} rotulo="Canal" valor={it.canal} erro={erros[id("canal")]} opcoes={cliente.canaisVideo.map((o) => [o, o])}
              onChange={(x) => onChange({ ...it, canal: x })} />
            <Selecao id={id("audio")} rotulo="Áudio / legendas" valor={it.audio} erro={erros[id("audio")]} opcoes={cliente.audiosVideo.map((o) => [o, o])}
              onChange={(x) => onChange({ ...it, audio: x })} />
          </>}
        </div>
      )}
      <Nota tipo={sobOrcamento ? "alerta" : "info"}>
        {sobOrcamento && <b className="block">Item a cotar: a Propaga define o valor conforme o contrato ao aceitar o pedido.</b>}
        <span>{s.escopo} Criação e ativos gerados pela Propaga incluídos.{s.video ? " Vídeos destinam-se às TVs internas; redes sociais dependem de solicitação expressa." : ""}</span>
        {s.nota && <b className="mt-1 block text-alerta-700">{s.nota}</b>}
        {s.video && it.canal && it.canal !== cliente.canaisVideo[0] && <b className="mt-1 block">Publicação em redes sociais exige solicitação expressa e verificação de direitos de uso.</b>}
      </Nota>
      <details open={!!it.obs} className="text-sm">
        <summary className="cursor-pointer font-semibold">Observação deste serviço</summary>
        <label htmlFor={id("obs")} className="sr-only">Observação do serviço {i + 1}</label>
        <textarea id={id("obs")} rows={3} maxLength={3000} value={it.obs} onChange={(e) => onChange({ ...it, obs: e.target.value })}
          placeholder="Orientações específicas para este item" className="mt-2 w-full rounded border border-[#C9D7DC] bg-white p-3" />
      </details>
      <button type="button" onClick={onRemover} aria-label={`Remover serviço ${i + 1}`}
        className="absolute right-3 top-3 grid size-9 place-items-center rounded text-gray-600 hover:bg-alerta-100 hover:text-alerta-700">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
      </button>
    </div>
  );
}

/* ---------- página ---------- */
function Conteudo() {
  const s = useSessao();
  const uid = s.usuario!.uid;
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  const cliente = CLIENTES[clienteId];
  const [cat, setCat] = useState<CatalogoPublico | null>(null);
  const [falhaCarga, setFalhaCarga] = useState("");
  const [r, setR] = useState<Rascunho | null>(null);
  const [salvoEm, setSalvoEm] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [envio, setEnvio] = useState<Envio>({ tipo: "ocioso" });
  const [demorando, setDemorando] = useState(false);
  const carregado = useRef(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const caixaErros = useRef<HTMLDivElement>(null);
  const refRascunho = useMemo(() => doc(db(), "clientes", clienteId, "rascunhos", uid), [clienteId, uid]);

  // Catálogo vigente (do Firestore, protegido por login e 2FA) + rascunho salvo.
  useEffect(() => {
    (async () => {
      const c = await getDoc(doc(db(), "clientes", clienteId));
      const versao = (c.data()?.catalogoVigente as string) || cliente.catalogoVersao;
      const k = await getDoc(doc(db(), "clientes", clienteId, "catalogo", versao));
      if (!k.exists()) throw new Error("sem catálogo");
      setCat(k.data() as CatalogoPublico);
      const salvo = await getDoc(refRascunho);
      setR(salvo.exists() ? { ...vazio(s.usuario?.email ?? ""), ...(salvo.data().dados as Rascunho) } : vazio(s.usuario?.email ?? ""));
      carregado.current = true;
    })().catch(() => setFalhaCarga("Não foi possível carregar o catálogo. Atualize a página; se continuar, fale com a Propaga."));
  }, [clienteId, cliente.catalogoVersao, refRascunho, s.usuario?.email]);

  // Rascunho automático (1 s depois da última alteração).
  useEffect(() => {
    if (!r || !carregado.current || envio.tipo === "ok") return;
    const t = setTimeout(() => {
      setDoc(refRascunho, { dados: limpo(r), salvoEm: serverTimestamp() })
        .then(() => setSalvoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })))
        .catch(() => setSalvoEm(""));
    }, 1000);
    return () => clearTimeout(t);
  }, [r, refRascunho, envio.tipo]);

  // Acompanha o envio na fila até o servidor responder.
  useEffect(() => {
    if (envio.tipo !== "aguardando") return;
    const lento = setTimeout(() => setDemorando(true), 75000);
    const parar = onSnapshot(doc(db(), "fila", envio.id), (d) => {
      const x = d.data() as { status: string; mensagem?: string; resultado?: { protocolo: string } } | undefined;
      if (x?.status === "ok" && x.resultado) {
        setEnvio({ tipo: "ok", protocolo: x.resultado.protocolo });
        deleteDoc(refRascunho).catch(() => {});
        window.scrollTo({ top: 0 });
      }
      if (x?.status === "erro") setEnvio({ tipo: "erro", msg: x.mensagem || "Não foi possível enviar a solicitação." });
    });
    return () => { parar(); clearTimeout(lento); };
  }, [envio, refRascunho]);

  const mudar = useCallback((p: Partial<Rascunho>) => setR((a) => (a ? { ...a, ...p } : a)), []);
  const limparErro = (k: string) => setErros((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; });

  if (falhaCarga) return <Casca titulo="Nova solicitação"><Aviso tipo="erro">{falhaCarga}</Aviso></Casca>;
  if (!cat || !r) return <Casca titulo="Nova solicitação"><p className="text-gray-600" aria-busy="true">Carregando o catálogo…</p></Casca>;

  const hoje = hojeSP();
  const primeira = somarDiasUteis(hoje, PRAZO_PADRAO_DIAS_UTEIS);
  const servico = (cod: string) => cat.servicos.find((x) => x.cod === cod)!;
  const pares = sobreposicoes(cliente, r.itens);
  const pendentes = r.itens.filter((it) => servico(it.cod)?.variantes[it.variante]?.preco == null).length;

  const montar = () => limpo({
    titulo: r.titulo, unidade: r.unidade, email: r.email.trim(), objetivo: r.objetivo, publico: r.publico,
    itens: r.itens.map((it) => normalizarItem(servico(it.cod), { ...it, opcao: it.opcao || undefined, canal: it.canal || undefined, audio: it.audio || undefined })),
    drive: { link: r.drive.link.trim(), conferido: r.drive.conferido }, obs: r.obs,
    prazo: r.prazo, conferido: r.conferido,
  });

  function validar() {
    const e: Record<string, string> = {};
    const p = solicitacaoSchema.safeParse(montar());
    if (!p.success) for (const iss of p.error.issues) {
      const [a, b, c] = iss.path.map(String);
      const k = a === "drive" ? (b === "link" ? "driveLink" : "driveOk") : a === "prazo" ? "desejada" : a === "itens" && b ? `it${b}-${c}` : a;
      e[k] ??= iss.message;
    }
    Object.assign(e, validarItens(cat!.servicos, r!.itens, cliente));
    if (r!.prazo.desejada && r!.prazo.desejada < hoje) e.desejada = "A data desejada já passou. Escolha outra data.";
    return e;
  }

  async function enviar() {
    const e = validar();
    setErros(e);
    if (Object.keys(e).length) { setTimeout(() => { caixaErros.current?.scrollIntoView({ block: "center" }); caixaErros.current?.querySelector("a")?.focus(); }, 30); return; }
    try {
      const ref = await addDoc(collection(db(), "fila"), { tipo: "enviar", uid, clienteId, dados: montar(), status: "pendente", criadoEm: serverTimestamp() });
      avisarServidor();
      setDemorando(false);
      setEnvio({ tipo: "aguardando", id: ref.id, desde: Date.now() });
    } catch {
      setEnvio({ tipo: "erro", msg: "Não foi possível registrar o envio. Verifique sua conexão e tente de novo." });
    }
  }

  function irPara(k: string) {
    const el = document.getElementById(k) ?? document.getElementById("addSvc");
    const sec = el?.closest("section");
    const b = sec?.querySelector<HTMLElement>("[hidden]");
    if (b) sec?.querySelector<HTMLButtonElement>("header button[aria-expanded]")?.click();
    setTimeout(() => el?.focus(), 30);
  }

  /* ---- envio concluído ---- */
  if (envio.tipo === "ok") {
    return (
      <Casca titulo="Solicitação enviada">
        <div className="grid max-w-2xl gap-5">
          <section className="grid gap-3 rounded border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-600">Protocolo</p>
            <p className="font-display text-3xl font-semibold">{envio.protocolo}</p>
            <p>A Propaga recebeu sua solicitação. As pessoas responsáveis foram avisadas por e-mail.</p>
            <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-gray-600">
              <li>A Propaga confere o briefing e o acesso à pasta do Drive.</li>
              <li>A Propaga aceita o pedido e confirma o cronograma. A produção começa.</li>
              <li>As versões chegam para aprovação, com até 2 refações incluídas.</li>
            </ol>
          </section>
          <div className="flex flex-wrap gap-3">
          <a href={`/solicitacoes/pedido/?p=${encodeURIComponent(envio.protocolo)}`} className="inline-flex min-h-11 items-center rounded border border-ink-900 bg-white px-5 font-semibold">Acompanhar este pedido</a>
          <Botao onClick={() => { setR(vazio(s.usuario?.email ?? "")); setErros({}); setEnvio({ tipo: "ocioso" }); }}>Nova solicitação</Botao>
          </div>
        </div>
      </Casca>
    );
  }

  const listaErros = Object.entries(erros);
  const aguardando = envio.tipo === "aguardando";

  return (
    <Casca titulo="Nova solicitação">
      <form noValidate onSubmit={(e) => { e.preventDefault(); enviar(); }} className="grid max-w-5xl gap-4">
        <p className="max-w-[70ch] text-gray-600">Organize o briefing, escolha os serviços e confira o prazo antes de enviar. Tudo o que você preenche fica salvo como rascunho.</p>

        <Secao n={1} chave="dados" titulo="Dados da solicitação">
          <div className="grid gap-4 md:grid-cols-3">
            <Texto id="titulo" rotulo="Título da solicitação" maxLength={120} valor={r.titulo} erro={erros.titulo} onChange={(v) => { mudar({ titulo: v }); limparErro("titulo"); }} />
            <Texto id="solicitante" rotulo="Solicitante" valor={s.usuario?.displayName || s.usuario?.email || ""} readOnly obrigatorio={false} onChange={() => {}} className={`${cx} border-[#C9D7DC] bg-paper`} />
            <Selecao id="unidade" rotulo="Unidade (matriz ou filial)" valor={r.unidade} vazio="Selecione" erro={erros.unidade}
              opcoes={cliente.unidades.map((u) => [u, u])} onChange={(v) => { mudar({ unidade: v }); limparErro("unidade"); }} />
            <Texto id="email" rotulo="E-mail de contato" type="email" autoComplete="email" valor={r.email} erro={erros.email} onChange={(v) => { mudar({ email: v }); limparErro("email"); }} />
            <Texto id="objetivo" rotulo="Objetivo" maxLength={160} valor={r.objetivo} erro={erros.objetivo} placeholder="Em uma frase" onChange={(v) => { mudar({ objetivo: v }); limparErro("objetivo"); }} />
            <Selecao id="publico" rotulo="Público da solicitação" valor={r.publico} vazio="Selecione" erro={erros.publico}
              opcoes={cliente.publicos.map((p) => [p.valor, p.rotulo])} onChange={(v) => { mudar({ publico: v }); limparErro("publico"); }} />
          </div>
        </Secao>

        <Secao n={2} chave="servicos" titulo="Serviços e composições" extra={
          <Botao type="button" id="addSvc" variante="discreto" className="min-h-9 px-3 text-sm" onClick={() => {
            const p = cat.servicos[0];
            mudar({ itens: [...r.itens, { cod: p.cod, variante: 0, qtd: 1, opcao: "", canal: p.video ? cliente.canaisVideo[0] : "", audio: p.video ? cliente.audiosVideo[0] : "", obs: "" }] });
            limparErro("itens");
            setTimeout(() => document.getElementById(`it${r.itens.length}-cat`)?.focus(), 30);
          }}>+ Adicionar serviço</Botao>}>
          {r.itens.length === 0 && <p className="rounded border border-dashed border-[#C9D7DC] px-4 py-6 text-center text-sm text-gray-600">Nenhum serviço adicionado. Use “Adicionar serviço” para começar.</p>}
          {r.itens.map((it, i) => (
            <ItemServico key={i} i={i} it={it} cat={cat} cliente={cliente} erros={erros}
              onChange={(novo) => { const itens = [...r.itens]; itens[i] = novo; mudar({ itens }); }}
              onRemover={() => { mudar({ itens: r.itens.filter((_, j) => j !== i) }); setErros({}); }} />
          ))}
          {pares.map(([a, b]) => (
            <Nota key={a + b} tipo="alerta">Os itens {a} ({servico(a).nome}) e {b} ({servico(b).nome}) se sobrepõem no catálogo. Confirme se precisa dos dois para não contratar o mesmo escopo duas vezes.</Nota>
          ))}
          <Erro id="itens" erro={erros.itens} />
          <p className="text-sm text-gray-600">Os campos mudam conforme o serviço: faixa de duração, telas, páginas, faces, dobras ou lâminas.</p>
        </Secao>

        <Secao n={3} chave="drive" titulo="Arquivos no Drive compartilhado">
          <Nota>Crie uma pasta para esta solicitação no Drive compartilhado da {cliente.nome} com as subpastas <b>01 Briefing</b>, <b>02 Materiais</b>, <b>03 Provas</b> e <b>04 Aprovados</b>. Compartilhe com o grupo da Propaga, nunca com link público.</Nota>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Texto id="driveLink" rotulo="Link da pasta compartilhada" type="url" inputMode="url" placeholder="https://drive.google.com/drive/folders/…"
              valor={r.drive.link} erro={erros.driveLink} onChange={(v) => { mudar({ drive: { ...r.drive, link: v } }); limparErro("driveLink"); }} />
            <a href={/^https:\/\/drive\.google\.com\//.test(r.drive.link.trim()) ? r.drive.link.trim() : "https://drive.google.com"} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded border border-ink-900 bg-white px-4 font-semibold">Abrir pasta<span className="sr-only"> (abre em nova aba)</span></a>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Subpastas esperadas">{SUBPASTAS.map((x) => <li key={x} className="rounded-full bg-paper px-3 py-1 text-sm">{x}</li>)}</ul>
          <label className="flex items-start gap-2.5">
            <input type="checkbox" id="driveOk" className="mt-1 size-4 accent-marca-700" checked={r.drive.conferido}
              aria-describedby={erros.driveOk ? "driveOk-erro" : undefined} onChange={(e) => { mudar({ drive: { ...r.drive, conferido: e.target.checked } }); limparErro("driveOk"); }} />
            <span>Conferi os arquivos e as permissões de acesso.</span>
          </label>
          <Erro id="driveOk" erro={erros.driveOk} />
          <p className="text-sm text-gray-600">A Propaga confirma o acesso depois do envio. O link informado não comprova a permissão.</p>
        </Secao>

        <Secao n={4} chave="obs" titulo="Observações para a Propaga" extra={
          <button type="button" className="text-sm font-semibold underline underline-offset-4" onClick={() => dialogo.current?.showModal()}>Ampliar campo</button>}>
          <label htmlFor="obs" className="sr-only">Observações gerais para a Propaga</label>
          <textarea id="obs" maxLength={30000} value={r.obs} onChange={(e) => mudar({ obs: e.target.value })} rows={12}
            placeholder={"Contexto, mensagem principal, referências, restrições.\nInforme aqui se precisa de filmagem, fotografia, impressão, fabricação ou montagem."}
            className="w-full rounded border border-[#C9D7DC] bg-white p-3 leading-relaxed" />
          <div className="flex flex-wrap justify-between gap-2 text-sm text-gray-600">
            <span>Filmagem, fotografia, impressão, fabricação e montagem são avaliadas e orçadas à parte, antes de qualquer contratação.</span>
            <span><span className="tabular-nums">{r.obs.length.toLocaleString("pt-BR")}</span> / 30.000</span>
          </div>
          <dialog ref={dialogo} aria-labelledby="dlg-obs" className="m-auto w-[min(960px,calc(100vw-32px))] rounded bg-white p-0 backdrop:bg-ink-900/60">
            <div className="grid gap-3 p-5">
              <div className="flex flex-wrap items-center gap-3"><h2 id="dlg-obs" className="mr-auto text-lg">Observações para a Propaga</h2>
                <span className="text-sm text-gray-600">{r.obs.length.toLocaleString("pt-BR")} / 30.000</span></div>
              <textarea aria-labelledby="dlg-obs" maxLength={30000} value={r.obs} onChange={(e) => mudar({ obs: e.target.value })}
                className="h-[65vh] w-full rounded border border-[#C9D7DC] p-3 leading-relaxed" />
              <Botao type="button" className="justify-self-end" onClick={() => { dialogo.current?.close(); document.getElementById("obs")?.focus(); }}>Concluir</Botao>
            </div>
          </dialog>
        </Secao>

        <Secao n={5} chave="prazo" titulo="Prazo">
          <div className="grid gap-4 md:grid-cols-3">
            <Texto id="desejada" rotulo="Data desejada" type="date" min={hoje} valor={r.prazo.desejada} erro={erros.desejada}
              onChange={(v) => { mudar({ prazo: { ...r.prazo, desejada: v } }); limparErro("desejada"); }} />
            <div className="grid content-start gap-1.5">
              <span className="text-sm font-semibold">Prazo padrão</span>
              <p className="flex min-h-11 items-center rounded border border-[#C9D7DC] bg-paper px-3" aria-live="polite">{PRAZO_PADRAO_DIAS_UTEIS} dias úteis · 1ª apresentação {brData(primeira)}</p>
            </div>
            <label className="flex items-center gap-2.5 md:mt-7">
              <input type="checkbox" className="size-4 accent-marca-700" checked={r.prazo.urgente} onChange={(e) => mudar({ prazo: { ...r.prazo, urgente: e.target.checked } })} />
              <span>Pedido urgente (cronograma individual)</span>
            </label>
          </div>
          {r.prazo.urgente
            ? <Nota tipo="alerta">Pedido urgente: a Propaga confirma um cronograma individual. Urgência não significa entrega garantida na data desejada.</Nota>
            : r.prazo.desejada && r.prazo.desejada >= hoje && r.prazo.desejada < primeira &&
              <Nota tipo="alerta">A data desejada ({brData(r.prazo.desejada)}) é anterior à primeira apresentação possível no prazo padrão ({brData(primeira)}). Marque o pedido como urgente ou ajuste a data.</Nota>}
          <Nota>O prazo conta a partir do briefing completo, dos materiais acessíveis e do aceite do pedido pela Propaga. Projetos complexos ou com muitas peças recebem cronograma confirmado pela Propaga. Feriados nacionais já considerados.</Nota>
        </Secao>

        <Secao n={6} chave="resumo" titulo="Resumo antes do envio" extra={<span className="rounded-full bg-[#E3F2EA] px-3 py-1 text-xs font-semibold text-[#1E7047]">Catálogo v{cat.versao} · {cat.status}</span>}>
          {r.itens.length ? (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600">
                  <tr><th className="px-3 py-2.5">Qtd.</th><th className="px-3 py-2.5">Serviço</th><th className="px-3 py-2.5">Preço</th></tr>
                </thead>
                <tbody>
                  {r.itens.map((it, i) => {
                    const sv = servico(it.cod); const v = sv.variantes[it.variante];
                    const det = [v?.rotulo, it.opcao, sv.video ? it.canal : "", sv.video ? it.audio : ""].filter(Boolean).join(" · ");
                    return (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="px-3 py-2.5 tabular-nums">{it.qtd}×</td>
                        <td className="px-3 py-2.5"><b>{sv.nome}</b><div className="text-gray-600">{sv.cod} · {det}</div></td>
                        <td className="px-3 py-2.5">{v?.preco == null ? <span className="rounded-full bg-aviso-100 px-2.5 py-0.5 text-xs font-semibold text-aviso-700">A cotar</span> : <span className="text-gray-600">Catálogo</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="rounded border border-dashed border-[#C9D7DC] px-4 py-6 text-center text-sm text-gray-600">Adicione ao menos um serviço na seção 02.</p>}
          <Nota><b>Prazo:</b> {PRAZO_PADRAO_DIAS_UTEIS} dias úteis após o aceite do pedido pela Propaga (1ª apresentação prevista para {brData(primeira)}, se aceito hoje).</Nota>
          <Nota>Os preços ficam no menu Jobs Propaga e nos Relatórios.{pendentes ? ` ${pendentes > 1 ? "Os itens a cotar recebem" : "O item a cotar recebe"} valor da Propaga conforme o contrato.` : ""}</Nota>

          {listaErros.length > 0 && (
            <div ref={caixaErros} role="alert" className="rounded bg-alerta-100 px-4 py-3 text-sm text-alerta-700">
              <b>Antes de enviar, corrija:</b>
              <ul className="mt-1 list-disc pl-5">{listaErros.map(([k, m]) => <li key={k}><a href={`#${k}`} className="underline" onClick={(e) => { e.preventDefault(); irPara(k); }}>{m}</a></li>)}</ul>
            </div>
          )}
          {envio.tipo === "erro" && <Aviso tipo="erro">{envio.msg}</Aviso>}
          {aguardando && <Aviso>{demorando ? "O servidor ainda não respondeu. Sua solicitação está na fila e será processada; não envie de novo." : "Enviando… costuma levar poucos segundos (no máximo 1 minuto)."}</Aviso>}

          <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 pt-4">
            <label className="mr-auto flex items-start gap-2.5">
              <input type="checkbox" id="conferido" className="mt-1 size-4 accent-marca-700" checked={r.conferido}
                onChange={(e) => { mudar({ conferido: e.target.checked }); limparErro("conferido"); }} />
              <span>Conferi os serviços, os materiais e as informações.</span>
            </label>
            <span className="text-sm text-gray-600" aria-live="polite">{salvoEm ? `Rascunho salvo às ${salvoEm}` : "Rascunho automático ativo"}</span>
            <Botao type="submit" disabled={!r.conferido} carregando={aguardando}>Enviar solicitação</Botao>
          </div>
          <p className="text-sm text-gray-600">Ao enviar, as pessoas responsáveis da {cliente.nome} e da Propaga recebem um aviso por e-mail. Recebimento, aprovações e entregas ficam registrados no acompanhamento.</p>
        </Secao>
      </form>
    </Casca>
  );
}

export default function NovaSolicitacao() {
  return <Protegido papeis={["solicitante", "admin"]}><Conteudo /></Protegido>;
}
