"use client";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { cadastrarTotp, codigoValido, gerarSegredoTotp, type SegredoTotp } from "@/lib/acesso";
import { mensagemErroAuth } from "@/lib/erros-auth";
import { Aviso, Botao, Campo } from "@/components/ui";

/** Cadastro do aplicativo autenticador (QR + código de confirmação). */
export function CadastroTotp({ usuario, aoConcluir }: { usuario: User; aoConcluir: () => void }) {
  const [s, setS] = useState<SegredoTotp | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falhaQr, setFalhaQr] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setFalhaQr("");
    gerarSegredoTotp(usuario).then((x) => ativo && setS(x)).catch((e) => {
      console.error("[portal] TOTP", (e as { code?: string }).code, e);
      if (ativo) setFalhaQr(mensagemErroAuth(e));
    });
    return () => { ativo = false; };
  }, [usuario, tentativa]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    if (!codigoValido(codigo)) return setErro("Digite os 6 números que aparecem no aplicativo.");
    setEnviando(true); setErro("");
    try { await cadastrarTotp(usuario, s.segredo, codigo); aoConcluir(); }
    catch (er) { setErro(mensagemErroAuth(er)); }
    finally { setEnviando(false); }
  }

  return (
    <form onSubmit={confirmar} className="grid gap-4" noValidate>
      <ol className="grid list-decimal gap-1 pl-5 text-sm">
        <li>Instale o <b>Google Authenticator</b> ou o <b>Microsoft Authenticator</b> no celular.</li>
        <li>No aplicativo, toque em “+” e leia o código abaixo.</li>
        <li>Digite os 6 números que aparecerem.</li>
      </ol>
      <div className="flex flex-wrap items-start gap-4">
        {s ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.qr} alt="Código QR para o aplicativo autenticador" width={160} height={160} className="rounded border border-[#C9D7DC]" />
        ) : falhaQr ? null : (
          <div className="grid h-40 w-40 place-items-center rounded border border-[#C9D7DC] text-sm text-gray-600" aria-live="polite">Gerando código…</div>
        )}
        {s && <p className="max-w-[24ch] text-sm text-gray-600">Sem câmera? Digite esta chave no aplicativo:<br /><b className="font-mono text-ink-900 tabular-nums">{s.chave}</b></p>}
      </div>
      {falhaQr && (
        <div className="grid gap-2">
          <Aviso tipo="erro">Não conseguimos gerar o código do aplicativo. {falhaQr}</Aviso>
          <Botao type="button" variante="discreto" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</Botao>
        </div>
      )}
      <Campo id="codigo" rotulo="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
        value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} erro={erro} />
      <Botao type="submit" carregando={enviando} disabled={!s}>Ativar e entrar</Botao>
    </form>
  );
}

/** Pedido do código no login. */
export function DesafioTotp({ aoConfirmar, aoVoltar }: { aoConfirmar: (codigo: string) => Promise<void>; aoVoltar?: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigoValido(codigo)) return setErro("Digite os 6 números que aparecem no aplicativo.");
    setEnviando(true); setErro("");
    try { await aoConfirmar(codigo); } catch (er) { setErro(mensagemErroAuth(er)); } finally { setEnviando(false); }
  }
  return (
    <form onSubmit={enviar} className="grid gap-4" noValidate>
      <Aviso>Abra o aplicativo autenticador no celular e digite o código do <b>Portal Propaga</b>.</Aviso>
      <Campo id="codigo2fa" rotulo="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
        value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} erro={erro} />
      <Botao type="submit" carregando={enviando}>Confirmar</Botao>
      {aoVoltar && <Botao type="button" variante="discreto" onClick={aoVoltar}>Voltar</Botao>}
      <p className="text-sm text-gray-600">Trocou de celular ou perdeu o aplicativo? Fale com o Atendimento da Propaga para liberar um novo cadastro.</p>
    </form>
  );
}
