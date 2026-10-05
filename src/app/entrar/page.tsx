"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MultiFactorResolver } from "firebase/auth";
import { multiFactor } from "firebase/auth";
import { confirmarCodigo, entrarComSenha } from "@/lib/acesso";
import { mensagemErroAuth } from "@/lib/erros-auth";
import { Aviso, Botao, Campo, TelaAcesso } from "@/components/ui";
import { DesafioTotp } from "@/components/auth/totp";
import { useSessao } from "@/components/auth/sessao";

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);

  // Já conectado neste aparelho (senha + código): vai direto ao portal, sem pedir login de novo.
  const s = useSessao();
  useEffect(() => {
    if (!s.carregando && s.usuario && (s.entrouComSegundoFator || process.env.NEXT_PUBLIC_USAR_EMULADOR === "true") && !resolver) router.replace("/inicio/");
  }, [s.carregando, s.usuario, s.entrouComSegundoFator, resolver, router]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("email")) setEmail(q.get("email")!);
    const motivo = q.get("motivo");
    if (motivo === "2fa") setAviso("Por segurança, entre de novo com o código do aplicativo autenticador.");
    if (motivo === "ativado") setAviso("Verificação em duas etapas ativada. Entre com sua senha e o código do aplicativo.");
    if (motivo === "senha") setAviso("Senha criada. Entre para continuar.");
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) return setErro("Preencha e-mail e senha.");
    setEnviando(true); setErro("");
    try {
      const r = await entrarComSenha(email, senha);
      if (r.tipo === "segundoFator") return setResolver(r.resolver);
      router.replace(multiFactor(r.usuario).enrolledFactors.length ? "/inicio/" : "/ativar-2fa/");
    } catch (er) { setErro(mensagemErroAuth(er)); }
    finally { setEnviando(false); }
  }

  if (resolver) {
    return (
      <TelaAcesso titulo="Código de verificação" subtitulo="Segunda etapa do acesso." voltar={{ rotulo: "Voltar", onClick: () => { setResolver(null); setSenha(""); } }}>
        <DesafioTotp
          aoConfirmar={async (c) => { await confirmarCodigo(resolver, c); router.replace("/inicio/"); }} />
      </TelaAcesso>
    );
  }

  return (
    <TelaAcesso titulo="Entrar" subtitulo="Use o e-mail cadastrado pela Propaga.">
      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
      <form onSubmit={enviar} className="grid gap-4" noValidate>
        <Campo id="email" rotulo="E-mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo id="senha" rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} erro={erro} />
        <p className="text-sm text-gray-600">Você continua conectado neste aparelho até tocar em <b>Sair</b>.</p>
        <Botao type="submit" carregando={enviando}>Entrar</Botao>
      </form>
      <a href="/recuperar/" className="text-sm font-semibold text-marca-700 underline-offset-2 hover:underline">Esqueci minha senha</a>
    </TelaAcesso>
  );
}
