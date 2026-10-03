/* Aprovação por peça (fila tipo "peca"). Ver o fluxo em src/lib/pecas.ts.
   Grava as peças no próprio documento do pedido (campo `pecas`), com pré-condição de versão. */
import { CLIENTES } from "@/content/clientes";
import { MAX_RODADAS, NOME_STATUS } from "@/lib/fluxo";
import { hojeSP } from "@/lib/datas";
import { atrasada, pendentePara, prazoEtapa, prontoParaEntrega, statusPorPecas, ultima, type Peca } from "@/lib/pecas";
import { pecaAcaoSchema } from "@/lib/schemas";
import type { Status } from "@/lib/tipos";
import { emailAtualizacao, emailResumo } from "./emails";
import type { Firestore } from "./firestore";
import { ErroUsuario, type Plataforma } from "./plataforma";
import { lerConfig } from "./servidor";

interface Usuario { uid: string; nome: string; papel: string; email: string; clienteId: string | null; propaga?: boolean }
interface Pedido {
  protocolo: string; titulo: string; status: Status; solicitanteUid: string; rodadas: number; versao: number;
  itens: { nome: string }[]; pecas?: Peca[]; temPecas?: boolean;
}
type Quem = "solicitante" | "atendimento" | "criativo" | "financeiro_propaga";

const PODE: Record<string, string[]> = {
  publicar: ["atendimento", "admin"],
  avaliar: ["solicitante", "admin"],
  encaminhar: ["atendimento", "admin"],
  enviarVersao: ["criativo", "atendimento", "admin"],
  finalizar: ["criativo", "atendimento", "admin"],
  ciente: ["criativo", "atendimento", "admin"],
  liberar: ["atendimento", "admin"],
  devolver: ["atendimento", "admin"],
};

export function executarPeca(p: Plataforma, fs: Firestore, u: Usuario, clienteId: string, bruto: unknown) {
  const r = pecaAcaoSchema.safeParse(bruto);
  if (!r.success) throw new ErroUsuario(r.error.issues[0]?.message || "Dados inválidos.");
  const d = r.data;
  if (!CLIENTES[clienteId]) throw new ErroUsuario("Cliente não encontrado.");
  if (!u.propaga && u.clienteId !== clienteId) throw new ErroUsuario("Cliente inválido para o seu acesso.");
  if (!PODE[d.acao].includes(u.papel)) throw new ErroUsuario("Esta ação não está disponível para o seu perfil.");

  const caminho = `clientes/${clienteId}/solicitacoes/${d.protocolo}`;
  const doc = fs.ler(caminho);
  if (!doc) throw new ErroUsuario("Pedido não encontrado.");
  const ped = doc.dados as unknown as Pedido;
  if (u.papel === "solicitante" && ped.solicitanteUid !== u.uid) throw new ErroUsuario("Este pedido não é seu.");
  if (["entregue", "faturada", "paga"].includes(ped.status) || (ped.status === "cancelada" && !ped.temPecas))
    throw new ErroUsuario("Este pedido já foi encerrado.");

  const agora = p.agora().toISOString();
  const pecas: Peca[] = JSON.parse(JSON.stringify(ped.pecas ?? []));
  const achar = (id: string) => { const x = pecas.find((q) => q.id === id); if (!x) throw new ErroUsuario("Peça não encontrada."); return x; };
  const mover = (x: Peca, etapa: Peca["etapa"], tarefa: Peca["tarefa"] = null) => { x.etapa = etapa; x.tarefa = tarefa; x.desde = agora; };
  const log = (x: Peca, txt: string) => x.hist.push({ em: agora, por: u.nome, txt });
  let rodadas = ped.rodadas || 0;
  const avisos: { quem: Quem[]; rotulo: string; nota: string }[] = [];
  let rotuloEvento = "";

  switch (d.acao) {
    case "publicar": {
      if (!["producao", "apresentacao"].includes(ped.status)) throw new ErroUsuario("Publique as peças depois de aceitar o pedido.");
      const base = pecas.length;
      d.pecas.forEach((n, i) => {
        if (n.item != null && !ped.itens[n.item]) throw new ErroUsuario(`Serviço inválido na peça "${n.nome}".`);
        const x: Peca = { id: `p${base + i + 1}`, nome: n.nome, item: n.item, etapa: "cliente", tarefa: null, orientacao: null, extras30: 0,
          versoes: [{ v: 1, link: n.link, em: agora, por: u.nome, decisao: null }], hist: [], desde: agora };
        log(x, "v1 enviada à Débora para aprovação");
        pecas.push(x);
      });
      rotuloEvento = `${d.pecas.length} peça(s) enviada(s) para aprovação`;
      avisos.push({ quem: ["solicitante"], rotulo: "Peças para sua aprovação", nota: d.pecas.map((n) => `- ${n.nome}`).join("\n") });
      break;
    }
    case "avaliar": {
      const naVez = pecas.filter((x) => x.etapa === "cliente");
      if (!naVez.length) throw new ErroUsuario("Não há peças aguardando avaliação.");
      const porId = new Map(d.decisoes.map((x) => [x.id, x]));
      const faltando = naVez.filter((x) => !porId.has(x.id));
      if (faltando.length) throw new ErroUsuario(`Avalie todas as peças antes de enviar: ${faltando.map((x) => x.nome).join(", ")}.`);
      const temRefacao = d.decisoes.some((x) => x.tipo === "refacao");
      if (temRefacao) rodadas++;
      const ap: string[] = [], rf: string[] = [], cn: string[] = [];
      for (const x of naVez) {
        const dec = porId.get(x.id)!;
        if (dec.tipo === "refacao" && !dec.itens?.length) throw new ErroUsuario(`Liste os ajustes de "${x.nome}".`);
        if (dec.tipo === "cancelada" && (dec.nota?.length ?? 0) < 3) throw new ErroUsuario(`Justifique o cancelamento de "${x.nome}".`);
        ultima(x).decisao = { tipo: dec.tipo, itens: dec.tipo === "refacao" ? dec.itens : undefined, nota: dec.nota || undefined, por: u.nome, em: agora };
        if (dec.tipo === "aprovada") { mover(x, "criativo", "final"); log(x, "Aprovada · relatório: concluída · Mariane prepara o arquivo final"); ap.push(x.nome); }
        if (dec.tipo === "cancelada") { mover(x, "criativo", "ciencia"); log(x, "Cancelada · relatório: 50% · Mariane avisada para interromper"); cn.push(x.nome); }
        if (dec.tipo === "refacao") { mover(x, "triagem"); log(x, `Refação pedida (${rodadas}ª)${rodadas > MAX_RODADAS ? " · sujeita a +30%" : ""}`); rf.push(`${x.nome}: ${dec.itens!.join("; ")}`); }
      }
      rotuloEvento = `Avaliação enviada: ${ap.length} aprovada(s), ${rf.length} refação(ões), ${cn.length} cancelada(s)`;
      const resumo = [ap.length ? `Aprovadas: ${ap.join(", ")}` : "", rf.length ? `Refação:\n${rf.map((t) => `- ${t}`).join("\n")}` : "", cn.length ? `Canceladas (50%): ${cn.join(", ")}` : ""].filter(Boolean).join("\n");
      avisos.push({ quem: ["atendimento"], rotulo: rf.length ? "Avaliação recebida · oriente a refação" : "Avaliação recebida", nota: resumo });
      if (ap.length || cn.length) avisos.push({ quem: ["criativo"], rotulo: "Peças avaliadas pela Débora",
        nota: [ap.length ? `Preparar arquivo final em 04 Aprovados: ${ap.join(", ")}` : "", cn.length ? `Interromper (cancelada): ${cn.join(", ")}` : ""].filter(Boolean).join("\n") });
      if (cn.length) avisos.push({ quem: ["financeiro_propaga"], rotulo: "Peça cancelada após apresentação · cobrança de 50%", nota: cn.join(", ") });
      break;
    }
    case "encaminhar": {
      if (d.prazo < hojeSP(p.agora())) throw new ErroUsuario("O prazo não pode estar no passado.");
      const naVez = pecas.filter((x) => x.etapa === "triagem");
      const porId = new Map(d.refacoes.map((x) => [x.id, x]));
      if (!naVez.length) throw new ErroUsuario("Não há refações para encaminhar.");
      const cobradas: string[] = [];
      for (const x of naVez) {
        const o = porId.get(x.id);
        if (!o) throw new ErroUsuario(`Inclua a orientação de "${x.nome}".`);
        x.orientacao = { itens: o.itens, prazo: d.prazo, por: u.nome, em: agora };
        if (o.cobrar30 && rodadas > MAX_RODADAS) { x.extras30 = (x.extras30 || 0) + 1; cobradas.push(x.nome); log(x, "Refação extra com edições novas: +30% no valor"); }
        mover(x, "criativo", "refazer");
        log(x, `Encaminhada à Mariane · prazo ${d.prazo.split("-").reverse().join("/")}`);
      }
      rotuloEvento = `${naVez.length} refação(ões) encaminhada(s) ao criativo`;
      avisos.push({ quem: ["criativo"], rotulo: "Refação para fazer", nota: naVez.map((x) => `- ${x.nome}: ${x.orientacao!.itens.join("; ")}`).join("\n") + `\nPrazo: ${d.prazo.split("-").reverse().join("/")}` });
      if (cobradas.length) avisos.push({ quem: ["solicitante", "financeiro_propaga"], rotulo: "Refação extra · +30% no valor da peça", nota: cobradas.join(", ") });
      break;
    }
    case "enviarVersao": {
      const x = achar(d.id);
      if (x.etapa !== "criativo" || x.tarefa !== "refazer") throw new ErroUsuario("Esta peça não está aguardando nova versão.");
      const n = x.orientacao?.itens.length ?? 0;
      if (d.feitos < n && (d.nota?.length ?? 0) < 3) throw new ErroUsuario("Marque todos os ajustes ou explique o que ficou pendente.");
      const v = ultima(x).v + 1;
      x.versoes.push({ v, link: d.link, em: agora, por: u.nome, interna: true, nota: d.nota || undefined, feitos: d.feitos, decisao: null });
      mover(x, "revisao");
      log(x, `v${v} enviada ao Marcelo para revisão (${d.feitos} de ${n} ajustes)`);
      rotuloEvento = `${x.nome}: v${v} para revisão`;
      avisos.push({ quem: ["atendimento"], rotulo: `Nova versão para revisar · ${x.nome}`, nota: d.nota || "" });
      break;
    }
    case "finalizar": {
      const x = achar(d.id);
      if (x.etapa !== "criativo" || x.tarefa !== "final") throw new ErroUsuario("Esta peça não está aguardando arquivo final.");
      mover(x, "concluida"); log(x, "Arquivo final em 04 Aprovados");
      rotuloEvento = `${x.nome}: arquivo final entregue`;
      break;
    }
    case "ciente": {
      const x = achar(d.id);
      if (x.etapa !== "criativo" || x.tarefa !== "ciencia") throw new ErroUsuario("Esta peça não está aguardando ciência.");
      mover(x, "encerrada"); log(x, "Ciência do cancelamento registrada");
      rotuloEvento = `${x.nome}: cancelamento ciente`;
      break;
    }
    case "liberar": {
      const nomes: string[] = [];
      for (const id of d.ids) {
        const x = achar(id);
        if (x.etapa !== "revisao") throw new ErroUsuario(`"${x.nome}" não está em revisão.`);
        ultima(x).interna = false; mover(x, "cliente"); log(x, `v${ultima(x).v} aprovada pelo Marcelo e enviada à Débora`); nomes.push(x.nome);
      }
      rotuloEvento = `Nova versão enviada à Débora: ${nomes.join(", ")}`;
      avisos.push({ quem: ["solicitante"], rotulo: "Nova versão para sua aprovação", nota: nomes.map((t) => `- ${t}`).join("\n") });
      break;
    }
    case "devolver": {
      const x = achar(d.id);
      if (x.etapa !== "revisao") throw new ErroUsuario("Esta peça não está em revisão.");
      x.versoes.pop();
      x.orientacao = { itens: d.itens, prazo: x.orientacao?.prazo ?? hojeSP(p.agora()), por: u.nome, em: agora };
      mover(x, "criativo", "refazer"); log(x, "Devolvida à Mariane pelo Marcelo (ajuste interno, não conta refação)");
      rotuloEvento = `${x.nome}: devolvida ao criativo`;
      avisos.push({ quem: ["criativo"], rotulo: `Ajuste interno · ${x.nome}`, nota: d.itens.map((t) => `- ${t}`).join("\n") });
      break;
    }
  }

  const status = statusPorPecas(pecas, ped.status);
  const mudancas: Record<string, unknown> = {
    pecas, temPecas: true, rodadas, status, atualizadoEm: p.agora(),
    versao: Math.max(ped.versao || 0, ...pecas.map((x) => ultima(x).v)),
  };
  const pronto = !prontoParaEntrega(ped.pecas ?? []) && prontoParaEntrega(pecas);
  if (pronto) avisos.push({ quem: ["atendimento"], rotulo: "Pedido pronto para entrega", nota: "Todas as peças estão com arquivo final em 04 Aprovados ou canceladas. Registre a entrega no pedido." });

  try {
    fs.gravar([
      { caminho, dados: mudancas, mesclar: true, seAtualizadoEm: doc.atualizadoEm },
      { caminho: `${caminho}/eventos/${Date.parse(agora)}-${d.acao}-${Math.random().toString(36).slice(2, 7)}`,
        dados: { em: p.agora(), uid: u.uid, nome: u.nome, rotulo: rotuloEvento, nota: "", chave: status !== ped.status, acao: d.acao } },
    ]);
  } catch {
    throw new ErroUsuario("O pedido foi atualizado por outra pessoa agora há pouco. Recarregue a página e tente de novo.");
  }
  for (const a of avisos) avisar(p, fs, u, clienteId, ped, a.quem, a.rotulo, a.nota, status);
  return { status, pronto };
}

function usuarios(fs: Firestore) {
  return fs.listar("usuarios").map((x) => ({ uid: x.caminho.split("/")[1], ...(x.dados as Omit<Usuario, "uid">) }));
}

function avisar(p: Plataforma, fs: Firestore, autor: Usuario, clienteId: string, ped: Pedido, quem: Quem[], rotulo: string, nota: string, status: Status) {
  try {
    const cfg = lerConfig(p);
    const dest = usuarios(fs).filter((x) => x.uid !== autor.uid && (x as { status?: string }).status !== "desativado" && (
      (quem.includes("solicitante") && x.uid === ped.solicitanteUid) ||
      (quem.includes("atendimento") && x.papel === "atendimento") ||
      (quem.includes("criativo") && x.papel === "criativo") ||
      (quem.includes("financeiro_propaga") && x.papel === "financeiro_propaga")));
    if (!dest.length) return;
    const msg = emailAtualizacao({ cliente: CLIENTES[clienteId].nomePortal, protocolo: ped.protocolo, titulo: ped.titulo, rotulo, nota,
      autor: autor.nome, etapa: NOME_STATUS[status], link: `${cfg.portalUrl}/aprovacoes/?p=${encodeURIComponent(ped.protocolo)}` });
    for (const x of dest) {
      try { p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); }
      catch (e) { p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
    }
  } catch (e) { p.log(`Avisos de ${ped.protocolo} falharam: ${(e as Error).message}`); }
}

/** Resumo diário (a partir das 8h, uma vez por dia): o que cada pessoa tem pendente e o que está atrasado. */
export function resumoDiario(p: Plataforma, fs: Firestore) {
  const agora = p.agora();
  const hoje = hojeSP(agora);
  const horaSP = (agora.getUTCHours() + 21) % 24; // UTC−3
  const dia = new Date(hoje + "T12:00:00Z").getUTCDay();
  if (horaSP < 8 || dia === 0 || dia === 6) return 0;
  try { fs.gravar([{ caminho: `interno/resumos/dias/${hoje}`, dados: { em: agora }, seNaoExiste: true }]); }
  catch { return 0; } // já enviado hoje
  const cfg = lerConfig(p);
  const pedidos = Object.keys(CLIENTES).flatMap((c) => fs.listar(`clientes/${c}/solicitacoes`).map((x) => ({ c, ...(x.dados as unknown as Pedido) })));
  let enviados = 0;
  for (const u of usuarios(fs)) {
    if ((u as { status?: string }).status === "desativado") continue;
    const linhas: { protocolo: string; titulo: string; peca: string; etapa: string; prazo: string | null; atrasada: boolean }[] = [];
    for (const ped of pedidos) {
      if (!u.propaga && u.clienteId !== ped.c) continue;
      if (u.papel === "solicitante" && ped.solicitanteUid !== u.uid) continue;
      for (const x of ped.pecas ?? []) if (pendentePara(u.papel, x))
        linhas.push({ protocolo: ped.protocolo, titulo: ped.titulo, peca: x.nome, etapa: x.etapa, prazo: prazoEtapa(x), atrasada: atrasada(x, hoje) });
    }
    if (!linhas.length) continue;
    const msg = emailResumo({ nome: u.nome.split(" ")[0], linhas, link: `${cfg.portalUrl}/aprovacoes/` });
    try { p.enviarEmail({ para: u.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); enviados++; }
    catch (e) { p.log(`Resumo para ${u.email} falhou: ${(e as Error).message}`); }
  }
  return enviados;
}

