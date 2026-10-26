/* Publicação nas redes sociais (fila tipo "publicacao"). Ver o fluxo em src/lib/publicacao.ts.
   O calendário fica em clientes/{c}/calendarios/{AAAA-MM}; o vínculo com a peça também é gravado na peça (peca.cal).
   Tudo o que uma chamada altera é gravado junto (tudo ou nada). O portal NÃO publica nem fala com o mLabs. */
import { CLIENTES } from "@/content/clientes";
import { hojeSP } from "@/lib/datas";
import type { Peca } from "@/lib/pecas";
import { arteDe, erroItem, mesDe, NOME_MES, type CalItem, type EtapaCal, type RefCal } from "@/lib/publicacao";
import { pubAcaoSchema } from "@/lib/schemas";
import { emailAtualizacao } from "./emails";
import type { Firestore } from "./firestore";
import { usuarios, type Pedido, type Quem, type Usuario } from "./pecas";
import { lerConfig } from "./servidor";
import { ErroUsuario, type Plataforma } from "./plataforma";
import { atendeCliente, MSG_SEM_VINCULO } from "@/lib/vinculos";

const PODE: Record<string, string[]> = {
  enviarCalendario: ["midia_social", "admin"],
  enviarADebora: ["atendimento", "admin"],
  devolverCalendario: ["atendimento", "admin"],
  avaliarCalendario: ["solicitante", "admin"],
  vincular: ["atendimento", "admin"],
  devolverArte: ["midia_social", "admin"],
  reenviarArte: ["atendimento", "admin"],
  agendar: ["midia_social", "admin"],
  publicar: ["midia_social", "admin"],
};
const br = (d: string) => d.split("-").reverse().join("/");

export function executarPublicacao(p: Plataforma, fs: Firestore, u: Usuario, clienteId: string, bruto: unknown) {
  const r = pubAcaoSchema.safeParse(bruto);
  if (!r.success) throw new ErroUsuario(r.error.issues[0]?.message || "Dados inválidos.");
  const d = r.data;
  const cli = CLIENTES[clienteId];
  if (!cli) throw new ErroUsuario("Cliente não encontrado.");
  if (!atendeCliente(u, clienteId)) throw new ErroUsuario(u.propaga ? MSG_SEM_VINCULO : "Cliente inválido para o seu acesso.");
  if (!PODE[d.acao].includes(u.papel)) throw new ErroUsuario("Esta ação não está disponível para o seu perfil.");

  const agora = p.agora().toISOString();
  const hoje = hojeSP(p.agora());

  // Calendários (um documento por mês) e pedidos tocados por esta chamada.
  const cals = new Map<string, { caminho: string; existe: boolean; atualizadoEm: string; itens: CalItem[]; mexeu: boolean }>();
  const calendario = (mes: string) => {
    let c = cals.get(mes); if (c) return c;
    const caminho = `clientes/${clienteId}/calendarios/${mes}`;
    const doc = fs.ler(caminho);
    c = { caminho, existe: !!doc, atualizadoEm: doc?.atualizadoEm ?? "", itens: doc ? JSON.parse(JSON.stringify((doc.dados as { itens?: CalItem[] }).itens ?? [])) : [], mexeu: false };
    cals.set(mes, c); return c;
  };
  const item = (ref: RefCal) => {
    const c = calendario(ref.mes); const it = c.itens.find((x) => x.id === ref.id);
    if (!it) throw new ErroUsuario("Post não encontrado no calendário.");
    it.mes = ref.mes; c.mexeu = true; return it;
  };
  const pedidos = new Map<string, { caminho: string; atualizadoEm: string; ped: Pedido; pecas: Peca[]; mexeu: boolean }>();
  const pedido = (protocolo: string) => {
    let x = pedidos.get(protocolo); if (x) return x;
    const caminho = `clientes/${clienteId}/solicitacoes/${protocolo}`;
    const doc = fs.ler(caminho);
    if (!doc) throw new ErroUsuario("Pedido não encontrado.");
    const ped = doc.dados as unknown as Pedido;
    x = { caminho, atualizadoEm: doc.atualizadoEm, ped, pecas: JSON.parse(JSON.stringify(ped.pecas ?? [])), mexeu: false };
    pedidos.set(protocolo, x); return x;
  };
  const exigir = (it: CalItem, etapas: EtapaCal[], msg: string) => { if (!etapas.includes(it.etapa)) throw new ErroUsuario(`"${it.titulo}": ${msg}`); };
  const mover = (it: CalItem, etapa: EtapaCal, txt: string) => { it.etapa = etapa; it.desde = agora; it.hist.push({ em: agora, por: u.nome, txt }); };
  const avisos = new Map<string, { quem: Quem[]; rotulo: string; linhas: string[]; mes: string }>();
  const avisa = (quem: Quem[], rotulo: string, it: CalItem) => {
    const k = quem.join(",") + rotulo + it.mes; const a = avisos.get(k) ?? { quem, rotulo, linhas: [], mes: it.mes };
    a.linhas.push(`- ${br(it.data)} ${it.hora} · ${it.titulo}`); avisos.set(k, a);
  };
  const todosPedidos = () => fs.listar(`clientes/${clienteId}/solicitacoes`).map((x) => x.dados as unknown as Pedido);

  switch (d.acao) {
    case "enviarCalendario": {
      for (const e of d.itens) {
        const entrada = { avulso: e.avulso || undefined, titulo: e.titulo.trim(), canais: e.canais, data: e.data, hora: e.hora, legenda: e.legenda.trim(), urgente: e.urgente?.trim() || undefined };
        const erro = erroItem(entrada, hoje, cli.canaisSociais);
        if (erro) throw new ErroUsuario(`"${entrada.titulo || "post"}": ${erro}`);
        if (e.id) {
          if (!e.mes) throw new ErroUsuario("Post sem mês.");
          const it = item({ mes: e.mes, id: e.id });
          exigir(it, ["ajuste"], "só post devolvido para ajuste pode ser corrigido.");
          if (mesDe(entrada.data) !== e.mes) throw new ErroUsuario(`"${entrada.titulo}": a data deve continuar em ${NOME_MES(e.mes)}. Para outro mês, inclua um novo post.`);
          Object.assign(it, entrada); it.ajuste = null;
          mover(it, "analise", `Corrigido e reenviado: ${entrada.canais.join(", ")} · ${br(entrada.data)} ${entrada.hora}`);
          avisa(["atendimento"], "Calendário de publicações para analisar", it);
        } else {
          const mes = mesDe(entrada.data); const c = calendario(mes); c.mexeu = true;
          const n = c.itens.reduce((m, x) => Math.max(m, parseInt(x.id.slice(1), 10) || 0), 0) + 1;
          const it: CalItem = { id: `p${n}`, mes, ...entrada, etapa: "analise", desde: agora, ajuste: null, peca: null, publicada: null,
            hist: [{ em: agora, por: u.nome, txt: `Enviado ao Marcelo: ${entrada.canais.join(", ")} · ${br(entrada.data)} ${entrada.hora}${entrada.urgente ? ` · urgente: ${entrada.urgente}` : ""}` }] };
          c.itens.push(it);
          avisa(["atendimento"], "Calendário de publicações para analisar", it);
        }
      }
      break;
    }
    case "enviarADebora": {
      for (const ref of d.itens) {
        const it = item(ref); exigir(it, ["analise"], "este post não está em análise.");
        mover(it, "debora", `Analisado pelo Marcelo e enviado ao ${cli.marca.equipe}`);
        avisa(["solicitante"], "Calendário de publicações para sua aprovação", it);
      }
      break;
    }
    case "devolverCalendario": {
      for (const ref of d.itens) {
        const it = item(ref); exigir(it, ["analise"], "este post não está em análise.");
        it.ajuste = { de: "marcelo", motivo: d.motivo, por: u.nome, em: agora };
        mover(it, "ajuste", `Devolvido ao Kauan: ${d.motivo}`);
        avisa(["midia_social"], `Calendário devolvido para ajuste · ${d.motivo}`, it);
      }
      break;
    }
    case "avaliarCalendario": {
      for (const dec of d.decisoes) {
        const it = item(dec); exigir(it, ["debora"], `este post não está aguardando o ${cli.marca.equipe}.`);
        if (dec.tipo === "aprovada") {
          it.ajuste = null; mover(it, "aprovado", `Aprovado pelo ${cli.marca.equipe}`);
          avisa(["atendimento", "midia_social"], `Calendário aprovado pelo ${cli.marca.equipe}`, it);
        } else {
          if ((dec.nota?.length ?? 0) < 3) throw new ErroUsuario(`"${it.titulo}": escreva o ajuste pedido.`);
          it.ajuste = { de: "debora", motivo: dec.nota!, por: u.nome, em: agora };
          mover(it, "analise", `Ajuste pedido pelo ${cli.marca.equipe}: ${dec.nota}`);
          avisa(["atendimento"], `Ajuste pedido pelo ${cli.marca.equipe} · ${dec.nota}`, it);
        }
      }
      break;
    }
    case "vincular": {
      const it = item(d); exigir(it, ["ajuste", "analise", "debora", "aprovado", "devolvida"], "post já agendado ou publicado não troca de peça.");
      const pd = pedido(d.protocolo);
      if (pd.ped.status === "cancelada") throw new ErroUsuario("Este pedido está cancelado.");
      const x = pd.pecas.find((q) => q.id === d.pecaId);
      if (!x) throw new ErroUsuario("Peça não encontrada.");
      if (x.etapa === "encerrada") throw new ErroUsuario(`"${x.nome}" foi cancelada.`);
      if (x.cal && !(x.cal.mes === d.mes && x.cal.id === d.id)) throw new ErroUsuario(`"${x.nome}" já está vinculada a outro post do calendário.`);
      if (it.peca && !(it.peca.protocolo === d.protocolo && it.peca.id === d.pecaId)) {
        const ant = pedido(it.peca.protocolo); const a = ant.pecas.find((q) => q.id === it.peca!.id);
        if (a) { a.cal = null; ant.mexeu = true; }
      }
      x.cal = { mes: d.mes, id: d.id }; pd.mexeu = true;
      it.peca = { protocolo: d.protocolo, id: d.pecaId, nome: x.nome };
      it.hist.push({ em: agora, por: u.nome, txt: `Vinculado à peça "${x.nome}" (${d.protocolo})` });
      if (it.etapa === "devolvida") { it.etapa = "aprovado"; it.desde = agora; }
      break;
    }
    case "devolverArte": {
      const it = item(d); exigir(it, ["aprovado"], "só post com arte vinculada pode ser devolvido.");
      if (!arteDe(it, [...todosPedidos()]).pronta) throw new ErroUsuario(`"${it.titulo}": a arte ainda não está pronta.`);
      it.ajuste = { de: "kauan", motivo: d.motivo, por: u.nome, em: agora };
      mover(it, "devolvida", `Arte devolvida ao Marcelo: ${d.motivo}`);
      avisa(["atendimento"], `Arte devolvida pelo Kauan · ${d.motivo}`, it);
      break;
    }
    case "reenviarArte": {
      for (const ref of d.itens) {
        const it = item(ref); exigir(it, ["devolvida"], "este post não está com a arte devolvida.");
        it.ajuste = null; mover(it, "aprovado", "Arte corrigida e reenviada ao Kauan");
        avisa(["midia_social"], "Arte corrigida, pronta para publicar", it);
      }
      break;
    }
    case "agendar": {
      const peds = todosPedidos();
      for (const ref of d.itens) {
        const it = item(ref); exigir(it, ["aprovado"], "só post com o calendário aprovado pode ser agendado.");
        if (!it.peca) throw new ErroUsuario(`"${it.titulo}": o Marcelo ainda não vinculou a peça deste post.`);
        if (!arteDe(it, peds).pronta) throw new ErroUsuario(`"${it.titulo}": a arte ainda não foi aprovada pelo ${cli.marca.equipe} com arquivo final.`);
        it.agendadaEm = agora;
        mover(it, "agendada", `Agendada no mLabs: ${it.canais.join(", ")} · ${br(it.data)} ${it.hora}`);
      }
      break;
    }
    case "publicar": {
      for (const e of d.itens) {
        const it = item(e); exigir(it, ["agendada"], "só post agendado pode ser registrado como publicado.");
        if (e.data > hoje) throw new ErroUsuario(`"${it.titulo}": a data de publicação não pode ser futura.`);
        if (!e.link && (e.semLink?.length ?? 0) < 3) throw new ErroUsuario(`"${it.titulo}": cole o link da publicação ou explique por que não há link.`);
        if (e.link && !/^https:\/\//.test(e.link)) throw new ErroUsuario(`"${it.titulo}": o link deve começar com https://.`);
        it.publicada = { data: e.data, link: e.link || undefined, semLink: e.link ? undefined : e.semLink, em: agora, por: u.nome };
        mover(it, "publicada", `Publicada em ${br(e.data)}${e.link ? ` · ${e.link}` : ` · sem link: ${e.semLink}`}`);
      }
      break;
    }
  }

  const gravar: Parameters<Firestore["gravar"]>[0] = [];
  for (const c of cals.values()) if (c.mexeu) {
    const mes = c.caminho.split("/").pop()!;
    gravar.push(c.existe
      ? { caminho: c.caminho, dados: { mes, itens: c.itens, atualizadoEm: p.agora() }, mesclar: true, seAtualizadoEm: c.atualizadoEm }
      : { caminho: c.caminho, dados: { mes, itens: c.itens, atualizadoEm: p.agora() }, seNaoExiste: true });
  }
  for (const x of pedidos.values()) if (x.mexeu)
    gravar.push({ caminho: x.caminho, dados: { pecas: x.pecas, atualizadoEm: p.agora() }, mesclar: true, seAtualizadoEm: x.atualizadoEm });
  try { fs.gravar(gravar); }
  catch { throw new ErroUsuario("O calendário foi atualizado por outra pessoa agora há pouco. Recarregue a página e tente de novo."); }

  for (const a of avisos.values()) avisarCalendario(p, fs, u, clienteId, a.quem, a.mes, a.rotulo, a.linhas.join("\n"));
  return { ok: true, itens: [...cals.values()].reduce((n, c) => n + (c.mexeu ? 1 : 0), 0) };
}

/** E-mail de aviso do calendário (não pertence a um pedido). */
function avisarCalendario(p: Plataforma, fs: Firestore, autor: Usuario, clienteId: string, quem: Quem[], mes: string, rotulo: string, nota: string) {
  try {
    const cfg = lerConfig(p);
    const dest = usuarios(fs).filter((x) => x.uid !== autor.uid && (x as { status?: string }).status !== "desativado" && (
      (quem.includes("solicitante") && x.papel === "solicitante" && x.clienteId === clienteId) ||
      (quem.includes("atendimento") && x.papel === "atendimento" && atendeCliente(x, clienteId)) ||
      (quem.includes("midia_social") && x.papel === "midia_social" && atendeCliente(x, clienteId))));
    if (!dest.length) return;
    const msg = emailAtualizacao({ cliente: CLIENTES[clienteId].nomePortal, protocolo: `Calendário ${mes}`, titulo: `Publicações de ${NOME_MES(mes)}`, rotulo, nota,
      autor: autor.nome, etapa: "Redes sociais", link: `${cfg.portalUrl}/aprovacoes/` });
    for (const x of dest) {
      try { p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); }
      catch (e) { p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
    }
  } catch (e) { p.log(`Avisos do calendário ${mes} falharam: ${(e as Error).message}`); }
}
