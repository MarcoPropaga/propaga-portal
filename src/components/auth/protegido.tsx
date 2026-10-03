"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "./sessao";
import type { Papel } from "@/lib/tipos";

/** Libera a página só com sessão completa (senha + segundo fator) e, se indicado, perfil permitido. */
// Só no ambiente local de testes: o emulador do Firebase não suporta autenticador (TOTP).
// Em produção a variável não existe e as regras do banco continuam exigindo o segundo fator.
const EMULADOR = process.env.NEXT_PUBLIC_USAR_EMULADOR === "true";

export function Protegido({ papeis, children }: { papeis?: Papel[]; children: ReactNode }) {
  const s = useSessao();
  const router = useRouter();
  const bloqueio = s.carregando ? "carregando"
    : !s.usuario ? "/entrar/"
    : !s.temSegundoFator && !EMULADOR ? "/ativar-2fa/"
    : !s.entrouComSegundoFator && !EMULADOR ? "reentrar"
    : papeis && (!s.papel || !papeis.includes(s.papel)) ? "sem-permissao"
    : null;

  useEffect(() => {
    if (bloqueio === "reentrar") { s.sair().then(() => router.replace("/entrar/?motivo=2fa")); return; }
    if (bloqueio && bloqueio.startsWith("/")) router.replace(bloqueio);
  }, [bloqueio, router, s]);

  if (bloqueio === "sem-permissao") {
    return <main className="grid min-h-screen place-items-center p-6"><div className="grid max-w-md gap-3"><h1 className="text-2xl">Sem acesso a esta área</h1><p className="text-gray-600">Seu perfil não tem permissão para esta página.</p><a className="text-orange-700 underline" href="/inicio/">Voltar ao início</a></div></main>;
  }
  if (bloqueio) return <main className="grid min-h-screen place-items-center text-gray-600" aria-busy="true">Carregando…</main>;
  return <>{children}</>;
}
