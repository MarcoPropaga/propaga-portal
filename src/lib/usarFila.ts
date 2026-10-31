"use client";
/* Envia uma ação para a fila e espera o servidor responder (ok/erro). */
import { useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { avisarServidor, db } from "@/lib/firebase";
import { useSessao } from "@/components/auth/sessao";
import type { PedidoDoc } from "@/components/pedido";
import type { Calendario } from "@/lib/publicacao";
import { useClienteAtivo } from "@/components/cliente-ativo";
import { CLIENTE_PADRAO } from "@/content/clientes";

export type Resposta = { ok: true; resultado?: Record<string, unknown> } | { ok: false; msg: string };

export function useFila() {
  const s = useSessao();
  const { clienteId } = useClienteAtivo();
  return async function enviar(tipo: "peca" | "publicacao" | "acao" | "relatorioCriativo" | "pagarCriativo" | "tabelaCriativo" | "arquivarRodada" | "avaliacao", dados: unknown): Promise<Resposta> {
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
/** Consulta dos pedidos: solicitante vê só os que originou (24/10/2026); sem o filtro as regras negam a leitura toda. */
export function pedidosDoUsuario(clienteId: string, papel: string | null | undefined, uid: string | undefined) {
  const base = collection(db(), "clientes", clienteId, "solicitacoes");
  if (papel === "solicitante" && uid) return query(base, where("solicitanteUid", "==", uid));
  // Criativo: só os pedidos atribuídos a ele (etapa 3a); pedido sem criativo aparece só depois do aceite.
  if (papel === "criativo" && uid) return query(base, where("criativoUid", "==", uid));
  return base;
}

/** `clienteFixo`: telas que valem para um cliente só (relatório do criativo, por enquanto só a B&M Log). */
export function usePedidos(ativo = true, clienteFixo?: string) {
  const s = useSessao();
  const { clienteId: ativoId } = useClienteAtivo();
  const clienteId = clienteFixo ?? ativoId;
  const [lista, setLista] = useState<PedidoDoc[] | null>(null);
  const [erro, setErro] = useState("");
  const uid = s.usuario?.uid;
  useEffect(() => {
    if (!ativo || !uid) return;
    const col = pedidosDoUsuario(clienteId, s.papel, uid);
    return onSnapshot(col,
      // Criativo vê só os pedidos atribuídos a ele (ou ainda sem criativo definido).
      (q) => setLista(q.docs.map((d) => d.data() as PedidoDoc).filter((p) => s.papel !== "criativo" || !p.criativo || p.criativo.uid === uid)),
      () => setErro("Não foi possível carregar os pedidos."));
  }, [ativo, clienteId, s.papel, uid]);
  return { lista, erro, clienteId };
}

/** Pedidos de todos os clientes a que a pessoa tem acesso (relatório e pagamento do criativo), cada um com o `clienteId`.
    Equipe vinculada: os clientes vinculados; sem nenhum, o cliente padrão. */
export function usePedidosDosClientes(ativo = true) {
  const s = useSessao();
  const { opcoes } = useClienteAtivo();
  const uid = s.usuario?.uid;
  const ids = (opcoes.length ? opcoes.map((c) => c.id) : [CLIENTE_PADRAO]);
  const chave = ids.join(",");
  const [por, setPor] = useState<Record<string, PedidoDoc[]>>({});
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!ativo || !uid) return;
    setPor({});
    const fins = chave.split(",").map((cid) => onSnapshot(pedidosDoUsuario(cid, s.papel, uid),
      (q) => setPor((a) => ({ ...a, [cid]: q.docs.map((d) => ({ ...(d.data() as PedidoDoc), clienteId: cid })).filter((p) => s.papel !== "criativo" || !p.criativo || p.criativo.uid === uid) })),
      () => setErro("Não foi possível carregar os pedidos.")));
    return () => fins.forEach((f) => f());
  }, [ativo, chave, s.papel, uid]);
  const prontos = chave.split(",").every((c) => por[c]);
  const lista = prontos ? chave.split(",").flatMap((c) => por[c]) : null;
  return { lista, erro };
}

/** Calendário de publicações (Kauan, Marcelo, Débora e admin), em tempo real. */
export function useCalendarios(ativo = true) {
  const s = useSessao();
  const { clienteId } = useClienteAtivo();
  const [cals, setCals] = useState<Calendario[]>([]);
  const ve = !!s.papel && ["solicitante", "atendimento", "midia_social", "admin"].includes(s.papel);
  useEffect(() => {
    if (!ativo || !ve || !s.usuario?.uid) return;
    return onSnapshot(collection(db(), "clientes", clienteId, "calendarios"),
      (q) => setCals(q.docs.map((d) => d.data() as Calendario)), () => setCals([]));
  }, [ativo, ve, clienteId, s.usuario?.uid]);
  return cals;
}
