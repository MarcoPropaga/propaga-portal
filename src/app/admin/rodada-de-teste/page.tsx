"use client";
/* Arquivar a rodada de testes (admin): tira os pedidos de teste do portal sem apagar nada; tudo fica guardado em arquivo/. */
import { useState } from "react";
import { Protegido } from "@/components/auth/protegido";
import { Casca } from "@/components/casca";
import { Aviso, Botao, Campo } from "@/components/ui";
import { useFila } from "@/lib/usarFila";

function Conteudo() {
  const enviar = useFila();
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);

  async function arquivar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setMsg(null);
    const r = await enviar("arquivarRodada", { confirmar: texto.trim() });
    setOcupado(false);
    if (!r.ok) { setMsg({ tipo: "erro", msg: r.msg }); return; }
    const n = Number(r.resultado?.arquivados ?? 0);
    setTexto("");
    setMsg({ tipo: "ok", msg: n ? `Rodada arquivada: ${n} registros guardados. O portal está vazio e o próximo pedido será BML-2026-0001.` : "Não havia nada a arquivar. O portal já está vazio." });
  }

  return (
    <Casca titulo="Arquivar rodada de testes">
      <div className="grid max-w-3xl gap-6">
        <p className="max-w-[70ch] text-gray-600">Use antes de começar uma nova rodada de testes. Os pedidos, valores, histórico, relatórios dos criativos e serviços incluídos na tabela saem do portal e ficam <b>guardados</b> numa área de arquivo, sem serem apagados. A numeração volta ao primeiro pedido e a tabela do criativo volta ao básico.</p>
        <div className="rounded border border-gray-200 bg-white p-5 text-sm">
          <p className="font-semibold">Não é alterado</p>
          <p className="mt-1 text-gray-600">Usuários e convites, equipe de criativos, tabela básica do criativo, catálogos e configurações.</p>
        </div>
        <form onSubmit={arquivar} className="grid gap-4 rounded border border-gray-200 bg-white p-5" noValidate>
          <Campo id="confirma" rotulo="Para confirmar, digite ARQUIVAR" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
          {msg && <Aviso tipo={msg.tipo}>{msg.msg}</Aviso>}
          <div><Botao type="submit" carregando={ocupado} disabled={texto.trim() !== "ARQUIVAR"}>Arquivar rodada de testes</Botao></div>
        </form>
      </div>
    </Casca>
  );
}

export default function RodadaDeTeste() {
  return <Protegido papeis={["admin"]}><Conteudo /></Protegido>;
}
