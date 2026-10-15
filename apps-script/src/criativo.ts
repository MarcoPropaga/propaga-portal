/* Relatório mensal da Mariane (Criativo Propaga) e pagamento pela Marisa (Financeiro Propaga).
   A tabela vem do código do servidor (fonte da verdade); o navegador só sugere. Tudo é recalculado aqui. */
import { catalogoVigente } from "@/content/catalogos";
import { montarTabelaMariane } from "@/content/criativo/tabela-mariane";
import { aplicarAjustes, chaveServico, foraDaTabela, idRelatorio, mesclarAdicionais, nomeMes, NOME_COLUNA, pecasDoMes, totalLinhas, type AdicionaisCriativo, type Ajuste, type Coluna, type PropostaItem } from "@/lib/criativo";
import { hojeSP } from "@/lib/datas";
import { emailAviso } from "./emails";
import type { Firestore } from "./firestore";
import { ErroUsuario, type Plataforma } from "./plataforma";
import { lerConfig } from "./servidor";

interface Usuario { uid: string; nome: string; papel: string; email: string }
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ADICIONAIS = "criativo/adicionais";
const lerAdicionais = (fs: Firestore) => (fs.ler(ADICIONAIS)?.dados ?? null) as Partial<AdicionaisCriativo> | null;
/** Tabela-base (código) + serviços acordados pelo portal (criativo/adicionais). */
export const tabelaCriativoAtual = (fs?: Firestore) => mesclarAdicionais(montarTabelaMariane(catalogoVigente("bmlog")), fs ? lerAdicionais(fs) : null);

/** Publica a tabela em criativo/tabela (lida só pelos criativos e pelo admin, ver firestore.rules). */
export function publicarTabelaCriativo(fs: Firestore, agora: Date) {
  fs.gravar([{ caminho: "criativo/tabela", dados: { ...tabelaCriativoAtual(fs), publicadoEm: agora } as unknown as Record<string, unknown> }]);
}

function avisar(p: Plataforma, fs: Firestore, filtro: (x: { papel: string; uid: string }) => boolean, msg: { assunto: string; html: string; texto: string }) {
  const cfg = lerConfig(p);
  for (const d of fs.listar("usuarios")) {
    const x = { ...(d.dados as { email: string; papel: string; status?: string }), uid: d.caminho.split("/").pop()! };
    if (x.status === "removido" || !filtro(x)) continue;
    try { p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); }
    catch (e) { p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
  }
}

/** Serviço fora da tabela: o criativo propõe; o admin aprova (entra na tabela) ou recusa (decisão de 15/10/2026). */
export function tabelaCriativoFila(p: Plataforma, fs: Firestore, u: Usuario, bruto: unknown) {
  const d = (bruto ?? {}) as { acao?: string; protocolo?: string; item?: number; nome?: string; coluna?: string; valor?: number; obs?: string; id?: string; motivo?: string };
  const cfg = lerConfig(p);
  const agora = p.agora();
  const atual = fs.ler(ADICIONAIS);
  const ad: AdicionaisCriativo = { itens: [], mapa: {}, propostas: [], ...((atual?.dados ?? {}) as Partial<AdicionaisCriativo>) };
  const salvar = () => fs.gravar([{ caminho: ADICIONAIS, ...(atual ? { seAtualizadoEm: atual.atualizadoEm } : { seNaoExiste: true }), dados: ad as unknown as Record<string, unknown> }]);
  const valorOk = (v: unknown) => { const n = Math.round(Number(v) * 100) / 100; if (!(n > 0) || n > 100000) throw new ErroUsuario("Informe um valor válido."); return n; };

  if (d.acao === "propor") {
    if (u.papel !== "criativo") throw new ErroUsuario("Só o criativo propõe valores para a tabela dele.");
    const ped = fs.ler(`clientes/bmlog/solicitacoes/${String(d.protocolo ?? "")}`)?.dados as { protocolo: string; itens: { cod: string; variante: number; nome: string; varianteRotulo?: string }[]; criativo?: { uid: string } | null } | undefined;
    if (!ped) throw new ErroUsuario("Pedido não encontrado.");
    if (ped.criativo && ped.criativo.uid !== u.uid) throw new ErroUsuario("Este pedido está com outro criativo.");
    const it = ped.itens[Number(d.item)];
    if (!it) throw new ErroUsuario("Serviço não encontrado no pedido.");
    const chave = chaveServico(it);
    if (!foraDaTabela(tabelaCriativoAtual(fs), chave)) throw new ErroUsuario("Este serviço já está na sua tabela.");
    if (ad.propostas.some((x) => x.chave === chave && x.status === "pendente")) throw new ErroUsuario("Já existe uma proposta aguardando aprovação para este serviço.");
    const nome = String(d.nome ?? "").trim().slice(0, 90);
    if (nome.length < 3) throw new ErroUsuario("Dê um nome ao serviço.");
    if (d.coluna !== "nova" && d.coluna !== "adaptacao") throw new ErroUsuario("Escolha Nova criação ou Adaptação.");
    const pr: PropostaItem = {
      id: `pr${agora.getTime().toString(36)}`, uid: u.uid, criativo: u.nome, protocolo: ped.protocolo, chave,
      servico: `${it.nome}${it.varianteRotulo ? ` · ${it.varianteRotulo}` : ""}`, nome, coluna: d.coluna as Coluna, valor: valorOk(d.valor),
      ...(d.obs?.trim() ? { obs: d.obs.trim().slice(0, 300) } : {}), status: "pendente", em: agora,
    };
    ad.propostas = [...ad.propostas, pr].slice(-300);
    salvar();
    const msg = emailAviso({
      titulo: `Novo serviço para a tabela de ${u.nome.split(" ")[0]}`,
      texto: `${u.nome} propôs incluir na tabela de valores o serviço "${nome}" (${NOME_COLUNA[pr.coluna]}), pedido no ${ped.protocolo} como ${pr.servico}: ${moeda(pr.valor)}. Aprove ou recuse no portal.`,
      botao: "Aprovar ou recusar", link: `${cfg.portalUrl}/criativo/tabela/`,
    });
    avisar(p, fs, (x) => x.papel === "admin", msg);
    return { id: pr.id, status: "pendente" };
  }

  if (d.acao === "aprovar" || d.acao === "recusar") {
    if (u.papel !== "admin") throw new ErroUsuario("Só a administração da Propaga aprova serviços na tabela do criativo.");
    const pr = ad.propostas.find((x) => x.id === d.id);
    if (!pr) throw new ErroUsuario("Proposta não encontrada.");
    if (pr.status !== "pendente") throw new ErroUsuario("Esta proposta já foi decidida.");
    pr.decididoPor = u.nome; pr.decididoEm = agora;
    let msg;
    if (d.acao === "aprovar") {
      if (d.valor != null) pr.valor = valorOk(d.valor);
      const id = `acordo-${pr.id}`;
      ad.itens = [...ad.itens, { id, nome: pr.nome, adaptacao: pr.coluna === "adaptacao" ? pr.valor : null, nova: pr.coluna === "nova" ? pr.valor : null,
        ...(pr.obs ? { obs: pr.obs } : {}), acordado: `Acordado em ${hojeSP(agora).split("-").reverse().join("/")} (${pr.protocolo})` }];
      ad.mapa = { ...ad.mapa, [pr.chave]: { item: id, coluna: pr.coluna } };
      pr.status = "aprovada"; pr.itemId = id;
      salvar();
      publicarTabelaCriativo(fs, agora);
      msg = emailAviso({ titulo: "Serviço incluído na sua tabela", texto: `${u.nome} aprovou "${pr.nome}" (${NOME_COLUNA[pr.coluna]}) por ${moeda(pr.valor)}. O serviço já está na sua tabela e vale para os próximos pedidos e relatórios.`, botao: "Ver minha tabela", link: `${cfg.portalUrl}/criativo/tabela/` });
    } else {
      const motivo = String(d.motivo ?? "").trim().slice(0, 300);
      if (motivo.length < 3) throw new ErroUsuario("Informe o motivo.");
      pr.status = "recusada"; pr.motivo = motivo;
      salvar();
      msg = emailAviso({ titulo: "Proposta de valor não aprovada", texto: `${u.nome} não aprovou "${pr.nome}" por ${moeda(pr.valor)}. Motivo: ${motivo}. Você pode enviar uma nova proposta.`, botao: "Abrir o portal", link: `${cfg.portalUrl}/aprovacoes/` });
    }
    avisar(p, fs, (x) => x.uid === pr.uid, msg);
    return { id: pr.id, status: pr.status };
  }
  throw new ErroUsuario("Ação inválida.");
}

export function enviarRelatorioCriativo(p: Plataforma, fs: Firestore, u: Usuario, bruto: unknown) {
  if (u.papel !== "criativo") throw new ErroUsuario("Só o criativo envia este relatório.");
  const d = (bruto ?? {}) as { mes?: string; ajustes?: Ajuste[] };
  if (!d.mes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.mes)) throw new ErroUsuario("Mês inválido.");
  const ajustes = Array.isArray(d.ajustes) ? d.ajustes.slice(0, 500) : [];
  const id = idRelatorio(u.uid, d.mes);
  const caminho = `relatoriosCriativo/${id}`;
  const atual = fs.ler(caminho);
  if ((atual?.dados as { status?: string } | undefined)?.status === "pago") throw new ErroUsuario("Este mês já foi pago pela Propaga e não pode ser reenviado.");

  const tab = tabelaCriativoAtual(fs);
  const pedidos = fs.listar("clientes/bmlog/solicitacoes").map((x) => x.dados as never);
  const base = pecasDoMes(pedidos, d.mes, tab, u.uid);
  if (!base.length) throw new ErroUsuario(`Nenhuma peça concluída ou cancelada em ${nomeMes(d.mes)}.`);
  const linhas = aplicarAjustes(tab, base, ajustes);
  if (typeof linhas === "string") throw new ErroUsuario(linhas);
  const total = totalLinhas(linhas);
  const agora = p.agora();
  const envios = Number((atual?.dados as { envios?: number } | undefined)?.envios ?? 0) + 1;
  fs.gravar([{
    caminho, ...(atual ? { seAtualizadoEm: atual.atualizadoEm } : { seNaoExiste: true }),
    dados: {
      id, uid: u.uid, nome: u.nome, mes: d.mes, linhas, total, tabelaVersao: tab.versao, status: "enviado", enviadoEm: agora, enviadoPor: u.nome, envios,
      itens: Object.fromEntries(tab.itens.map((i) => [i.id, i.nome])),
    } as unknown as Record<string, unknown>,
  }]);

  const cfg = lerConfig(p);
  const dest = fs.listar("usuarios").map((x) => x.dados as { email: string; papel: string; nome: string })
    .filter((x) => x.papel === "financeiro_propaga" || x.papel === "admin");
  const msg = emailAviso({
    titulo: `Relatório de ${u.nome.split(" ")[0]} · ${nomeMes(d.mes)}`,
    texto: `${u.nome} enviou o relatório de serviços de ${nomeMes(d.mes)}${envios > 1 ? " (versão corrigida)" : ""}: ${linhas.length} peça(s), total de ${moeda(total)}, pela tabela de valores do criativo. Confira e registre o pagamento no portal.`,
    botao: "Conferir o relatório", link: `${cfg.portalUrl}/criativo/pagamentos/?id=${id}`,
  });
  for (const x of dest) {
    try { p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); }
    catch (e) { p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
  }
  // Projeto complexo (sob consulta): o valor registrado pela Mariane vai ao conhecimento do Marcelo (decisão de 15/10).
  const complexos = linhas.filter((l) => tab.itens.find((i) => i.id === l.item)?.sobConsulta);
  if (complexos.length) {
    const lista = complexos.map((l) => `${l.protocolo} · ${l.peca}: ${moeda(l.valor ?? 0)}${l.situacao === "cancelada" ? " (cancelada: 50%)" : ""}`).join("; ");
    const aviso = emailAviso({
      titulo: `Valor de projeto complexo · ${nomeMes(d.mes)}`,
      texto: `${u.nome} registrou o valor de ${complexos.length} projeto(s) complexo(s) (sob consulta) no relatório de ${nomeMes(d.mes)}: ${lista}.`,
      botao: "Abrir o portal", link: `${cfg.portalUrl}/aprovacoes/`,
    });
    for (const x of fs.listar("usuarios").map((y) => y.dados as { email: string; papel: string }).filter((y) => y.papel === "atendimento")) {
      try { p.enviarEmail({ para: x.email, assunto: aviso.assunto, html: aviso.html, texto: aviso.texto, nomeRemetente: cfg.remetente }); }
      catch (e) { p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
    }
  }
  return { id, mes: d.mes, total, pecas: linhas.length };
}

export function pagarRelatorioCriativo(p: Plataforma, fs: Firestore, u: Usuario, bruto: unknown) {
  if (!["financeiro_propaga", "admin"].includes(u.papel)) throw new ErroUsuario("Só o Financeiro da Propaga registra este pagamento.");
  const d = (bruto ?? {}) as { id?: string; nota?: string };
  if (!d.id || !/^[\w-]{1,128}_\d{4}-\d{2}$/.test(d.id)) throw new ErroUsuario("Relatório inválido.");
  const caminho = `relatoriosCriativo/${d.id}`;
  const atual = fs.ler(caminho);
  if (!atual) throw new ErroUsuario("Relatório não encontrado.");
  const r = atual.dados as { status: string; total: number; enviadoPor: string; uid: string; mes: string };
  if (r.status === "pago") throw new ErroUsuario("Este relatório já está pago.");
  const agora = p.agora();
  const nota = String(d.nota ?? "").trim().slice(0, 500);
  fs.gravar([{ caminho, mesclar: true, seAtualizadoEm: atual.atualizadoEm, dados: { status: "pago", pagoEm: agora, pagoPor: u.nome, notaPagamento: nota } }]);
  const cfg = lerConfig(p);
  const msg = emailAviso({
    titulo: `Pagamento registrado · ${nomeMes(r.mes)}`,
    texto: `${u.nome} registrou o pagamento do seu relatório de ${nomeMes(r.mes)}: ${moeda(r.total)}.${nota ? ` Observação: ${nota}` : ""}`,
    botao: "Ver meu relatório", link: `${cfg.portalUrl}/criativo/relatorio/?mes=${r.mes}`,
  });
  for (const x of fs.listar("usuarios").filter((y) => y.caminho.split("/").pop() === r.uid).map((y) => y.dados as { email: string })) {
    try { p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); }
    catch (e) { p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
  }
  return { id: d.id, mes: r.mes, status: "pago" };
}
