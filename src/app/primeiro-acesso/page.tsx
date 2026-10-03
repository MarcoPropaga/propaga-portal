"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmPasswordReset, sendPasswordResetEmail, verifyPasswordResetCode, type MultiFactorResolver, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { confirmarCodigo, entrarComSenha } from "@/lib/acesso";
import { mensagemErroAuth } from "@/lib/erros-auth";
import { REGRAS_SENHA } from "@/lib/schemas";
import { Aviso, Botao, Campo, RegrasSenha, TelaAcesso } from "@/components/ui";
import { CadastroTotp, DesafioTotp } from "@/components/auth/totp";

type Etapa = "verificando" | "senha" | "autenticador" | "desafio" | "invalido";

/** Primeiro acesso pelo convite (e também redefinição de senha): link → senha → autenticador. */
export default function PrimeiroAcesso() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("verificando");
  const [oob, setOob] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [emailNovoLink, setEmailNovoLink] = useState("");
  const [novoLinkEnviado, setNovoLinkEnviado] = useState(false);

  useEffect(() => {
    const codigo = new URLSearchParams(window.location.search).get("oobCode") || "";
    setOob(codigo);
    if (!codigo) { setEtapa("invalido"); return; }
    verifyPasswordResetCode(auth(), codigo)
      .then((em) => { setEmail(em); setEtapa("senha"); })
      .catch((e) => { setErro(mensagemErroAuth(e)); setEtapa("invalido"); });
  }, []);

  async function criarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!REGRAS_SENHA.every((r) => r.ok(senha))) return setErro("A senha ainda não cumpre todos os requisitos.");
    if (senha !== senha2) return setErro("As duas senhas não são iguais. Digite de novo.");
    setEnviando(true); setErro("");
    try {
      await confirmPasswordReset(auth(), oob, senha);
      const r = await entrarComSenha(email, senha);
      if (r.tipo === "segundoFator") { setResolver(r.resolver); setEtapa("desafio"); }
      else { setUsuario(r.usuario); setEtapa("autenticador"); }
    } catch (er) { setErro(mensagemErroAuth(er)); }
    finally { setEnviando(false); }
  }

  async function aposCadastro() {
    // A sessão precisa ter passado pelo segundo fator; se o token ainda não refletir, pede novo login.
    const t = await auth().currentUser?.getIdTokenResult(true);
    const fb = t?.claims.firebase as { sign_in_second_factor?: string } | undefined;
    if (fb?.sign_in_second_factor) router.replace("/inicio/");
    else { await auth().signOut(); router.replace(`/entrar/?motivo=ativado&email=${encodeURIComponent(email)}`); }
  }

  async function pedirNovoLink(e: React.FormEvent) {
    e.preventDefault();
    if (!emailNovoLink.trim()) return setErro("Digite seu e-mail.");
    setEnviando(true); setErro("");
    try {
      await sendPasswordResetEmail(auth(), emailNovoLink.trim(), { url: `${window.location.origin}/entrar/` });
    } catch { /* resposta igual para qualquer e-mail (proteção contra enumeração) */ }
    setNovoLinkEnviado(true); setEnviando(false);
  }

  if (etapa === "verificando") return <TelaAcesso titulo="Primeiro acesso"><p className="text-gray-600" aria-busy="true">Verificando o link…</p></TelaAcesso>;

  if (etapa === "invalido") {
    return (
      <TelaAcesso titulo="Link expirado ou já usado" subtitulo="O link do convite vale por 1 hora e funciona uma única vez.">
        {novoLinkEnviado ? (
          <Aviso tipo="ok">Se este e-mail tiver acesso ao portal, você vai receber um novo link em instantes. Confira também a caixa de spam.</Aviso>
        ) : (
          <form onSubmit={pedirNovoLink} className="grid gap-4" noValidate>
            <Campo id="emailNovo" rotulo="Seu e-mail" type="email" autoComplete="email" value={emailNovoLink} onChange={(e) => setEmailNovoLink(e.target.value)} erro={erro} />
            <Botao type="submit" carregando={enviando}>Gerar novo link</Botao>
          </form>
        )}
        <a href="/entrar/" className="text-sm font-semibold text-marca-700 hover:underline">Já tenho senha</a>
      </TelaAcesso>
    );
  }

  const passos = <div className="flex gap-1.5" aria-hidden="true">{[1, 2].map((i) => <i key={i} className={`h-1 flex-1 rounded ${(etapa === "senha" ? 1 : 2) >= i ? "bg-marca-500" : "bg-gray-200"}`} />)}</div>;

  if (etapa === "senha") {
    return (
      <TelaAcesso titulo="Crie sua senha" subtitulo={<>Etapa 1 de 2 · acesso de <b className="text-ink-900">{email}</b></>}>
        {passos}
        <form onSubmit={criarSenha} className="grid gap-4" noValidate>
          <Campo id="senha" rotulo="Nova senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <RegrasSenha senha={senha} regras={REGRAS_SENHA} />
          <Campo id="senha2" rotulo="Repita a senha" type="password" autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} erro={erro} />
          <Botao type="submit" carregando={enviando}>Continuar</Botao>
        </form>
      </TelaAcesso>
    );
  }

  if (etapa === "desafio" && resolver) {
    return (
      <TelaAcesso titulo="Código de verificação" subtitulo="Senha atualizada. Confirme com o aplicativo autenticador." voltar={{ href: "/entrar/", rotulo: "Voltar para entrar" }}>
        <DesafioTotp aoConfirmar={async (c) => { await confirmarCodigo(resolver, c); router.replace("/inicio/"); }} />
      </TelaAcesso>
    );
  }

  return (
    <TelaAcesso titulo="Ative a verificação em duas etapas" subtitulo="Etapa 2 de 2 · protege seu acesso mesmo que a senha vaze."
      voltar={{ rotulo: "Voltar para entrar", onClick: async () => { await auth().signOut(); router.replace(`/entrar/?email=${encodeURIComponent(email)}`); } }}>
      {passos}
      {usuario && <CadastroTotp usuario={usuario} aoConcluir={aposCadastro} />}
    </TelaAcesso>
  );
}
