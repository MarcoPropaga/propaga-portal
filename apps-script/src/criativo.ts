/* Relatório mensal da Mariane (Criativo Propaga) e pagamento pela Marisa (Financeiro Propaga).
   A tabela vem do código do servidor (fonte da verdade); o navegador só sugere. Tudo é recalculado aqui. */
import { catalogoVigente } from "@/content/catalogos";
import { montarTabelaMariane } from "@/content/criativo/tabela-mariane";
import { aplicarAjustes, nomeMes, pecasDoMes, totalLinhas, type Ajuste } from "@/lib/criativo";
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
  if (!["criativo", "admin"].includes(u.papel)) throw new ErroUsuario("Só o criativo envia este relatório.");
  const d = (bruto ?? {}) as { mes?: string; ajustes?: Ajuste[] };
  if (!d.mes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.mes)) throw new ErroUsuario("Mês inválido.");
  const ajustes = Array.isArray(d.ajustes) ? d.ajustes.slice(0, 500) : [];
  const caminho = `relatoriosCriativo/${d.mes}`;
  const atual = fs.ler(caminho);
  if ((atual?.dados as { status?: string } | undefined)?.status === "pago") throw new ErroUsuario("Este mês já foi pago pela Propaga e não pode ser reenviado.");

  const tab = tabelaCriativoAtual();
  const pedidos = fs.listar("clientes/bmlog/solicitacoes").map((x) => x.dados as never);
  const base = pecasDoMes(pedidos, d.mes, tab);
  if (!base.length) throw new ErroUsuario(`Nenhuma peça concluída ou cancelada em ${nomeMes(d.mes)}.`);
  const linhas = aplicarAjustes(tab, base, ajustes);
  if (typeof linhas === "string") throw new ErroUsuario(linhas);
  const total = totalLinhas(linhas);
  const agora = p.agora();
  const envios = Number((atual?.dados as { envios?: number } | undefined)?.envios ?? 0) + 1;
  fs.gravar([{
    caminho, ...(atual ? { seAtualizadoEm: atual.atualizadoEm } : { seNaoExiste: true }),
    dados: {
      mes: d.mes, linhas, total, tabelaVersao: tab.versao, status: "enviado", enviadoEm: agora, enviadoPor: u.nome, envios,
      itens: Object.fromEntries(tab.itens.map((i) => [i.id, i.nome])),
    } as unknown as Record<string, unknown>,
  }]);

  const cfg = lerConfig(p);
  const dest = fs.listar("usuarios").map((x) => x.dados as { email: string; papel: string; nome: string })
    .filter((x) => x.papel === "financeiro_propaga" || x.papel === "admin");
  const msg = emailAviso({
    titulo: `Relatório da ${u.nome.split(" ")[0]} · ${nomeMes(d.mes)}`,
    texto: `${u.nome} enviou o relatório de serviços de ${nomeMes(d.mes)}${envios > 1 ? " (versão corrigida)" : ""}: ${linhas.length} peça(s), total de ${moeda(total)}, pela tabela de valores dela. Confira e registre o pagamento no portal.`,
    botao: "Conferir o relatório", link: `${cfg.portalUrl}/criativo/pagamentos/?mes=${d.mes}`,
  });
  for (const x of dest) {
    try { p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); }
    catch (e) { p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
  }
  return { mes: d.mes, total, pecas: linhas.length };
}

export function pagarRelatorioCriativo(p: Plataforma, fs: Firestore, u: Usuario, bruto: unknown) {
  if (!["financeiro_propaga", "admin"].includes(u.papel)) throw new ErroUsuario("Só o Financeiro da Propaga registra este pagamento.");
  const d = (bruto ?? {}) as { mes?: string; nota?: string };
  if (!d.mes || !/^\d{4}-\d{2}$/.test(d.mes)) throw new ErroUsuario("Mês inválido.");
  const caminho = `relatoriosCriativo/${d.mes}`;
  const atual = fs.ler(caminho);
  if (!atual) throw new ErroUsuario("Relatório não encontrado.");
  const r = atual.dados as { status: string; total: number; enviadoPor: string };
  if (r.status === "pago") throw new ErroUsuario("Este relatório já está pago.");
  const agora = p.agora();
  const nota = String(d.nota ?? "").trim().slice(0, 500);
  fs.gravar([{ caminho, mesclar: true, seAtualizadoEm: atual.atualizadoEm, dados: { status: "pago", pagoEm: agora, pagoPor: u.nome, notaPagamento: nota } }]);
  const cfg = lerConfig(p);
  const msg = emailAviso({
    titulo: `Pagamento registrado · ${nomeMes(d.mes)}`,
    texto: `${u.nome} registrou o pagamento do seu relatório de ${nomeMes(d.mes)}: ${moeda(r.total)}.${nota ? ` Observação: ${nota}` : ""}`,
    botao: "Ver meu relatório", link: `${cfg.portalUrl}/criativo/relatorio/?mes=${d.mes}`,
  });
  for (const x of fs.listar("usuarios").map((y) => y.dados as { email: string; papel: string }).filter((y) => y.papel === "criativo")) {
    try { p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente }); }
    catch (e) { p.log(`E-mail para ${x.email} falhou: ${(e as Error).message}`); }
  }
  return { mes: d.mes, status: "pago" };
}
