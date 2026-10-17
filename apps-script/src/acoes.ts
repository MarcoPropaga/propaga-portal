/* Ações sobre um pedido (fila tipo "acao"): valida perfil e etapa (src/lib/fluxo.ts), grava a mudança,
   registra o histórico e avisa por e-mail só quem precisa agir ou acompanhar. */
import { CLIENTES } from "@/content/clientes";
import { catalogo } from "@/content/catalogos";
import { aplicar, NOME_STATUS, type Acao } from "@/lib/fluxo";
import { calcularValores } from "@/lib/precos";
import { hojeSP } from "@/lib/datas";
import { acaoSchema } from "@/lib/schemas";
import type { ItemSolicitacao, Papel, Status } from "@/lib/tipos";
import { emailAtualizacao } from "./emails";
import type { Firestore } from "./firestore";
import { ErroUsuario, type Plataforma } from "./plataforma";
import { lerConfig } from "./servidor";
import { cancelaCobravel } from "@/lib/pecas";

interface Usuario { uid: string; nome: string; papel: string; email: string; clienteId: string | null; propaga?: boolean }
interface Pedido {
  protocolo: string; titulo: string; status: Status; solicitanteUid: string; solicitanteNome: string;
  itens: (ItemSolicitacao & { nome: string; sobOrcamento: boolean })[]; rodadas: number; versao: number;
  catalogoVersao: string; prazo: Record<string, unknown>; drive: Record<string, unknown>;
  temPecas?: boolean; pecas?: { etapa: string }[]; criativo?: { uid: string; nome: string } | null;
}

/** Criativos ativos (Mariane e outros), para o aceite e a troca. */
function criativos(fs: Firestore) {
  return fs.listar("usuarios").map((x) => ({ uid: x.caminho.split("/").pop()!, ...(x.dados as { nome: string; papel: string; status?: string }) }))
    .filter((x) => x.papel === "criativo" && x.status !== "desativado");
}
function escolherCriativo(fs: Firestore, uid?: string) {
  const lista = criativos(fs);
  if (uid) { const c = lista.find((x) => x.uid === uid); if (!c) throw new ErroUsuario("Criativo não encontrado."); return { uid: c.uid, nome: c.nome }; }
  if (lista.length === 1) return { uid: lista[0].uid, nome: lista[0].nome };
  if (!lista.length) return null;
  throw new ErroUsuario("Escolha o criativo que vai criar as peças.");
}

const br = (iso: string) => iso.split("-").reverse().join("/");

export function executarAcao(p: Plataforma, fs: Firestore, u: Usuario, clienteId: string, bruto: unknown) {
  const r = acaoSchema.safeParse(bruto);
  if (!r.success) throw new ErroUsuario(r.error.issues[0]?.message || "Dados da ação inválidos.");
  const d = r.data;
  const acao = d.acao as Acao;
  const cliente = CLIENTES[clienteId];
  if (!cliente) throw new ErroUsuario("Cliente não encontrado.");
  if (!u.propaga && u.clienteId !== clienteId) throw new ErroUsuario("Cliente inválido para o seu acesso.");

  const caminho = `clientes/${clienteId}/solicitacoes/${d.protocolo}`;
  const doc = fs.ler(caminho);
  if (!doc) throw new ErroUsuario("Pedido não encontrado.");
  const ped = doc.dados as unknown as Pedido;
  if (u.papel === "solicitante" && ped.solicitanteUid !== u.uid) throw new ErroUsuario("Este pedido não é seu.");

  // Aprovação, refação e cancelamento de peças ficam em Minhas tarefas (fila "peca").
  if (acao === "entregar" && (!ped.temPecas || (ped.pecas ?? []).some((x) => x.etapa !== "concluida" && x.etapa !== "encerrada")))
    throw new ErroUsuario("Ainda há peças em andamento. Registre a entrega quando todas estiverem com arquivo final ou canceladas.");

  let novo: Status;
  try {
    novo = aplicar(acao, ped.status, u.papel as Papel, { cobravel: cancelaCobravel(ped as never) });
  } catch (e) { throw new ErroUsuario((e as Error).message); }

  const agora = p.agora();
  const nota = d.nota?.trim() || "";
  const mudancas: Record<string, unknown> = { status: novo, atualizadoEm: agora };
  const extras: { caminho: string; dados: Record<string, unknown>; mesclar?: boolean }[] = [];
  let rotulo = "";
  let notaEvento = nota;
  let avisar: ("solicitante" | "atendimento" | "financeiro_propaga" | "criativo")[] = [];
  let criativoJob = false;

  switch (acao) {
    case "aprovarProposta":
      rotulo = `Solicitação aprovada por ${u.nome}; enviada ao atendimento`;
      avisar = ["atendimento"];
      break;
    case "ajustarProposta":
      if (nota.length < 3) throw new ErroUsuario("Escreva o que precisa ser ajustado.");
      rotulo = `${u.nome} pediu ajuste na solicitação`;
      avisar = ["atendimento"];
      break;
    case "recusarProposta":
      if (nota.length < 3) throw new ErroUsuario("Informe o motivo da recusa.");
      rotulo = `Solicitação recusada por ${u.nome} · sem cobrança`;
      avisar = ["atendimento"];
      break;
    case "devolverDuvida":
      if (nota.length < 3) throw new ErroUsuario("Escreva a dúvida ou a sugestão para a Débora.");
      rotulo = `${u.nome} devolveu a solicitação à Débora com dúvida ou sugestão`;
      avisar = ["solicitante"];
      break;
    case "aceitarPedido": {
      if (!d.cronograma) throw new ErroUsuario("Informe o cronograma: início, 1ª apresentação e entrega final.");
      if (d.cronograma.inicio < hojeSP(agora)) throw new ErroUsuario("A data de início não pode estar no passado.");
      const orcados: Record<number, number> = {};
      for (const v of d.valores || []) orcados[v.indice] = v.valor;
      const faltando = ped.itens.map((it, i) => (it.sobOrcamento && orcados[i] == null ? i + 1 : 0)).filter(Boolean);
      if (faltando.length) throw new ErroUsuario(`Informe o valor do item ${faltando.join(", ")} (a cotar).`);
      const cat = catalogo(clienteId, ped.catalogoVersao);
      const val = calcularValores(d.protocolo, cat, ped.itens, orcados);
      extras.push({ caminho: `clientes/${clienteId}/valores/${d.protocolo}`, mesclar: true,
        dados: { ...val, atualizadoEm: agora } as unknown as Record<string, unknown> });
      mudancas.prazo = { ...ped.prazo, ...d.cronograma };
      if (!d.pastaPropaga) throw new ErroUsuario("Cole o link da pasta do pedido no Drive compartilhado da Propaga.");
      mudancas.drive = { ...ped.drive, verificado: !!d.driveVerificado, propaga: d.pastaPropaga };
      const cri = escolherCriativo(fs, d.criativoUid);
      if (cri) mudancas.criativo = cri;
      mudancas.aceitoPor = { uid: u.uid, nome: u.nome, em: agora };
      rotulo = "Pedido aceito pela Propaga; produção iniciada";
      const qtdOrc = Object.keys(orcados).length;
      notaEvento = [
        `Cronograma: início ${br(d.cronograma.inicio)}, 1ª apresentação ${br(d.cronograma.primeira)}, entrega final ${br(d.cronograma.final)}.`,
        qtdOrc ? `Valor de ${qtdOrc} item(ns) a cotar registrado conforme o contrato.` : "",
        d.driveVerificado ? "Acesso à pasta do Drive conferido." : "Acesso à pasta do Drive ainda não conferido.",
        cri ? `Criativo: ${cri.nome}.` : "",
        nota,
      ].filter(Boolean).join(" ");
      avisar = ["solicitante"];
      criativoJob = true; // a Mariane recebe o job para criar as peças
      break;
    }
    case "trocarCriativo": {
      const cri = escolherCriativo(fs, d.criativoUid);
      if (!cri) throw new ErroUsuario("Não há criativo cadastrado.");
      if (ped.criativo?.uid === cri.uid) throw new ErroUsuario(`${cri.nome} já é o criativo deste pedido.`);
      novo = ped.status; mudancas.status = ped.status;
      mudancas.criativo = cri;
      rotulo = `Criativo do pedido: ${ped.criativo?.nome ?? "—"} → ${cri.nome}`;
      criativoJob = true;
      break;
    }
    case "entregar":
      mudancas.prazo = { ...ped.prazo, entrega: hojeSP(agora) };
      rotulo = "Encaminhado para veiculação/impressão · realizado";
      avisar = ["solicitante", "financeiro_propaga"];
      break;
    case "faturar":
      if (ped.status === "cancelada") { mudancas.canceladoCobrado = true; rotulo = "Faturamento registrado · pedido cancelado, cobrança de 50%"; }
      else rotulo = "Faturamento registrado";
      break;
    case "registrarPagamento":
      rotulo = "Pagamento registrado";
      break;
    case "cancelar":
      if (nota.length < 3) throw new ErroUsuario("Informe o motivo do cancelamento.");
      // Cancelado depois de apresentado: cobra 50% do valor (contrato). O Financeiro da Propaga é avisado.
      if ((ped.versao || 0) > 0) { rotulo = "Pedido cancelado após apresentação · cobrança de 50% do valor"; avisar = ["solicitante", "atendimento"]; }
      else { rotulo = "Pedido cancelado"; avisar = ["solicitante", "atendimento"]; }
      break;
  }

  // Grava tudo de uma vez; a pré-condição impede duas ações simultâneas sobre o mesmo pedido.
  try {
    fs.gravar([
      { caminho, dados: mudancas, mesclar: true, seAtualizadoEm: doc.atualizadoEm },
      ...extras,
      { caminho: `${caminho}/eventos/${agora.getTime()}-${acao}-${Math.random().toString(36).slice(2, 7)}`, dados: { em: agora, uid: u.uid, nome: u.nome, rotulo, nota: notaEvento, chave: novo !== ped.status, acao } },
    ]);
  } catch {
    throw new ErroUsuario("O pedido foi atualizado por outra pessoa agora há pouco. Recarregue a página e tente de novo.");
  }

  if (avisar.length) avisarPessoas(p, fs, u, clienteId, ped, avisar, rotulo, notaEvento, novo);
  const pedAtual = { ...ped, ...(mudancas as Partial<Pedido>) };
  if (criativoJob) avisarPessoas(p, fs, u, clienteId, pedAtual, ["criativo"], acao === "trocarCriativo" ? "Pedido passado para você" : "Novo job para criar as peças", notaEvento, novo, "/aprovacoes/");
  return { status: novo };
}

export function avisarPessoas(
  p: Plataforma, fs: Firestore, autor: Usuario, clienteId: string, ped: Pedido,
  quem: string[], rotulo: string, nota: string, status: Status, rota = "/solicitacoes/pedido/",
) {
  try {
    const cfg = lerConfig(p);
    const todos = fs.listar("usuarios").map((x) => ({ uid: x.caminho.split("/")[1], ...(x.dados as Omit<Usuario, "uid">) }));
    const dest = todos.filter((x) => x.uid !== autor.uid && (
      (quem.includes("solicitante") && x.uid === ped.solicitanteUid) ||
      (quem.includes("atendimento") && x.papel === "atendimento") ||
      (quem.includes("financeiro_propaga") && x.papel === "financeiro_propaga") ||
      (quem.includes("criativo") && x.papel === "criativo" && (!ped.criativo || ped.criativo.uid === x.uid))));
    if (!dest.length) return;
    const msg = emailAtualizacao({
      cliente: CLIENTES[clienteId].nomePortal, protocolo: ped.protocolo, titulo: ped.titulo, rotulo, nota,
      autor: autor.nome, etapa: NOME_STATUS[status],
      link: `${cfg.portalUrl}${rota}?p=${encodeURIComponent(ped.protocolo)}`,
    });
    for (const x of dest) {
      try { p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); }
      catch (e) { p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
    }
  } catch (e) {
    p.log(`Avisos de ${ped.protocolo} falharam: ${(e as Error).message}`);
  }
}
