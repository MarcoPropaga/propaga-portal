/* Relatório mensal da Mariane (Criativo Propaga) e pagamento pela Marisa (Financeiro Propaga).
   A tabela vem do código do servidor (fonte da verdade); o navegador só sugere. Tudo é recalculado aqui. */
import { catalogoVigente } from "@/content/catalogos";
import { montarTabelaMariane } from "@/content/criativo/tabela-mariane";
import { aplicarAjustes, idRelatorio, nomeMes, pecasDoMes, totalLinhas, type Ajuste } from "@/lib/criativo";
import { emailAviso } from "./emails";
import type { Firestore } from "./firestore";
import { ErroUsuario, type Plataforma } from "./plataforma";
import { lerConfig } from "./servidor";

interface Usuario { uid: string; nome: string; papel: string; email: string }
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const tabelaCriativoAtual = () => montarTabelaMariane(catalogoVigente("bmlog"));

/** Publica a tabela em criativo/tabela (lida só pela Mariane e pelo admin, ver firestore.rules). */
export function publicarTabelaCriativo(fs: Firestore, agora: Date) {
  fs.gravar([{ caminho: "criativo/tabela", dados: { ...tabelaCriativoAtual(), publicadoEm: agora } as unknown as Record<string, unknown> }]);
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

  const tab = tabelaCriativoAtual();
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
