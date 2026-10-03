"use client";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Aviso, Botao, Campo, TelaAcesso } from "@/components/ui";

export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErro("Digite um e-mail válido.");
    setEnviando(true); setErro("");
    try { await sendPasswordResetEmail(auth(), email.trim(), { url: `${window.location.origin}/entrar/` }); }
    catch { /* mesma resposta para qualquer e-mail */ }
    setEnviado(true); setEnviando(false);
  }

  return (
    <TelaAcesso titulo="Recuperar senha" subtitulo="Enviamos um link para criar uma nova senha." voltar={{ href: "/entrar/", rotulo: "Voltar para entrar" }}>
      {enviado ? (
        <Aviso tipo="ok">Se este e-mail tiver acesso ao portal, o link chega em instantes. Ele vale por 1 hora. Confira também a caixa de spam.</Aviso>
      ) : (
        <form onSubmit={enviar} className="grid gap-4" noValidate>
          <Campo id="email" rotulo="E-mail cadastrado" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={erro} />
          <Botao type="submit" carregando={enviando}>Enviar link</Botao>
        </form>
      )}
    </TelaAcesso>
  );
}
