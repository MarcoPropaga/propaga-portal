/* E-mails do portal (HTML simples, compatível com Gmail/Outlook). */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

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
