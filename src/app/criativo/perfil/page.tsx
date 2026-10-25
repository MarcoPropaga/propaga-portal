"use client";
/* Meu perfil (criativo): habilidades primárias e secundárias. O administrador confirma depois. */
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Aviso } from "@/components/ui";
import { EditorHabilidades, ResumoHabilidades } from "@/components/habilidades";
import type { PerfilHabilidades } from "@/lib/habilidades";
import { useFila } from "@/lib/usarFila";

function Conteudo() {
  const s = useSessao();
  const enviar = useFila();
  const [perfil, setPerfil] = useState<PerfilHabilidades | undefined | null>(null);
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const uid = s.usuario?.uid;

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db(), "usuarios", uid), (d) => setPerfil((d.data() as { habilidades?: PerfilHabilidades } | undefined)?.habilidades),
      () => setPerfil(undefined));
  }, [uid]);

  async function salvar(v: { primarias: string[]; secundarias: string[] }) {
    setEnviando(true); setMsg(null);
    const r = await enviar("habilidades", { primarias: v.primarias, secundarias: v.secundarias });
    setEnviando(false);
    if (r.ok) { setEditando(false); setMsg({ tipo: "ok", texto: "Perfil salvo. O administrador vai confirmar." }); }
    else setMsg({ tipo: "erro", texto: r.msg });
  }

  const mostrarEditor = perfil !== null && (editando || !perfil);
  return (
    <Casca titulo="Meu perfil">
      <div className="grid max-w-4xl gap-6">
        <p className="max-w-[70ch] text-gray-600">Informe os tipos de material que você faz. Isso ajuda o Atendimento a indicar os pedidos certos para você.</p>
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
        {perfil === null && <p className="text-gray-600">Carregando…</p>}
        {perfil && !editando && (
          <section className="grid gap-4 rounded border border-gray-200 bg-white p-5">
            <ResumoHabilidades perfil={perfil} />
            <button type="button" onClick={() => { setMsg(null); setEditando(true); }} className="justify-self-start text-sm font-semibold text-marca-700 underline-offset-2 hover:underline">Alterar habilidades</button>
            {perfil.confirmado && <p className="text-sm text-gray-600">Ao alterar, o perfil volta para confirmação do administrador.</p>}
          </section>
        )}
        {mostrarEditor && <EditorHabilidades inicial={perfil ?? undefined} enviando={enviando} textoBotao="Salvar perfil" onSalvar={salvar} />}
      </div>
    </Casca>
  );
}

export default function Perfil() {
  return <Protegido papeis={["criativo"]}><Conteudo /></Protegido>;
}
