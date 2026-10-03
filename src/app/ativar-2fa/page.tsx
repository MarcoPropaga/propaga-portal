"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useSessao } from "@/components/auth/sessao";
import { CadastroTotp } from "@/components/auth/totp";
import { TelaAcesso } from "@/components/ui";

/** Para quem já tem senha mas ainda não cadastrou o autenticador. */
export default function Ativar2fa() {
  const s = useSessao();
  const router = useRouter();
  useEffect(() => {
    if (s.carregando) return;
    if (!s.usuario) router.replace("/entrar/");
    else if (s.temSegundoFator) router.replace("/inicio/");
  }, [s.carregando, s.usuario, s.temSegundoFator, router]);

  async function aposCadastro() {
    const t = await auth().currentUser?.getIdTokenResult(true);
    const fb = t?.claims.firebase as { sign_in_second_factor?: string } | undefined;
    if (fb?.sign_in_second_factor) router.replace("/inicio/");
    else { const email = s.usuario?.email ?? ""; await s.sair(); router.replace(`/entrar/?motivo=ativado&email=${encodeURIComponent(email)}`); }
  }

  if (!s.usuario || s.temSegundoFator) return <main className="grid min-h-screen place-items-center text-gray-600" aria-busy="true">Carregando…</main>;
  return (
    <TelaAcesso titulo="Ative a verificação em duas etapas" subtitulo="Obrigatória para acessar o portal. Leva cerca de 1 minuto.">
      <CadastroTotp usuario={s.usuario} aoConcluir={aposCadastro} />
    </TelaAcesso>
  );
}
