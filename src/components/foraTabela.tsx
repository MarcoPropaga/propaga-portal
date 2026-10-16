"use client";
/* Serviço fora da tabela do criativo (Marco, 15/10/2026): o criativo propõe o valor; o admin aprova e o serviço entra na tabela. */
import { useState } from "react";
import { Aviso, Botao } from "@/components/ui";
import type { PedidoDoc } from "@/components/pedido";
import { chaveServico, foraDaTabela, NOME_COLUNA, REGRA_FORA_TABELA, type Coluna } from "@/lib/criativo";
import { useFila } from "@/lib/usarFila";
import { moeda, useAdicionais, useTabelaCriativo } from "@/lib/usarTabelaCriativo";

const cx = "min-h-11 w-full rounded border border-[#C9D7DC] bg-white px-3";
const numero = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));

/** Chaves dos serviços do pedido que ainda não têm valor aprovado na tabela do criativo (bloqueiam o envio das peças). */
export function useServicosForaTabela(pd: PedidoDoc): string[] {
  const { tab } = useTabelaCriativo();
  const ad = useAdicionais();
  if (!tab || !ad) return [];
  return pd.itens.map((it) => chaveServico(it)).filter((c, i, a) => foraDaTabela(tab, c) && a.indexOf(c) === i);
}

/** Botão de enviar as peças criadas: fica desativado enquanto houver serviço do pedido sem valor aprovado. */
export function BotaoEnviarCriadas({ pd, onClick }: { pd: PedidoDoc; onClick: () => void }) {
  const fora = useServicosForaTabela(pd);
  return <Botao onClick={onClick} disabled={fora.length > 0} title={fora.length ? "Aguarde a aprovação do valor do serviço fora da tabela." : undefined}>Enviar peças criadas ao Marcelo</Botao>;
}

export function ServicosForaTabela({ pd }: { pd: PedidoDoc }) {
  const { tab } = useTabelaCriativo();
  const ad = useAdicionais();
  if (!tab || !ad) return null;
  const vistos = new Set<string>();
  const fora = pd.itens.map((it, i) => ({ it, i, chave: chaveServico(it) }))
    .filter((x) => foraDaTabela(tab, x.chave) && !vistos.has(x.chave) && vistos.add(x.chave));
  if (!fora.length) return null;
  return (
    <div className="grid gap-3 rounded border border-marca-500 bg-marca-100/40 p-3">
      <p className="text-sm"><b>Serviço fora da sua tabela.</b> {REGRA_FORA_TABELA}</p>
      {fora.map(({ it, i, chave }) => {
        const props = ad.propostas.filter((x) => x.chave === chave);
        const pend = props.find((x) => x.status === "pendente");
        const recusada = [...props].reverse().find((x) => x.status === "recusada");
        return (
          <div key={chave} className="grid gap-2 rounded border border-gray-200 bg-white p-3">
            <p className="text-sm font-semibold">{it.nome}{it.varianteRotulo ? ` · ${it.varianteRotulo}` : ""}</p>
            {pend ? <p className="text-sm text-gray-600">Proposta enviada: <b>{pend.nome}</b> · {NOME_COLUNA[pend.coluna]} · {moeda(pend.valor)}. Aguardando aprovação da administração.</p>
              : <>
                {recusada && <p className="text-sm text-alerta-700">Proposta de {moeda(recusada.valor)} não aprovada: {recusada.motivo}</p>}
                <Propor protocolo={pd.protocolo} item={i} nomeInicial={`${it.nome}${it.varianteRotulo ? ` · ${it.varianteRotulo}` : ""}`} coluna={tab.mapa[chave]?.coluna ?? "nova"} />
              </>}
          </div>
        );
      })}
    </div>
  );
}

function Propor({ protocolo, item, nomeInicial, coluna: col0 }: { protocolo: string; item: number; nomeInicial: string; coluna: Coluna }) {
  const enviar = useFila();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(nomeInicial);
  const [coluna, setColuna] = useState<Coluna>(col0);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = `pr-${protocolo}-${item}`;
  if (!aberto) return <Botao variante="linha" className="w-fit" onClick={() => setAberto(true)}>Propor valor para este serviço</Botao>;
  async function ok() {
    const v = numero(valor);
    if (!(v > 0)) { setMsg({ tipo: "erro", msg: "Informe o valor." }); return; }
    setOcupado(true); setMsg(null);
    const r = await enviar("tabelaCriativo", { acao: "propor", protocolo, item, nome: nome.trim(), coluna, valor: v, obs: obs.trim() || undefined });
    setOcupado(false);
    setMsg(r.ok ? { tipo: "ok", msg: "Proposta enviada. A administração da Propaga foi avisada." } : { tipo: "erro", msg: r.msg });
  }
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_180px_160px]">
      <div className="grid gap-1.5"><label htmlFor={`${id}-n`} className="text-sm">Nome do serviço na sua tabela</label><input id={`${id}-n`} value={nome} maxLength={90} onChange={(e) => setNome(e.target.value)} className={cx} /></div>
      <div className="grid gap-1.5"><label htmlFor={`${id}-c`} className="text-sm">Tipo</label>
        <select id={`${id}-c`} value={coluna} onChange={(e) => setColuna(e.target.value as Coluna)} className={cx}><option value="nova">Nova criação</option><option value="adaptacao">Adaptação</option></select></div>
      <div className="grid gap-1.5"><label htmlFor={`${id}-v`} className="text-sm">Valor por peça (R$)</label><input id={`${id}-v`} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={`${cx} text-right`} /></div>
      <div className="grid gap-1.5 sm:col-span-3"><label htmlFor={`${id}-o`} className="text-sm">Observação (opcional)</label><input id={`${id}-o`} value={obs} maxLength={300} onChange={(e) => setObs(e.target.value)} className={cx} /></div>
      {msg && <div className="sm:col-span-3"><Aviso tipo={msg.tipo}>{msg.msg}</Aviso></div>}
      <div className="flex flex-wrap gap-3 sm:col-span-3"><Botao onClick={ok} carregando={ocupado}>Enviar proposta</Botao><Botao variante="discreto" onClick={() => setAberto(false)}>Fechar</Botao></div>
    </div>
  );
}
