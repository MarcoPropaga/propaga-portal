/* Trava de e-mails do período de teste.
   Propriedade do script EMAILS_PERMITIDOS: lista separada por vírgula, de domínios ("propaga.com") e/ou
   endereços exatos ("alguem@gmail.com"). Com a lista preenchida, o servidor NÃO convida nem envia e-mail
   para ninguém fora dela. Vazia ou ausente = trava desligada (uso real). */
import type { Plataforma } from "./plataforma";
import { ErroUsuario } from "./plataforma";

export const PROPRIEDADE_TRAVA = "EMAILS_PERMITIDOS";

/** Lista normalizada, ou null quando a trava está desligada. */
export function listaPermitida(p: Plataforma): string[] | null {
  const bruto = p.propriedade(PROPRIEDADE_TRAVA);
  const lista = (bruto ?? "").split(",").map((x) => x.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
  return lista.length ? lista : null;
}

export function emailPermitido(p: Plataforma, email: string): boolean {
  const lista = listaPermitida(p);
  if (!lista) return true;
  const e = email.trim().toLowerCase();
  const dominio = e.slice(e.lastIndexOf("@") + 1);
  return lista.some((x) => (x.includes("@") ? x === e : x === dominio));
}

/** Convite só para e-mail da lista (falha antes de criar a conta). */
export function exigirPermitido(p: Plataforma, email: string) {
  if (!emailPermitido(p, email))
    throw new ErroUsuario("Período de teste: este e-mail não está na lista permitida do servidor (propriedade EMAILS_PERMITIDOS). Use um e-mail da Propaga.");
}

/** Plataforma com a trava ligada ao envio: e-mail fora da lista é descartado e registrado no log. */
export function comTrava(p: Plataforma): Plataforma {
  return {
    ...p,
    enviarEmail(m) {
      if (!emailPermitido(p, m.para)) { p.log(`Trava de teste: e-mail "${m.assunto}" para ${m.para} NÃO enviado.`); return; }
      p.enviarEmail(m);
    },
  };
}
