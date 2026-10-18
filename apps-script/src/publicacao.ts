/* Publicação nas redes sociais (fila tipo "publicacao"). Ver o fluxo em src/lib/publicacao.ts.
   Grava a trilha em `peca.pub`, no próprio documento do pedido, com pré-condição de versão.
   Todas as peças de uma chamada são gravadas juntas (tudo ou nada). O portal NÃO publica nem fala com o mLabs. */
import { CLIENTES } from "@/content/clientes";
import { hojeSP } from "@/lib/datas";
import type { Peca } from "@/lib/pecas";
import { ultima } from "@/lib/pecas";
import { erroEntrada, type EtapaPub, type Publicacao } from "@/lib/publicacao";
import { pubAcaoSchema } from "@/lib/schemas";
import type { Firestore } from "./firestore";
import { avisar, type Pedido, type Quem, type Usuario } from "./pecas";
import { ErroUsuario, type Plataforma } from "./plataforma";

const PODE: Record<string, string[]> = {
  encaminhar: ["atendimento", "admin"],
  receber: ["midia_social", "admin"],
  devolverArte: ["midia_social", "admin"],
  enviarCalendario: ["midia_social", "admin"],
  enviarADebora: ["atendimento", "admin"],
  devolverCalendario: ["atendimento", "admin"],
  avaliarCalendario: ["solicitante", "admin"],
  preparar: ["midia_social", "admin"],
  agendar: ["midia_social", "admin"],
  publicar: ["midia_social", "admin"],
};
const ROTULO: Record<string, string> = {
  encaminhar: "Arte encaminhada para publicação", receber: "Recebimento confirmado", devolverArte: "Arte devolvida ao Marcelo",
  enviarCalendario: "Calendário enviado para análise", enviarADebora: "Calendário enviado à Débora", devolverCalendario: "Calendário devolvido ao Kauan",
  avaliarCalendario: "Calendário avaliado pela Débora", preparar: "Preparação no mLabs iniciada", agendar: "Agendada no mLabs", publicar: "Publicada",
};

interface Ref { protocolo: string; id: string }

export function executarPublicacao(p: Plataforma, fs: Firestore, u: Usuario, clienteId: string, bruto: unknown) {
  const r = pubAcaoSchema.safeParse(bruto);
  if (!r.success) throw new ErroUsuario(r.error.issues[0]?.message || "Dados inválidos.");
  const d = r.data;
  const cli = CLIENTES[clienteId];
  if (!cli) throw new ErroUsuario("Cliente não encontrado.");
  if (!u.propaga && u.clienteId !== clienteId) throw new ErroUsuario("Cliente inválido para o seu acesso.");
  if (!PODE[d.acao].includes(u.papel)) throw new ErroUsuario("Esta ação não está disponível para o seu perfil.");

  const agora = p.agora().toISOString();
  const hoje = hojeSP(p.agora());
  const pedidos = new Map<string, { caminho: string; atualizadoEm: string; ped: Pedido; pecas: Peca[]; nomes: string[] }>();
  const carregar = (protocolo: string) => {
    let x = pedidos.get(protocolo);
    if (x) return x;
    const caminho = `clientes/${clienteId}/solicitacoes/${protocolo}`;
    const doc = fs.ler(caminho);
    if (!doc) throw new ErroUsuario("Pedido não encontrado.");
    const ped = doc.dados as unknown as Pedido;
    if (u.papel === "solicitante" && ped.solicitanteUid !== u.uid) throw new ErroUsuario("Este pedido não é seu.");
    x = { caminho, atualizadoEm: doc.atualizadoEm, ped, pecas: JSON.parse(JSON.stringify(ped.pecas ?? [])), nomes: [] };
    pedidos.set(protocolo, x);
    return x;
  };
  const achar = (ref: Ref) => {
    const pd = carregar(ref.protocolo);
    const x = pd.pecas.find((q) => q.id === ref.id);
    if (!x) throw new ErroUsuario("Peça não encontrada.");
    return { pd, x };
  };
  const exigir = (x: Peca, etapas: EtapaPub[], msg: string) => {
    if (!x.pub || !etapas.includes(x.pub.etapa)) throw new ErroUsuario(`"${x.nome}": ${msg}`);
    return x.pub;
  };
  const mover = (x: Peca, pb: Publicacao, etapa: EtapaPub, txt: string) => { pb.etapa = etapa; pb.desde = agora; pb.hist.push({ em: agora, por: u.nome, txt }); x.pub = pb; };
  const avisos = new Map<string, { quem: Quem[]; rotulo: string; nota: string[]; pedidos: Set<string> }>();
  const avisa = (quem: Quem[], rotulo: string, pecaNome: string, protocolo: string) => {
    const k = quem.join(",") + rotulo; const a = avisos.get(k) ?? { quem, rotulo, nota: [], pedidos: new Set<string>() };
    a.nota.push(`- ${pecaNome} (${protocolo})`); a.pedidos.add(protocolo); avisos.set(k, a);
  };
  const aqui = (pd: { nomes: string[] }, x: Peca) => pd.nomes.push(x.nome);

  switch (d.acao) {
    case "encaminhar": {
      for (const id of d.ids) {
        const { pd, x } = achar({ protocolo: d.protocolo, id });
        if (pd.ped.status === "cancelada") throw new ErroUsuario("Este pedido está cancelado.");
        if (x.etapa !== "concluida") throw new ErroUsuario(`"${x.nome}" ainda não tem arquivo final aprovado.`);
        if (x.pub && x.pub.etapa !== "devolvida") throw new ErroUsuario(`"${x.nome}" já foi encaminhada para publicação.`);
        const v = ultima(x);
        const pb: Publicacao = { etapa: "receber", desde: agora, versao: v.v, link: v.link, entrada: x.pub?.entrada ?? null, ajuste: null, hist: x.pub?.hist ?? [] };
        mover(x, pb, "receber", `Arte v${v.v} aprovada encaminhada ao Kauan para publicação`);
        aqui(pd, x); avisa(["midia_social"], "Arte aprovada para publicar", x.nome, d.protocolo);
      }
      break;
    }
    case "receber": {
      for (const ref of d.itens) {
        const { pd, x } = achar(ref); const pb = exigir(x, ["receber"], "esta peça não está aguardando recebimento.");
        mover(x, pb, "recebida", "Recebimento confirmado"); aqui(pd, x);
      }
      break;
    }
    case "devolverArte": {
      const { pd, x } = achar(d); const pb = exigir(x, ["receber", "recebida"], "esta peça não pode ser devolvida agora.");
      pb.ajuste = { de: "kauan", motivo: d.motivo, por: u.nome, em: agora };
      mover(x, pb, "devolvida", `Arte devolvida ao Marcelo: ${d.motivo}`); aqui(pd, x);
      avisa(["atendimento"], `Arte devolvida pelo Kauan · ${d.motivo}`, x.nome, d.protocolo);
      break;
    }
    case "enviarCalendario": {
      for (const it of d.itens) {
        const { pd, x } = achar(it); const pb = exigir(x, ["recebida", "ajuste"], "esta peça não está aguardando calendário.");
        const e = { canais: it.canais, data: it.data, hora: it.hora, legenda: it.legenda.trim(), urgente: it.urgente?.trim() || undefined };
        const erro = erroEntrada(e, hoje, cli.canaisSociais);
        if (erro) throw new ErroUsuario(`"${x.nome}": ${erro}`);
        pb.entrada = e; pb.ajuste = null;
        mover(x, pb, "analise", `Calendário enviado: ${e.canais.join(", ")} · ${e.data.split("-").reverse().join("/")} ${e.hora}${e.urgente ? ` · urgente: ${e.urgente}` : ""}`);
        aqui(pd, x); avisa(["atendimento"], "Calendário de publicações para analisar", x.nome, it.protocolo);
      }
      break;
    }
    case "enviarADebora": {
      for (const ref of d.itens) {
        const { pd, x } = achar(ref); const pb = exigir(x, ["analise"], "esta peça não está em análise.");
        mover(x, pb, "debora", "Calendário analisado pelo Marcelo e enviado à Débora"); aqui(pd, x);
        avisa(["solicitante"], "Calendário de publicações para sua aprovação", x.nome, ref.protocolo);
      }
      break;
    }
    case "devolverCalendario": {
      for (const ref of d.itens) {
        const { pd, x } = achar(ref); const pb = exigir(x, ["analise"], "esta peça não está em análise.");
        pb.ajuste = { de: "marcelo", motivo: d.motivo, por: u.nome, em: agora };
        mover(x, pb, "ajuste", `Calendário devolvido ao Kauan: ${d.motivo}`); aqui(pd, x);
        avisa(["midia_social"], `Calendário devolvido para ajuste · ${d.motivo}`, x.nome, ref.protocolo);
      }
      break;
    }
    case "avaliarCalendario": {
      for (const dec of d.decisoes) {
        const { pd, x } = achar(dec); const pb = exigir(x, ["debora"], "esta peça não está aguardando a Débora.");
        if (dec.tipo === "aprovada") {
          mover(x, pb, "aprovada", "Aprovada para publicação pela Débora"); pb.ajuste = null;
          avisa(["atendimento", "midia_social"], "Calendário aprovado pela Débora", x.nome, dec.protocolo);
        } else {
          if ((dec.nota?.length ?? 0) < 3) throw new ErroUsuario(`"${x.nome}": escreva o ajuste pedido.`);
          pb.ajuste = { de: "debora", motivo: dec.nota!, por: u.nome, em: agora };
          mover(x, pb, "analise", `Ajuste pedido pela Débora: ${dec.nota}`);
          avisa(["atendimento"], `Ajuste pedido pela Débora · ${dec.nota}`, x.nome, dec.protocolo);
        }
        aqui(pd, x);
      }
      break;
    }
    case "preparar": {
      for (const ref of d.itens) {
        const { pd, x } = achar(ref); const pb = exigir(x, ["aprovada"], "só peça aprovada pela Débora pode ser preparada.");
        mover(x, pb, "preparo", "Preparação no mLabs iniciada"); aqui(pd, x);
      }
      break;
    }
    case "agendar": {
      for (const ref of d.itens) {
        const { pd, x } = achar(ref); const pb = exigir(x, ["aprovada", "preparo"], "só peça aprovada pela Débora pode ser agendada.");
        pb.agendadaEm = agora;
        mover(x, pb, "agendada", `Agendada no mLabs: ${pb.entrada?.canais.join(", ")} · ${pb.entrada?.data.split("-").reverse().join("/")} ${pb.entrada?.hora}`); aqui(pd, x);
      }
      break;
    }
    case "publicar": {
      for (const it of d.itens) {
        const { pd, x } = achar(it); const pb = exigir(x, ["agendada"], "só peça agendada pode ser registrada como publicada.");
        if (it.data > hoje) throw new ErroUsuario(`"${x.nome}": a data de publicação não pode ser futura.`);
        if (!it.link && (it.semLink?.length ?? 0) < 3) throw new ErroUsuario(`"${x.nome}": cole o link da publicação ou explique por que não há link.`);
        if (it.link && !/^https:\/\//.test(it.link)) throw new ErroUsuario(`"${x.nome}": o link deve começar com https://.`);
        pb.publicada = { data: it.data, link: it.link || undefined, semLink: it.link ? undefined : it.semLink, em: agora, por: u.nome };
        mover(x, pb, "publicada", `Publicada em ${it.data.split("-").reverse().join("/")}${it.link ? ` · ${it.link}` : ` · sem link: ${it.semLink}`}`); aqui(pd, x);
      }
      break;
    }
  }

  const gravar = [...pedidos.values()].flatMap((pd) => [
    { caminho: pd.caminho, dados: { pecas: pd.pecas, atualizadoEm: p.agora() }, mesclar: true, seAtualizadoEm: pd.atualizadoEm },
    { caminho: `${pd.caminho}/eventos/${Date.parse(agora)}-pub-${d.acao}-${Math.random().toString(36).slice(2, 7)}`,
      dados: { em: p.agora(), uid: u.uid, nome: u.nome, rotulo: `${ROTULO[d.acao]}: ${pd.nomes.join(", ")}`, nota: "", chave: false, acao: `pub-${d.acao}` } },
  ]);
  try { fs.gravar(gravar); }
  catch { throw new ErroUsuario("Um pedido foi atualizado por outra pessoa agora há pouco. Recarregue a página e tente de novo."); }

  for (const a of avisos.values()) for (const prot of a.pedidos) {
    const pd = pedidos.get(prot)!;
    // aviso por pedido, listando só as peças dele
    const nota = a.nota.filter((l) => l.endsWith(`(${prot})`)).join("\n");
    avisar(p, fs, u, clienteId, pd.ped, a.quem, a.rotulo, nota, pd.ped.status);
  }
  return { ok: true, pecas: [...pedidos.values()].reduce((n, x) => n + x.nomes.length, 0) };
}
