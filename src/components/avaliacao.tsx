"use client";
/* Faixa do teste no Início de quem é do prospect: pedidos usados (sem relógio; o fim é avisado ao admin). */
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSessao } from "@/components/auth/sessao";
import { useClienteAtivo } from "@/components/cliente-ativo";
import { usePedidos } from "@/lib/usarFila";
import { faseAvaliacao, MSG_AVALIACAO, travaDownload, type EstadoAvaliacao, type MotivoTrava } from "@/lib/avaliacao";
import { cadastroCompleto, type ValoresCadastro } from "@/content/cadastro";

export function FaixaAvaliacao() {
  const s = useSessao();
  const { clienteId, cliente } = useClienteAtivo();
  const cfg = cliente.avaliacao;
  const [estado, setEstado] = useState<EstadoAvaliacao | null | undefined>(undefined);
  const doCliente = !s.propaga && s.clienteId === clienteId;
  const { lista } = usePedidos(!!cfg && doCliente);

  useEffect(() => {
    if (!cfg || !doCliente) return;
    return onSnapshot(doc(db(), "clientes", clienteId, "avaliacao", "estado"),
      (d) => setEstado(d.exists() ? (d.data() as EstadoAvaliacao) : null), () => setEstado(null));
  }, [cfg, doCliente, clienteId]);

  if (!cfg || !doCliente || estado === undefined) return null;
  const fase = faseAvaliacao(cfg, estado);
  if (fase === "contratado") return null;
  const usados = (lista ?? []).filter((p) => p.avaliacao).length;
  return (
    <section className="grid gap-1.5 rounded border border-marca-500 bg-marca-100 p-5" aria-label="Teste de 48 horas">
      <span className="text-xs font-semibold uppercase tracking-wide text-marca-700">Teste de {cfg.horas} horas</span>
      {fase === "ativa"
        ? <p className="font-display text-2xl font-semibold tabular-nums">{usados} de {cfg.maxPedidos} pedidos usados</p>
        : <p className="text-sm">{MSG_AVALIACAO[fase]}</p>}
      <p className="text-sm text-gray-600">Cada pedido tem um post e conta mesmo sem aprovação. Não há valores no teste.</p>
    </section>
  );
}

/** Cadastro da empresa do cliente ativo (undefined = carregando; null = ainda não salvo). */
export function useCadastro(): ValoresCadastro | null | undefined {
  const { clienteId, cliente } = useClienteAtivo();
  const [v, setV] = useState<ValoresCadastro | null | undefined>(undefined);
  useEffect(() => {
    if (!cliente.avaliacao) return;
    return onSnapshot(doc(db(), "clientes", clienteId, "cadastro", "dados"),
      (d) => setV(d.exists() ? ((d.data() as { valores?: ValoresCadastro }).valores ?? {}) : null), () => setV(null));
  }, [cliente.avaliacao, clienteId]);
  return cliente.avaliacao ? v : null;
}

/** Trava do Baixar para quem é do prospect: motivo, ou null se liberado. Equipe Propaga e clientes normais nunca travam. */
export function useTravaDownload(): MotivoTrava | null {
  const s = useSessao();
  const { clienteId, cliente } = useClienteAtivo();
  const cfg = cliente.avaliacao;
  const doCliente = !s.propaga && s.clienteId === clienteId;
  const [estado, setEstado] = useState<EstadoAvaliacao | null | undefined>(undefined);
  const cad = useCadastro();
  useEffect(() => {
    if (!cfg || !doCliente) return;
    return onSnapshot(doc(db(), "clientes", clienteId, "avaliacao", "estado"),
      (d) => setEstado(d.exists() ? (d.data() as EstadoAvaliacao) : null), () => setEstado(null));
  }, [cfg, doCliente, clienteId]);
  if (!cfg || !doCliente) return null;
  if (estado === undefined || cad === undefined) return "cadastro"; // enquanto carrega, não libera
  return travaDownload(cfg, estado, cadastroCompleto(cad), new Date());
}
