"use client";
/* Prospecção (admin): clientes em teste de avaliação. Checklist de 7 itens, "Iniciar teste" (entrega o acesso) e decisão. */
import { useCallback, useEffect, useState } from "react";
import { Protegido } from "@/components/auth/protegido";
import { Casca } from "@/components/casca";
import { Aviso, Botao } from "@/components/ui";
import { CLIENTES } from "@/content/clientes";
import { brDataHora } from "@/components/pedido";
import { useFila } from "@/lib/usarFila";
import type { EstadoAvaliacao, FaseAvaliacao, ItemPronto } from "@/lib/avaliacao";

interface Resumo { fase: FaseAvaliacao; itens: ItemPronto[]; estado: (EstadoAvaliacao & { decididoEm?: string }) | null; pedidos: number; preparados: number }
const FASE: Record<FaseAvaliacao, string> = { nao_iniciada: "Em preparação", ativa: "Em teste", recusada: "Encerrado", contratado: "Virou cliente" };

function Cartao({ id }: { id: string }) {
  const c = CLIENTES[id], enviar = useFila();
  const [r, setR] = useState<Resumo | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [conf, setConf] = useState<"aceita" | "recusada" | null>(null);

  const rodar = useCallback(async (dados: Record<string, unknown>) => {
    setOcupado(true); setMsg(null);
    const res = await enviar("avaliacao", { clienteId: id, ...dados });
    setOcupado(false);
    if (!res.ok) { setMsg({ tipo: "erro", msg: res.msg }); return null; }
    return res.resultado ?? {};
  }, [enviar, id]);
  const atualizar = useCallback(async () => { const x = await rodar({ acao: "estado" }); if (x) setR(x as unknown as Resumo); }, [rodar]);
  useEffect(() => { atualizar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function marcar(item: string, ok: boolean) { const x = await rodar({ acao: "marcar", item, ok }); if (x) setR(x as unknown as Resumo); }
  async function iniciar() {
    const x = await rodar({ acao: "iniciar" });
    if (x) { setMsg({ tipo: "ok", msg: `Teste iniciado. ${Number(x.entregues) ? `${x.entregues} convite(s) enviado(s) agora (o link vale 1 hora).` : "Nenhum convite pendente."}` }); atualizar(); }
  }
  async function decidir(decisao: "aceita" | "recusada") {
    const x = await rodar({ acao: "decidir", decisao });
    setConf(null);
    if (x) { setMsg({ tipo: "ok", msg: decisao === "aceita" ? "Aceite registrado. O cliente passa a ver o catálogo completo, com preços." : "Teste encerrado. Novos pedidos ficam bloqueados." }); atualizar(); }
  }

  const prontos = r?.itens.filter((i) => i.ok).length ?? 0;
  return (
    <section className="grid gap-4 rounded border border-gray-200 bg-white p-5" aria-labelledby={`p-${id}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`p-${id}`} className="text-lg">{c.nome}</h2>
        {r && <span className="rounded-full bg-marca-100 px-3 py-1 text-xs font-semibold text-marca-900">{FASE[r.fase]}</span>}
      </div>
      {!r && !msg && <p className="text-gray-600" aria-busy="true">Carregando…</p>}
      {msg && <Aviso tipo={msg.tipo}>{msg.msg}</Aviso>}
      {r && <>
        {r.fase === "nao_iniciada" && <>
          <p className="text-sm text-gray-600">{prontos} de {r.itens.length} itens prontos. O botão libera quando os sete estiverem prontos. {r.preparados ? `${r.preparados} pessoa(s) cadastrada(s) aguardam o convite.` : "Cadastre as pessoas em Usuários, marcando “sem enviar o convite agora”."}</p>
          <ul className="grid gap-2">
            {r.itens.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-200 pt-2 text-sm">
                <span className={`inline-grid size-6 place-items-center rounded-full text-xs font-bold ${i.ok ? "bg-[#E3F2EA] text-[#1E7047]" : "bg-aviso-100 text-aviso-700"}`} aria-hidden="true">{i.ok ? "✓" : "!"}</span>
                <b className="min-w-36">{i.rotulo}</b><span className="text-gray-600">{i.ajuda}</span>
                <span className="sr-only">{i.ok ? "Pronto" : "Pendente"}</span>
                {!i.auto && <label className="ml-auto flex items-center gap-2"><input type="checkbox" className="size-4" checked={i.ok} disabled={ocupado} onChange={(e) => marcar(i.id, e.target.checked)} />Confirmado</label>}
                {i.auto && <span className="ml-auto text-xs text-gray-600">Conferido pelo portal</span>}
              </li>
            ))}
          </ul>
          <Botao className="justify-self-start" carregando={ocupado} disabled={prontos < r.itens.length} onClick={iniciar}>Iniciar teste</Botao>
        </>}
        {r.fase === "ativa" && r.estado && <>
          <dl className="grid grid-cols-[170px_1fr] gap-y-1 text-sm">
            <dt className="text-gray-600">Iniciado em</dt><dd>{brDataHora(r.estado.iniciadoEm)}</dd>
            <dt className="text-gray-600">Fim previsto</dt><dd>{brDataHora(r.estado.expiraEm)} (você recebe um aviso; nada é bloqueado)</dd>
            <dt className="text-gray-600">Pedidos usados</dt><dd>{r.pedidos} de {c.avaliacao?.maxPedidos}</dd>
          </dl>
          {conf ? (
            <div className="grid gap-3 rounded bg-aviso-100 p-4 text-sm text-aviso-700">
              <p>{conf === "aceita" ? "Confirmar o aceite? O cliente passa a ver o catálogo completo, com preços e sem limite de pedidos." : "Confirmar o encerramento? Novos pedidos ficam bloqueados."}</p>
              <div className="flex gap-2"><Botao onClick={() => decidir(conf)} carregando={ocupado}>Confirmar</Botao><Botao variante="discreto" onClick={() => setConf(null)}>Voltar</Botao></div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Botao onClick={() => setConf("aceita")}>A DalPet aceitou a proposta</Botao>
              <Botao variante="linha" onClick={() => setConf("recusada")}>Encerrar o teste</Botao>
            </div>
          )}
        </>}
        {(r.fase === "recusada" || r.fase === "contratado") && r.estado && <p className="text-sm text-gray-600">Decisão registrada{r.estado.decididoEm ? ` em ${brDataHora(r.estado.decididoEm)}` : ""}. {r.pedidos} pedido(s) de avaliação.</p>}
      </>}
    </section>
  );
}

function Conteudo() {
  const ids = Object.values(CLIENTES).filter((c) => c.avaliacao).map((c) => c.id);
  return (
    <Casca titulo="Prospecção">
      <div className="grid max-w-4xl gap-5">
        <p className="max-w-[70ch] text-gray-600">Empresas em teste de avaliação. Você cadastra tudo, confirma os sete itens e clica em <b>Iniciar teste</b>: é aí que o acesso chega às pessoas. No fim previsto você recebe um aviso e decide.</p>
        {ids.map((id) => <Cartao key={id} id={id} />)}
        {!ids.length && <p className="text-gray-600">Nenhum prospect cadastrado.</p>}
      </div>
    </Casca>
  );
}

export default function Prospeccao() {
  return <Protegido papeis={["admin"]}><Conteudo /></Protegido>;
}
