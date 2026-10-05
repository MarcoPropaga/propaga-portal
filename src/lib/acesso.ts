"use client";
/* Fluxos de acesso: senha, segundo fator (TOTP) e cadastro do autenticador. */
import {
  signInWithEmailAndPassword, getMultiFactorResolver, multiFactor, setPersistence,
  browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence,
  TotpMultiFactorGenerator, type MultiFactorResolver, type TotpSecret, type User, type MultiFactorError,
} from "firebase/auth";
import QRCode from "qrcode";
import { auth } from "./firebase";

export type ResultadoEntrada = { tipo: "ok"; usuario: User } | { tipo: "segundoFator"; resolver: MultiFactorResolver };

/** permanecer = true: conectado neste aparelho até "Sair"; false: só até fechar o navegador. */
export async function entrarComSenha(email: string, senha: string, permanecer = true): Promise<ResultadoEntrada> {
  try {
    await setPersistence(auth(), permanecer ? indexedDBLocalPersistence : browserSessionPersistence)
      .catch(() => setPersistence(auth(), permanecer ? browserLocalPersistence : browserSessionPersistence));
    const c = await signInWithEmailAndPassword(auth(), email.trim(), senha);
    return { tipo: "ok", usuario: c.user };
  } catch (e) {
    if ((e as { code?: string }).code === "auth/multi-factor-auth-required") {
      return { tipo: "segundoFator", resolver: getMultiFactorResolver(auth(), e as MultiFactorError) };
    }
    throw e;
  }
}

export async function confirmarCodigo(resolver: MultiFactorResolver, codigo: string) {
  const dica = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!dica) throw Object.assign(new Error("sem TOTP"), { code: "auth/missing-code" });
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(dica.uid, codigo.trim());
  return (await resolver.resolveSignIn(assertion)).user;
}

export interface SegredoTotp { segredo: TotpSecret; qr: string; chave: string }

export async function gerarSegredoTotp(u: User): Promise<SegredoTotp> {
  const sessao = await multiFactor(u).getSession();
  const segredo = await TotpMultiFactorGenerator.generateSecret(sessao);
  const url = segredo.generateQrCodeUrl(u.email ?? "", "Portal Propaga");
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 200, color: { dark: "#141414", light: "#ffffff" } });
  const chave = segredo.secretKey.replace(/(.{4})/g, "$1 ").trim();
  return { segredo, qr, chave };
}

export async function cadastrarTotp(u: User, s: TotpSecret, codigo: string) {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(s, codigo.trim());
  await multiFactor(u).enroll(assertion, "Aplicativo autenticador");
  await u.getIdToken(true);
}

export const codigoValido = (c: string) => /^\d{6}$/.test(c.trim());
