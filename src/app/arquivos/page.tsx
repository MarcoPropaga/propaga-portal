"use client";
/* Arquivos no Drive: pasta de cada pedido (os arquivos ficam no Drive compartilhado do cliente; o portal guarda os links). */
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Aviso } from "@/components/ui";
import { SeloStatus, type PedidoDoc } from "@/components/pedido";
import { CLIENTES } from "@/content/clientes";

const ms = (v: unknown) => (v && typeof v === "object" && "toMillis" in v ? (v as { toMillis: () => number }).toMillis() : 0);

function Conteudo() {
  const s = useSessao();
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  const [lista, setLista] = useState<PedidoDoc[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const col = collection(db(), "clientes", clienteId, "solicitacoes");
    const q = s.papel === "solicitante" ? query(col, where("solicitanteUid", "==", s.usuario!.uid)) : col;
    return onSnapshot(q, (snap) => setLista(snap.docs.map((d) => d.data() as PedidoDoc).filter((p) => p.status !== "cancelada").sort((a, b) => ms(b.criadoEm) - ms(a.criadoEm))),
      () => setErro("Não foi possível carregar as pastas."));
  }, [clienteId, s.papel, s.usuario]);

  return (
    <Casca titulo="Arquivos no Drive">
      <div className="grid max-w-5xl gap-4">
        <p className="max-w-[75ch] text-gray-600">Cada solicitação tem uma pasta no Drive compartilhado da {CLIENTES[clienteId].nome}. O portal guarda os links; os arquivos ficam no Drive.</p>
        <p className="rounded bg-[#EAF3F5] px-4 py-3 text-sm leading-relaxed">Estrutura padrão por pedido: <b>01 Briefing</b>, <b>02 Materiais</b>, <b>03 Provas</b> e <b>04 Aprovados</b>. Compartilhe só com o grupo da Propaga, nunca com link público.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {!lista && !erro && <p className="text-gray-600" aria-busy="true">Carregando…</p>}
        {lista && (
          <div className="relative overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600">
                <tr><th className="px-3 py-2.5">Protocolo</th><th className="px-3 py-2.5">Solicitação</th><th className="px-3 py-2.5">Pasta</th><th className="px-3 py-2.5">Acesso</th></tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.protocolo} className="border-t border-gray-200">
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold"><a className="underline-offset-4 hover:underline" href={`/solicitacoes/pedido/?p=${encodeURIComponent(p.protocolo)}`}>{p.protocolo}</a></td>
                    <td className="px-3 py-2.5">{p.titulo}<div className="mt-1"><SeloStatus status={p.status} /></div></td>
                    <td className="px-3 py-2.5"><a href={p.drive.link} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">Abrir pasta<span className="sr-only"> de {p.protocolo} (abre em nova aba)</span></a></td>
                    <td className="px-3 py-2.5">{p.drive.verificado
                      ? <span className="rounded-full bg-[#E3F2EA] px-2.5 py-0.5 text-xs font-semibold text-[#1E7047]">Conferido pela Propaga</span>
                      : <span className="rounded-full bg-aviso-100 px-2.5 py-0.5 text-xs font-semibold text-aviso-700">A conferir</span>}</td>
                  </tr>
                ))}
                {!lista.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-600">Nenhuma pasta ainda. Elas aparecem aqui quando você envia uma solicitação.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Casca>
  );
}

export default function Arquivos() {
  return <Protegido><Conteudo /></Protegido>;
}
