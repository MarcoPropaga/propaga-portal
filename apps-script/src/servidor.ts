/* Servidor do Portal Propaga (Google Apps Script, conta da Propaga).
   Únicas responsabilidades com credencial de administrador:
   - configurar o login (TOTP, política de senha) e os dados iniciais;
   - convidar usuários (criar conta, definir perfil, enviar e-mail);
   - processar a /fila de ações enviadas pelo navegador, validando tudo de novo aqui. */
import { CLIENTES, NOMES_PAPEIS } from "@/content/clientes";
import { catalogoVigente } from "@/content/catalogos";
import { calcularValores, catalogoPublico, exigeOrcamento } from "@/lib/precos";
import { hojeSP } from "@/lib/datas";
import { conviteSchema, solicitacaoSchema, PAPEIS_PROPAGA, type ConviteInput, type SolicitacaoInput } from "@/lib/schemas";
import { descreverItem, normalizarItem, validarItens } from "@/lib/solicitacao";
import { emailAtualizacao, emailConvite, emailNovaSolicitacao } from "./emails";
import { avisarPessoas, executarAcao } from "./acoes";
import { executarPeca, resumoDiario } from "./pecas";
import { Firestore, type Doc } from "./firestore";
import { Identidade } from "./identidade";
import { ErroUsuario, type Plataforma } from "./plataforma";

export interface Config { projeto: string; portalUrl: string; remetente: string }

export function lerConfig(p: Plataforma): Config {
  const projeto = p.propriedade("PROJETO_ID") || "propaga-portal";
  const portalUrl = (p.propriedade("PORTAL_URL") || `https://${projeto}.web.app`).replace(/\/$/, "");
  return { projeto, portalUrl, remetente: p.propriedade("REMETENTE_NOME") || "Portal Propaga" };
}

/** Executar uma vez: segurança do login + cadastro dos clientes e catálogos. */
export function configurarProjeto(p: Plataforma) {
  const cfg = lerConfig(p);
  new Identidade(p, cfg.projeto).configurarSeguranca();
  const fs = new Firestore(p, cfg.projeto);
  const agora = p.agora();
  const ops = Object.values(CLIENTES).flatMap((c) => {
    const cat = catalogoVigente(c.id);
    return [
      { caminho: `clientes/${c.id}`, dados: { nome: c.nome, nomePortal: c.nomePortal, unidades: c.unidades, publicos: c.publicos, catalogoVigente: cat.versao, atualizadoEm: agora } },
      { caminho: `clientes/${c.id}/catalogo/${cat.versao}`, dados: { ...catalogoPublico(cat), publicadoEm: agora } as unknown as Record<string, unknown> },
      { caminho: `interno/catalogos/versoes/${c.id}-${cat.versao}`, dados: { ...cat, publicadoEm: agora } as unknown as Record<string, unknown> },
    ];
  });
  fs.gravar(ops);
  p.log(`Projeto ${cfg.projeto} configurado: TOTP, política de senha e ${Object.keys(CLIENTES).length} cliente(s).`);
}

const ehPropaga = (papel: string) => (PAPEIS_PROPAGA as readonly string[]).includes(papel);

/** Cria (ou reaproveita) a conta, define o perfil e envia o convite. */
export function convidar(p: Plataforma, dadosBrutos: unknown, convidadoPor: { uid: string; nome: string }) {
  const r = conviteSchema.safeParse(dadosBrutos);
  if (!r.success) throw new ErroUsuario(r.error.issues[0]?.message || "Dados do convite inválidos.");
  const d: ConviteInput = r.data;
  const propaga = ehPropaga(d.papel);
  const clienteId = propaga ? null : d.clienteId!;
  if (clienteId && !CLIENTES[clienteId]) throw new ErroUsuario("Cliente não encontrado.");

  const cfg = lerConfig(p);
  const id = new Identidade(p, cfg.projeto);
  const existente = id.buscarPorEmail(d.email);
  const uid = existente ? existente.localId : id.criar(d.email, d.nome);
  id.definirClaims(uid, propaga ? { papel: d.papel, propaga: true } : { papel: d.papel, clienteId });

  const oob = id.codigoDefinirSenha(d.email);
  const link = `${cfg.portalUrl}/primeiro-acesso/?oobCode=${encodeURIComponent(oob)}`;
  const nomePortal = clienteId ? CLIENTES[clienteId].nomePortal : "Portal Propaga";
  const msg = emailConvite({ nome: d.nome.split(" ")[0], link, cliente: nomePortal, convidadoPor: convidadoPor.nome });
  p.enviarEmail({ para: d.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente });

  new Firestore(p, cfg.projeto).gravar([{
    caminho: `usuarios/${uid}`, mesclar: true,
    dados: {
      nome: d.nome, email: d.email, papel: d.papel, perfil: NOMES_PAPEIS[d.papel], clienteId, propaga,
      status: "convidado", convidadoEm: p.agora(), convidadoPor: convidadoPor.uid,
    },
  }]);
  return { uid, novo: !existente };
}

/** Primeiro administrador (Marco). Executar uma vez, depois de configurarProjeto. */
export function criarAdministrador(p: Plataforma) {
  const email = p.propriedade("ADMIN_EMAIL");
  const nome = p.propriedade("ADMIN_NOME") || "Administrador";
  if (!email) throw new Error("Defina a propriedade ADMIN_EMAIL nas configurações do script.");
  return convidar(p, { nome, email, papel: "admin" }, { uid: "sistema", nome: "Portal Propaga" });
}

/** Processa pedidos pendentes da fila. Seguro para rodar em paralelo: cada item é "travado" por versão. */
export function processarFila(p: Plataforma, limite = 20) {
  const cfg = lerConfig(p);
  const fs = new Firestore(p, cfg.projeto);
  const pendentes = fs.consultar("fila", "status", "pendente", "criadoEm", limite);
  let ok = 0, erro = 0;
  for (const item of pendentes) {
    try {
      fs.gravar([{ caminho: item.caminho, dados: { status: "processando" }, mesclar: true, seAtualizadoEm: item.atualizadoEm }]);
    } catch { continue; } // outro processo já pegou este item
    try {
      const resultado = executar(p, fs, item);
      fs.gravar([{ caminho: item.caminho, mesclar: true, dados: { status: "ok", resultado, concluidoEm: p.agora() } }]);
      ok++;
    } catch (e) {
      const amigavel = e instanceof ErroUsuario;
      if (!amigavel) p.log(`Erro na fila ${item.caminho}: ${(e as Error).message}`);
      fs.gravar([{ caminho: item.caminho, mesclar: true, dados: {
        status: "erro", concluidoEm: p.agora(),
        mensagem: amigavel ? (e as Error).message : "Não foi possível concluir agora. A Propaga foi avisada.",
      } }]);
      erro++;
    }
  }
  try { resumoDiario(p, fs); } catch (e) { p.log(`Resumo diário falhou: ${(e as Error).message}`); }
  return { ok, erro };
}

function executar(p: Plataforma, fs: Firestore, item: Doc): Record<string, unknown> {
  const { tipo, uid, dados } = item.dados as { tipo: string; uid: string; dados: unknown };
  // O perfil vem do cadastro gravado pelo servidor, nunca do pedido.
  const usuario = fs.ler(`usuarios/${uid}`);
  if (!usuario) throw new ErroUsuario("Usuário sem cadastro no portal.");
  const u = usuario.dados as { nome: string; papel: string; email: string; clienteId: string | null; propaga?: boolean };

  switch (tipo) {
    case "convidar":
    case "reenviarConvite": {
      if (u.papel !== "admin") throw new ErroUsuario("Somente o administrador convida usuários.");
      const r = convidar(p, dados, { uid, nome: u.nome });
      return { uid: r.uid, novo: r.novo };
    }
    case "acessos": {
      if (u.papel !== "admin") throw new ErroUsuario("Somente o administrador consulta os acessos.");
      const cfg = lerConfig(p);
      const ids = fs.listar("usuarios").map((d) => d.caminho.split("/").pop()!);
      return { acessos: new Identidade(p, cfg.projeto).situacaoAcesso(ids) };
    }
    case "enviar":
      return enviarSolicitacao(p, fs, { uid, ...u }, String(item.dados.clienteId ?? ""), dados);
    case "acao":
      return executarAcao(p, fs, { uid, ...u }, String(item.dados.clienteId ?? ""), dados);
    case "peca":
      return executarPeca(p, fs, { uid, ...u }, String(item.dados.clienteId ?? ""), dados);
    default:
      throw new ErroUsuario("Esta ação ainda não está disponível.");
  }
}

/* ---------------- Nova solicitação ---------------- */

/** Nova solicitação avisa: quem enviou (confirmação), o Atendimento e o Admin (decisão de 03/10/2026). */
const DESTINO_AVISO = ["atendimento", "admin"];

/** Valida de novo no servidor, numera o protocolo, grava pedido + valores + eventos e avisa por e-mail. */
export function enviarSolicitacao(
  p: Plataforma, fs: Firestore,
  u: { uid: string; nome: string; papel: string; email: string; clienteId: string | null },
  clienteId: string, dadosBrutos: unknown,
) {
  if (!["solicitante", "atendimento", "admin"].includes(u.papel)) throw new ErroUsuario("Seu perfil não envia solicitações.");
  if (u.papel === "solicitante" && u.clienteId !== clienteId) throw new ErroUsuario("Cliente inválido para o seu acesso.");
  const cliente = CLIENTES[clienteId];
  if (!cliente) throw new ErroUsuario("Cliente não encontrado.");

  const r = solicitacaoSchema.safeParse(dadosBrutos);
  if (!r.success) throw new ErroUsuario(r.error.issues[0]?.message || "Dados da solicitação inválidos.");
  const d = r.data;
  if (!cliente.unidades.includes(d.unidade)) throw new ErroUsuario("Selecione a unidade: matriz, filial ou todas.");
  if (!cliente.publicos.some((x) => x.valor === d.publico)) throw new ErroUsuario("Selecione o público da solicitação.");
  const cat = catalogoVigente(clienteId);
  const errosItens = Object.values(validarItens(cat.servicos, d.itens, cliente));
  if (errosItens.length) throw new ErroUsuario(errosItens[0]);
  if (d.prazo.desejada < hojeSP(p.agora())) throw new ErroUsuario("A data desejada já passou. Escolha outra data.");

  const itens = d.itens.map((it) => {
    const s = cat.servicos.find((x) => x.cod === it.cod)!;
    const n = normalizarItem(s, it);
    return { ...n, nome: s.nome, varianteRotulo: s.variantes[it.variante].rotulo, sobOrcamento: exigeOrcamento(cat, it) };
  });

  if (d.editar) return editarSolicitacao(p, fs, u, clienteId, d, itens, cat);

  // Criada pelo Marcelo: fica em nome da Débora (Solicitante do cliente) e vai para ela aprovar.
  let titular = { uid: u.uid, nome: u.nome };
  const proposta = u.papel === "atendimento";
  if (proposta) {
    const sol = fs.listar("usuarios").map((x) => ({ uid: x.caminho.split("/").pop()!, ...(x.dados as { nome: string; papel: string; clienteId: string | null }) }))
      .find((x) => x.papel === "solicitante" && x.clienteId === clienteId);
    if (!sol) throw new ErroUsuario("Não há Solicitante cadastrada para este cliente.");
    titular = { uid: sol.uid, nome: sol.nome };
  }

  const cfg = lerConfig(p);
  const agora = p.agora();
  const ano = hojeSP(agora).slice(0, 4);
  const caminhoContador = `interno/contadores/protocolos/${clienteId}-${ano}`;

  let protocolo = "";
  for (let tentativa = 0; ; tentativa++) {
    const cont = fs.ler(caminhoContador);
    const n = Number(cont?.dados.n ?? 0) + 1;
    protocolo = `${cliente.prefixo}-${ano}-${String(n).padStart(4, "0")}`;
    const base = `clientes/${clienteId}`;
    const ev = (sufixo: string, dados: Record<string, unknown>) => ({ caminho: `${base}/solicitacoes/${protocolo}/eventos/${agora.getTime()}-${sufixo}`, dados });
    try {
      fs.gravar([
        { caminho: caminhoContador, dados: { n, atualizadoEm: agora }, ...(cont ? { seAtualizadoEm: cont.atualizadoEm } : { seNaoExiste: true }) },
        {
          caminho: `${base}/solicitacoes/${protocolo}`, seNaoExiste: true,
          dados: {
            protocolo, clienteId, titulo: d.titulo, solicitanteUid: titular.uid, solicitanteNome: titular.nome,
            ...(proposta ? { criadoPor: { uid: u.uid, nome: u.nome } } : {}),
            unidade: d.unidade, email: d.email, objetivo: d.objetivo, publico: d.publico, itens,
            drive: { link: d.drive.link, conferido: true, verificado: false }, obs: d.obs,
            prazo: { desejada: d.prazo.desejada, urgente: d.prazo.urgente },
            status: proposta ? "proposta" : "enviada", rodadas: 0, versao: 0, catalogoVersao: cat.versao,
            criadoEm: agora, atualizadoEm: agora,
          },
        },
        { caminho: `${base}/valores/${protocolo}`, dados: { ...calcularValores(protocolo, cat, d.itens), clienteId, criadoEm: agora } as unknown as Record<string, unknown> },
        proposta
          ? ev("proposta", { em: agora, uid: u.uid, nome: u.nome, rotulo: `Solicitação criada por ${u.nome} em nome de ${titular.nome}; aguardando aprovação`, chave: true, nota: "Conferido pelo remetente: briefing, arquivos e permissões." })
          : ev("enviada", { em: agora, uid: u.uid, nome: u.nome, rotulo: "Solicitação enviada", chave: true, nota: "Conferido pelo remetente: briefing, arquivos e permissões." }),
      ]);
      break;
    } catch (e) {
      if (tentativa >= 2) throw e; // contador disputado: tenta de novo com o número seguinte
    }
  }

  // Proposta do Marcelo: só a Débora é avisada (para aprovar) e o Marcelo recebe o recibo.
  if (proposta) {
    const ped = { protocolo, titulo: d.titulo, solicitanteUid: titular.uid } as Parameters<typeof avisarPessoas>[4];
    avisarPessoas(p, fs, { ...u, propaga: true }, clienteId, ped, ["solicitante"], "Nova solicitação para sua aprovação",
      `${u.nome} criou esta solicitação em seu nome. Confira e escolha: aprovar, pedir ajuste ou recusar.`, "proposta", "/aprovacoes/");
    return { protocolo, proposta: true };
  }

  // Avisos por e-mail (falha de e-mail não desfaz o pedido; fica registrada no histórico).
  try {
    const destinatarios = fs.listar("usuarios").map((x) => ({ uid: x.caminho.split("/")[1], ...(x.dados as { nome: string; email: string; papel: string; propaga?: boolean }) }))
      .filter((x) => x.uid !== u.uid && x.propaga && DESTINO_AVISO.includes(x.papel));
    const autor = fs.ler(`usuarios/${u.uid}`)?.dados as { email?: string } | undefined;
    const msg = emailNovaSolicitacao({
      cliente: cliente.nomePortal, protocolo, titulo: d.titulo, solicitante: u.nome, unidade: d.unidade, publico: d.publico,
      objetivo: d.objetivo, desejada: d.prazo.desejada, urgente: d.prazo.urgente,
      itens: itens.map((i) => ({ qtd: i.qtd, nome: i.nome, detalhe: descreverItem(cat.servicos.find((s) => s.cod === i.cod)!, i), sobOrcamento: i.sobOrcamento })),
      link: `${cfg.portalUrl}/solicitacoes/pedido/?p=${encodeURIComponent(protocolo)}`,
    });
    const avisados: string[] = [], falhas: string[] = [];
    for (const x of destinatarios) {
      try { p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); avisados.push(x.nome); }
      catch (e) { falhas.push(x.nome); p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
    }
    // Recibo curto para quem enviou (não repete o e-mail completo do Atendimento).
    if (autor?.email) {
      const r = emailAtualizacao({ cliente: cliente.nomePortal, protocolo, titulo: d.titulo, rotulo: "Recebemos sua solicitação",
        nota: "O atendimento da Propaga vai conferir o briefing e confirmar o cronograma. Você recebe um aviso quando houver peças para aprovar.",
        autor: u.nome, etapa: "Enviada", link: `${cfg.portalUrl}/solicitacoes/pedido/?p=${encodeURIComponent(protocolo)}` });
      try { p.enviarEmail({ para: autor.email, assunto: r.assunto, html: r.html, texto: r.texto, nomeRemetente: cfg.remetente }); } catch (e) { p.log(`Recibo falhou: ${(e as Error).message}`); }
    }
    const quando = p.agora();
    fs.gravar([{
      caminho: `clientes/${clienteId}/solicitacoes/${protocolo}/eventos/${quando.getTime()}-aviso`,
      dados: {
        em: quando, uid: "sistema", nome: "Sistema", chave: false,
        rotulo: avisados.length ? `Aviso por e-mail enviado a ${avisados.join(", ")}` : "Nenhum destinatário de aviso cadastrado",
        nota: falhas.length ? `Falha no envio para ${falhas.join(", ")}.` : "",
      },
    }]);
  } catch (e) {
    p.log(`Avisos da ${protocolo} falharam: ${(e as Error).message}`); // o pedido já está gravado
  }
  return { protocolo };
}

/* ---------------- Edição pelo Marcelo ---------------- */

/** O Marcelo ajusta a solicitação antes do aceite (status enviada) ou depois do pedido de ajuste da Débora (ajuste).
    A alteração fica no histórico e a Débora é avisada; no caso do ajuste, volta para ela aprovar. */
function editarSolicitacao(
  p: Plataforma, fs: Firestore,
  u: { uid: string; nome: string; papel: string; email: string; clienteId: string | null },
  clienteId: string, d: SolicitacaoInput, itens: Record<string, unknown>[], cat: ReturnType<typeof catalogoVigente>,
) {
  if (!["atendimento", "admin"].includes(u.papel)) throw new ErroUsuario("Só o atendimento da Propaga edita a solicitação.");
  const caminho = `clientes/${clienteId}/solicitacoes/${d.editar}`;
  const doc = fs.ler(caminho);
  if (!doc) throw new ErroUsuario("Pedido não encontrado.");
  const ant = doc.dados as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!["enviada", "ajuste"].includes(ant.status)) throw new ErroUsuario("A solicitação só pode ser editada antes do aceite.");

  const lista = (xs: { qtd: number; nome: string; varianteRotulo?: string }[]) => xs.map((i) => `${i.qtd}× ${i.nome}${i.varianteRotulo ? ` (${i.varianteRotulo})` : ""}`).join("; ");
  const mud: string[] = [];
  const cmp = (rot: string, a: unknown, b: unknown) => { if (String(a ?? "") !== String(b ?? "")) mud.push(`${rot}: "${a ?? ""}" → "${b ?? ""}"`); };
  cmp("Título", ant.titulo, d.titulo); cmp("Unidade", ant.unidade, d.unidade); cmp("Objetivo", ant.objetivo, d.objetivo);
  cmp("Público", ant.publico, d.publico); cmp("Data desejada", ant.prazo?.desejada, d.prazo.desejada);
  cmp("Urgente", ant.prazo?.urgente ? "sim" : "não", d.prazo.urgente ? "sim" : "não"); cmp("Pasta do Drive", ant.drive?.link, d.drive.link);
  if (String(ant.obs ?? "") !== d.obs) mud.push("Observações atualizadas");
  const li = lista(ant.itens ?? []), ln = lista(itens as never);
  if (li !== ln) mud.push(`Serviços: ${li} → ${ln}`);
  if (!mud.length && ant.status === "enviada") throw new ErroUsuario("Nada foi alterado.");

  const agora = p.agora();
  const reenvio = ant.status === "ajuste";
  const novo = reenvio ? "proposta" : "enviada";
  const rotulo = reenvio ? `Solicitação ajustada por ${u.nome} e reenviada para aprovação` : `Solicitação editada por ${u.nome}`;
  const nota = mud.length ? mud.join(" · ") : "Sem alterações; reenviada para aprovação.";
  try {
    fs.gravar([
      { caminho, mesclar: true, seAtualizadoEm: doc.atualizadoEm, dados: {
        titulo: d.titulo, unidade: d.unidade, email: d.email, objetivo: d.objetivo, publico: d.publico, itens,
        drive: { ...(ant.drive ?? {}), link: d.drive.link, conferido: true }, obs: d.obs,
        prazo: { ...(ant.prazo ?? {}), desejada: d.prazo.desejada, urgente: d.prazo.urgente },
        status: novo, catalogoVersao: cat.versao, atualizadoEm: agora,
        editadoPor: { uid: u.uid, nome: u.nome, em: agora },
      } },
      { caminho: `clientes/${clienteId}/valores/${d.editar}`, dados: { ...calcularValores(d.editar!, cat, d.itens), clienteId, criadoEm: agora } as unknown as Record<string, unknown> },
      { caminho: `${caminho}/eventos/${agora.getTime()}-edicao`, dados: { em: agora, uid: u.uid, nome: u.nome, rotulo, nota, chave: reenvio, acao: "editar" } },
    ]);
  } catch {
    throw new ErroUsuario("O pedido foi atualizado por outra pessoa agora há pouco. Recarregue a página e tente de novo.");
  }
  const ped = { protocolo: d.editar!, titulo: d.titulo, solicitanteUid: ant.solicitanteUid } as Parameters<typeof avisarPessoas>[4];
  avisarPessoas(p, fs, { ...u, propaga: true }, clienteId, ped, ["solicitante"],
    reenvio ? "Solicitação ajustada para sua aprovação" : "O Marcelo ajustou sua solicitação", nota, novo as never,
    reenvio ? "/aprovacoes/" : "/solicitacoes/pedido/");
  return { protocolo: d.editar, editado: true, status: novo };
}
