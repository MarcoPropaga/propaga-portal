"use client";
/* Envia uma ação para a fila e espera o servidor responder (ok/erro). */
import { useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { avisarServidor, db } from "@/lib/firebase";
import { useSessao } from "@/components/auth/sessao";
import { CLIENTES } from "@/content/clientes";
import type { PedidoDoc } from "@/components/pedido";
import type { Calendario } from "@/lib/publicacao";

export type Resposta = { ok: true; resultado?: Record<string, unknown> } | { ok: false; msg: string };

export function useFila() {
  const s = useSessao();
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  return async function enviar(tipo: "peca" | "publicacao" | "acao" | "relatorioCriativo" | "pagarCriativo" | "tabelaCriativo" | "arquivarRodada", dados: unknown): Promise<Resposta> {
    try {
      // Firestore não aceita undefined: remove campos vazios antes de gravar.
      const limpo = JSON.parse(JSON.stringify(dados));
      const ref = await addDoc(collection(db(), "fila"), { tipo, uid: s.usuario!.uid, clienteId, dados: limpo, status: "pendente", criadoEm: serverTimestamp() });
      avisarServidor();
      return await new Promise<Resposta>((ok) => {
        const fim = onSnapshot(doc(db(), "fila", ref.id), (d) => {
          const x = d.data() as { status: string; mensagem?: string; resultado?: Record<string, unknown> } | undefined;
          if (x?.status === "ok") { fim(); ok({ ok: true, resultado: x.resultado }); }
          if (x?.status === "erro") { fim(); ok({ ok: false, msg: x.mensagem || "Não foi possível registrar." }); }
        }, () => ok({ ok: false, msg: "Sem conexão com o portal." }));
      });
    } catch { return { ok: false, msg: "Não foi possível registrar. Verifique sua conexão." }; }
  };
}

/** Pedidos visíveis para o perfil (Solicitante: só os dela), em tempo real. */
export function usePedidos(ativo = true) {
  const s = useSessao();
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  const [lista, setLista] = useState<PedidoDoc[] | null>(null);
  const [erro, setErro] = useState("");
  const uid = s.usuario?.uid;
  useEffect(() => {
    if (!ativo || !uid) return;
    const col = collection(db(), "clientes", clienteId, "solicitacoes");
    return onSnapshot(s.papel === "solicitante" ? query(col, where("solicitanteUid", "==", uid)) : col,
      // Criativo vê só os pedidos atribuídos a ele (ou ainda sem criativo definido).
      (q) => setLista(q.docs.map((d) => d.data() as PedidoDoc).filter((p) => s.papel !== "criativo" || !p.criativo || p.criativo.uid === uid)),
      () => setErro("Não foi possível carregar os pedidos."));
  }, [ativo, clienteId, s.papel, uid]);
  return { lista, erro, clienteId };
}

/** Calendário de publicações (Kauan, Marcelo, Débora e admin), em tempo real. */
export function useCalendarios(ativo = true) {
  const s = useSessao();
  const clienteId = s.clienteId ?? Object.keys(CLIENTES)[0];
  const [cals, setCals] = useState<Calendario[]>([]);
  const ve = !!s.papel && ["solicitante", "atendimento", "midia_social", "admin"].includes(s.papel);
  useEffect(() => {
    if (!ativo || !ve || !s.usuario?.uid) return;
    return onSnapshot(collection(db(), "clientes", clienteId, "calendarios"),
      (q) => setCals(q.docs.map((d) => d.data() as Calendario)), () => setCals([]));
  }, [ativo, ve, clienteId, s.usuario?.uid]);
  return cals;
}
