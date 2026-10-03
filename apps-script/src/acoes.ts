/* Ações sobre um pedido (fila tipo "acao"): valida perfil e etapa (src/lib/fluxo.ts), grava a mudança,
   registra o histórico e avisa por e-mail só quem precisa agir ou acompanhar. */
import { CLIENTES } from "@/content/clientes";
import { catalogo } from "@/content/catalogos";
import { aplicar, MAX_RODADAS, NOME_STATUS, type Acao } from "@/lib/fluxo";
import { calcularValores } from "@/lib/precos";
import { hojeSP } from "@/lib/datas";
import { acaoSchema } from "@/lib/schemas";
import type { ItemSolicitacao, Papel, Status } from "@/lib/tipos";
import { emailAtualizacao } from "./emails";
import type { Firestore } from "./firestore";
import { ErroUsuario, type Plataforma } from "./plataforma";
import { lerConfig } from "./servidor";

interface Usuario { uid: string; nome: string; papel: string; email: string; clienteId: string | null; propaga?: boolean }
interface Pedido {
  protocolo: string; titulo: string; status: Status; solicitanteUid: string; solicitanteNome: string;
  itens: (ItemSolicitacao & { nome: string; sobOrcamento: boolean })[]; rodadas: number; versao: number;
  catalogoVersao: string; prazo: Record<string, unknown>; drive: Record<string, unknown>; recebidoPeloCliente?: boolean;
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

  let novo: Status;
  try {
    novo = aplicar(acao, ped.status, u.papel as Papel, { rodadas: ped.rodadas || 0, recebidoPeloCliente: ped.recebidoPeloCliente });
  } catch (e) { throw new ErroUsuario((e as Error).message); }

  const agora = p.agora();
  const nota = d.nota?.trim() || "";
  const mudancas: Record<string, unknown> = { status: novo, atualizadoEm: agora };
  const extras: { caminho: string; dados: Record<string, unknown>; mesclar?: boolean }[] = [];
  let rotulo = "";
  let notaEvento = nota;
  let avisar: ("solicitante" | "atendimento" | "financeiro_propaga")[] = [];

  switch (acao) {
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
      mudancas.drive = { ...ped.drive, verificado: !!d.driveVerificado };
      mudancas.aceitoPor = { uid: u.uid, nome: u.nome, em: agora };
      rotulo = "Pedido aceito pela Propaga; produção iniciada";
      const qtdOrc = Object.keys(orcados).length;
      notaEvento = [
        `Cronograma: início ${br(d.cronograma.inicio)}, 1ª apresentação ${br(d.cronograma.primeira)}, entrega final ${br(d.cronograma.final)}.`,
        qtdOrc ? `Valor de ${qtdOrc} item(ns) a cotar registrado conforme o contrato.` : "",
        d.driveVerificado ? "Acesso à pasta do Drive conferido." : "Acesso à pasta do Drive ainda não conferido.",
        nota,
      ].filter(Boolean).join(" ");
      avisar = ["solicitante"];
      break;
    }
    case "disponibilizarVersao": {
      const v = (ped.versao || 0) + 1;
      mudancas.versao = v;
      rotulo = `Versão ${v} disponibilizada para aprovação`;
      notaEvento = [nota, d.link ? `Arquivos: ${d.link}` : ""].filter(Boolean).join(" ");
      avisar = ["solicitante"];
      break;
    }
    case "pedirAjustes": {
      if (nota.length < 3) throw new ErroUsuario("Descreva os ajustes necessários.");
      const rod = (ped.rodadas || 0) + 1;
      mudancas.rodadas = rod;
      rotulo = `Ajustes solicitados (rodada ${rod} de ${MAX_RODADAS})`;
      avisar = ["atendimento"];
      break;
    }
    case "aprovar":
      rotulo = `Conteúdo aprovado na versão ${ped.versao || 1}`;
      avisar = ["atendimento"];
      break;
    case "entregar":
      mudancas.prazo = { ...ped.prazo, entrega: hojeSP(agora) };
      rotulo = "Arquivos finais entregues em 04 Aprovados";
      avisar = ["solicitante", "financeiro_propaga"];
      break;
    case "confirmarRecebimento":
      mudancas.recebidoPeloCliente = true;
      rotulo = "Recebimento confirmado pelo solicitante";
      avisar = ["atendimento"];
      break;
    case "faturar":
      rotulo = "Faturamento registrado";
      break;
    case "registrarPagamento":
      rotulo = "Pagamento registrado";
      break;
    case "cancelar":
      if (nota.length < 3) throw new ErroUsuario("Informe o motivo do cancelamento.");
      // Cancelado depois de apresentado: cobra 50% do valor (contrato). O Financeiro da Propaga é avisado.
      if ((ped.versao || 0) > 0) { rotulo = "Pedido cancelado após apresentação · cobrança de 50% do valor"; avisar = ["solicitante", "atendimento", "financeiro_propaga"]; }
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
  return { status: novo };
}

function avisarPessoas(
  p: Plataforma, fs: Firestore, autor: Usuario, clienteId: string, ped: Pedido,
  quem: string[], rotulo: string, nota: string, status: Status,
) {
  try {
    const cfg = lerConfig(p);
    const todos = fs.listar("usuarios").map((x) => ({ uid: x.caminho.split("/")[1], ...(x.dados as Omit<Usuario, "uid">) }));
    const dest = todos.filter((x) => x.uid !== autor.uid && (
      (quem.includes("solicitante") && x.uid === ped.solicitanteUid) ||
      (quem.includes("atendimento") && x.papel === "atendimento") ||
      (quem.includes("financeiro_propaga") && x.papel === "financeiro_propaga")));
    if (!dest.length) return;
    const msg = emailAtualizacao({
      cliente: CLIENTES[clienteId].nomePortal, protocolo: ped.protocolo, titulo: ped.titulo, rotulo, nota,
      autor: autor.nome, etapa: NOME_STATUS[status],
      link: `${cfg.portalUrl}/solicitacoes/pedido/?p=${encodeURIComponent(ped.protocolo)}`,
    });
    for (const x of dest) {
      try { p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); }
      catch (e) { p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
    }
  } catch (e) {
    p.log(`Avisos de ${ped.protocolo} falharam: ${(e as Error).message}`);
  }
}
