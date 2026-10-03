/* E-mails do portal (HTML simples, compatível com Gmail/Outlook). */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Moldura comum dos e-mails: faixa grafite com a marca + cartão branco. */
function moldura(conteudo: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F7F5F2;font-family:Arial,Helvetica,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F2;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px">
<tr><td style="background:#141414;padding:20px 28px;color:#FF1B00;font-weight:bold;font-size:20px;letter-spacing:.5px">PROPAGA</td></tr>
<tr><td style="padding:28px">${conteudo}</td></tr></table></td></tr></table></body></html>`;
}

/** Aviso de nova solicitação. Sem valores: preços ficam em Valores e Relatórios, dentro do portal. */
export function emailNovaSolicitacao(o: {
  cliente: string; protocolo: string; titulo: string; solicitante: string; unidade: string; publico: string;
  objetivo: string; desejada: string; urgente: boolean; itens: { qtd: number; nome: string; detalhe: string; sobOrcamento: boolean }[];
  link: string;
}) {
  const data = o.desejada.split("-").reverse().join("/");
  const assunto = `Nova solicitação ${o.protocolo} · ${o.titulo}`;
  const linhas = o.itens.map((i) => `${i.qtd}× ${i.nome}${i.detalhe ? ` (${i.detalhe})` : ""}${i.sobOrcamento ? " · sob orçamento" : ""}`);
  const texto = [
    `${o.cliente} · ${o.protocolo}`,
    ``,
    `${o.solicitante} enviou a solicitação "${o.titulo}".`,
    `Unidade: ${o.unidade}`,
    `Público: ${o.publico}`,
    `Objetivo: ${o.objetivo}`,
    `Data desejada: ${data}${o.urgente ? " (pedido urgente)" : ""}`,
    ``,
    `Serviços:`,
    ...linhas.map((l) => `- ${l}`),
    ``,
    `Acompanhe no portal: ${o.link}`,
    ``,
    `Propaga · Comunicação com Inteligência Aplicada`,
  ].join("\n");
  const html = moldura(`
<p style="margin:0 0 6px;font-size:13px;color:#5F5A56">${esc(o.cliente)} · ${esc(o.protocolo)}</p>
<h1 style="margin:0 0 12px;font-size:22px">${esc(o.titulo)}</h1>
<p style="margin:0 0 16px;line-height:1.55">${esc(o.solicitante)} enviou uma nova solicitação à Propaga.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.5;margin:0 0 16px">
<tr><td style="color:#5F5A56;padding:2px 12px 2px 0;width:120px;vertical-align:top">Unidade</td><td>${esc(o.unidade)}</td></tr>
<tr><td style="color:#5F5A56;padding:2px 12px 2px 0;vertical-align:top">Público</td><td>${esc(o.publico)}</td></tr>
<tr><td style="color:#5F5A56;padding:2px 12px 2px 0;vertical-align:top">Objetivo</td><td>${esc(o.objetivo)}</td></tr>
<tr><td style="color:#5F5A56;padding:2px 12px 2px 0;vertical-align:top">Data desejada</td><td>${esc(data)}${o.urgente ? ' · <b style="color:#C81500">pedido urgente</b>' : ""}</td></tr>
</table>
<p style="margin:0 0 6px;font-weight:bold;font-size:14px">Serviços</p>
<ul style="margin:0 0 20px;padding-left:18px;font-size:14px;line-height:1.6">${o.itens.map((i) =>
    `<li>${i.qtd}× ${esc(i.nome)}${i.detalhe ? ` <span style="color:#5F5A56">· ${esc(i.detalhe)}</span>` : ""}${i.sobOrcamento ? ' <span style="color:#C81500">· sob orçamento</span>' : ""}</li>`).join("")}</ul>
<p style="margin:0 0 16px"><a href="${esc(o.link)}" style="display:inline-block;background:#FF1B00;color:#141414;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:4px">Abrir o portal</a></p>
<p style="margin:0;font-size:13px;color:#5F5A56;line-height:1.5">Os valores ficam no portal, em Valores e Relatórios, para os perfis autorizados.</p>`);
  return { assunto, texto, html };
}

/** Aviso de mudança num pedido (sem valores). */
export function emailAtualizacao(o: { cliente: string; protocolo: string; titulo: string; rotulo: string; nota: string; autor: string; etapa: string; link: string }) {
  const assunto = `${o.protocolo} · ${o.rotulo}`;
  const texto = [`${o.cliente} · ${o.protocolo} · ${o.titulo}`, ``, `${o.rotulo} (por ${o.autor}).`, o.nota ? `\n${o.nota}` : "",
    ``, `Etapa atual: ${o.etapa}`, `Abrir o pedido: ${o.link}`, ``, `Propaga · Comunicação com Inteligência Aplicada`].join("\n");
  const html = moldura(`
<p style="margin:0 0 6px;font-size:13px;color:#5F5A56">${esc(o.cliente)} · ${esc(o.protocolo)}</p>
<h1 style="margin:0 0 12px;font-size:22px">${esc(o.rotulo)}</h1>
<p style="margin:0 0 12px;line-height:1.55"><b>${esc(o.titulo)}</b><br><span style="color:#5F5A56">por ${esc(o.autor)} · etapa atual: ${esc(o.etapa)}</span></p>
${o.nota ? `<p style="margin:0 0 16px;line-height:1.55;background:#F7F5F2;padding:12px 14px;border-radius:4px;white-space:pre-wrap">${esc(o.nota)}</p>` : ""}
<p style="margin:0"><a href="${esc(o.link)}" style="display:inline-block;background:#FF1B00;color:#141414;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:4px">Abrir o pedido</a></p>`);
  return { assunto, texto, html };
}

export function emailConvite(o: { nome: string; link: string; cliente: string; convidadoPor: string }) {
  const assunto = `Seu acesso ao ${o.cliente}`;
  const texto = [
    `Olá, ${o.nome}.`,
    ``,
    `${o.convidadoPor} liberou seu acesso ao ${o.cliente}, da Propaga.`,
    `Crie sua senha neste link (válido por 1 hora): ${o.link}`,
    ``,
    `Depois, ative a verificação em duas etapas com um aplicativo autenticador (Google Authenticator ou Microsoft Authenticator).`,
    `Se o link expirar, abra a página e use "Gerar novo link".`,
    ``,
    `Propaga · Comunicação com Inteligência Aplicada`,
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F7F5F2;font-family:Arial,Helvetica,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F2;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px">
<tr><td style="background:#141414;padding:20px 28px;color:#FF1B00;font-weight:bold;font-size:20px;letter-spacing:.5px">PROPAGA</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:13px;color:#5F5A56">${esc(o.cliente)}</p>
<h1 style="margin:0 0 16px;font-size:22px">Olá, ${esc(o.nome)}.</h1>
<p style="margin:0 0 16px;line-height:1.55">${esc(o.convidadoPor)} liberou seu acesso. Crie sua senha para entrar.</p>
<p style="margin:0 0 20px"><a href="${esc(o.link)}" style="display:inline-block;background:#FF1B00;color:#141414;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:4px">Criar minha senha</a></p>
<p style="margin:0 0 10px;line-height:1.55;font-size:14px">Depois, você ativa a verificação em duas etapas com um aplicativo autenticador no celular (Google Authenticator ou Microsoft Authenticator). Leva cerca de 1 minuto.</p>
<p style="margin:0;font-size:13px;color:#5F5A56;line-height:1.5">O link vale por 1 hora. Se expirar, abra a página e use “Gerar novo link”. A Propaga nunca pede sua senha por e-mail.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { assunto, texto, html };
}
