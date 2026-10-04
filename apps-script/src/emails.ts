/* E-mails do portal (HTML simples, compatível com Gmail/Outlook). */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Moldura comum dos e-mails: faixa grafite com a marca + cartão branco. */
function moldura(conteudo: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F4F8F9;font-family:Arial,Helvetica,sans-serif;color:#003C57">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F8F9;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px">
<tr><td style="background:#003C57;padding:18px 28px;color:#FFFFFF;font-weight:bold;font-size:18px;letter-spacing:.3px"><span style="color:#55C5D0">mkt</span> B&amp;M Log <span style="color:#A9CBD6;font-weight:normal;font-size:14px">· Portal MKT B&amp;M Log e Propaga</span></td></tr>
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
<p style="margin:0 0 6px;font-size:13px;color:#4E6670">${esc(o.cliente)} · ${esc(o.protocolo)}</p>
<h1 style="margin:0 0 12px;font-size:22px">${esc(o.titulo)}</h1>
<p style="margin:0 0 16px;line-height:1.55">${esc(o.solicitante)} enviou uma nova solicitação à Propaga.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.5;margin:0 0 16px">
<tr><td style="color:#4E6670;padding:2px 12px 2px 0;width:120px;vertical-align:top">Unidade</td><td>${esc(o.unidade)}</td></tr>
<tr><td style="color:#4E6670;padding:2px 12px 2px 0;vertical-align:top">Público</td><td>${esc(o.publico)}</td></tr>
<tr><td style="color:#4E6670;padding:2px 12px 2px 0;vertical-align:top">Objetivo</td><td>${esc(o.objetivo)}</td></tr>
<tr><td style="color:#4E6670;padding:2px 12px 2px 0;vertical-align:top">Data desejada</td><td>${esc(data)}${o.urgente ? ' · <b style="color:#B42318">pedido urgente</b>' : ""}</td></tr>
</table>
<p style="margin:0 0 6px;font-weight:bold;font-size:14px">Serviços</p>
<ul style="margin:0 0 20px;padding-left:18px;font-size:14px;line-height:1.6">${o.itens.map((i) =>
    `<li>${i.qtd}× ${esc(i.nome)}${i.detalhe ? ` <span style="color:#4E6670">· ${esc(i.detalhe)}</span>` : ""}${i.sobOrcamento ? ' <span style="color:#B42318">· sob orçamento</span>' : ""}</li>`).join("")}</ul>
<p style="margin:0 0 16px"><a href="${esc(o.link)}" style="display:inline-block;background:#55C5D0;color:#003C57;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:4px">Abrir o portal</a></p>
<p style="margin:0;font-size:13px;color:#4E6670;line-height:1.5">Os valores ficam no portal, em Jobs Propaga e Relatórios, para os perfis autorizados.</p>`);
  return { assunto, texto, html };
}

/** Aviso de mudança num pedido (sem valores). */
export function emailAtualizacao(o: { cliente: string; protocolo: string; titulo: string; rotulo: string; nota: string; autor: string; etapa: string; link: string }) {
  const assunto = `${o.protocolo} · ${o.rotulo}`;
  const texto = [`${o.cliente} · ${o.protocolo} · ${o.titulo}`, ``, `${o.rotulo} (por ${o.autor}).`, o.nota ? `\n${o.nota}` : "",
    ``, `Etapa atual: ${o.etapa}`, `Abrir o pedido: ${o.link}`, ``, `Propaga · Comunicação com Inteligência Aplicada`].join("\n");
  const html = moldura(`
<p style="margin:0 0 6px;font-size:13px;color:#4E6670">${esc(o.cliente)} · ${esc(o.protocolo)}</p>
<h1 style="margin:0 0 12px;font-size:22px">${esc(o.rotulo)}</h1>
<p style="margin:0 0 12px;line-height:1.55"><b>${esc(o.titulo)}</b><br><span style="color:#4E6670">por ${esc(o.autor)} · etapa atual: ${esc(o.etapa)}</span></p>
${o.nota ? `<p style="margin:0 0 16px;line-height:1.55;background:#F4F8F9;padding:12px 14px;border-radius:4px;white-space:pre-wrap">${esc(o.nota)}</p>` : ""}
<p style="margin:0"><a href="${esc(o.link)}" style="display:inline-block;background:#55C5D0;color:#003C57;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:4px">Abrir no portal</a></p>`);
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
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F4F8F9;font-family:Arial,Helvetica,sans-serif;color:#003C57">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F8F9;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px">
<tr><td style="background:#003C57;padding:18px 28px;color:#FFFFFF;font-weight:bold;font-size:18px;letter-spacing:.3px"><span style="color:#55C5D0">mkt</span> B&amp;M Log <span style="color:#A9CBD6;font-weight:normal;font-size:14px">· Portal MKT B&amp;M Log e Propaga</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:13px;color:#4E6670">${esc(o.cliente)}</p>
<h1 style="margin:0 0 16px;font-size:22px">Olá, ${esc(o.nome)}.</h1>
<p style="margin:0 0 16px;line-height:1.55">${esc(o.convidadoPor)} liberou seu acesso. Crie sua senha para entrar.</p>
<p style="margin:0 0 20px"><a href="${esc(o.link)}" style="display:inline-block;background:#55C5D0;color:#003C57;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:4px">Criar minha senha</a></p>
<p style="margin:0 0 10px;line-height:1.55;font-size:14px">Depois, você ativa a verificação em duas etapas com um aplicativo autenticador no celular (Google Authenticator ou Microsoft Authenticator). Leva cerca de 1 minuto.</p>
<p style="margin:0;font-size:13px;color:#4E6670;line-height:1.5">O link vale por 1 hora. Se expirar, abra a página e use “Gerar novo link”. A Propaga nunca pede sua senha por e-mail.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { assunto, texto, html };
}

/** Resumo diário de pendências (aprovações). */
export function emailResumo(o: { nome: string; link: string; linhas: { protocolo: string; titulo: string; peca: string; etapa: string; prazo: string | null; atrasada: boolean }[] }) {
  const atras = o.linhas.filter((l) => l.atrasada).length;
  const assunto = `Suas pendências no portal: ${o.linhas.length}${atras ? ` (${atras} atrasada${atras > 1 ? "s" : ""})` : ""}`;
  const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
  const texto = [`Olá, ${o.nome}.`, ``, `Peças aguardando você:`, ...o.linhas.map((l) => `- ${l.protocolo} · ${l.peca} · prazo ${br(l.prazo)}${l.atrasada ? " (ATRASADA)" : ""}`),
    ``, `Abrir Minhas tarefas: ${o.link}`].join("\n");
  const html = moldura(`
<h1 style="margin:0 0 12px;font-size:22px">Olá, ${esc(o.nome)}.</h1>
<p style="margin:0 0 12px;line-height:1.55">${o.linhas.length} peça${o.linhas.length > 1 ? "s aguardam" : " aguarda"} você${atras ? ` · <b style="color:#B42318">${atras} atrasada${atras > 1 ? "s" : ""}</b>` : ""}.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.5;margin:0 0 18px;border-collapse:collapse">
${o.linhas.map((l) => `<tr><td style="padding:6px 8px 6px 0;border-top:1px solid #E2EAED;vertical-align:top"><b>${esc(l.peca)}</b><br><span style="color:#4E6670">${esc(l.protocolo)} · ${esc(l.titulo)}</span></td><td style="padding:6px 0;border-top:1px solid #E2EAED;text-align:right;white-space:nowrap;vertical-align:top;${l.atrasada ? "color:#B42318;font-weight:bold" : "color:#4E6670"}">prazo ${br(l.prazo)}</td></tr>`).join("")}
</table>
<p style="margin:0"><a href="${esc(o.link)}" style="display:inline-block;background:#55C5D0;color:#003C57;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:4px">Abrir Minhas tarefas</a></p>`);
  return { assunto, texto, html };
}
