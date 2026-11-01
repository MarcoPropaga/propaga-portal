"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSessao } from "@/components/auth/sessao";
import { CLIENTES, CLIENTE_PADRAO, type Cliente } from "@/content/clientes";
import { clientesPermitidos, escolherCliente } from "@/lib/clienteAtivo";

/* Cliente em que a pessoa está trabalhando.
   - Quem é do cliente (Marketing, Financeiro do cliente) trabalha sempre no próprio cliente.
   - A equipe Propaga escolhe no menu, só entre os clientes a que está vinculada (admin e Financeiro Propaga: todos).
   A regra de acesso de verdade está nas regras do banco e no servidor; aqui é só a escolha na tela. */

const CHAVE = "portal.clienteAtivo";
const lerEscolha = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
const gravarEscolha = (id: string) => { try { localStorage.setItem(CHAVE, id); } catch { /* sem armazenamento: vale só nesta tela */ } };

export interface ClienteAtivo {
  clienteId: string;
  cliente: Cliente;
  /** Clientes entre os quais a pessoa pode escolher (equipe Propaga). */
  opcoes: Cliente[];
  escolher: (id: string) => void;
}

const Ctx = createContext<ClienteAtivo | null>(null);

export function ClienteAtivoProvider({ children }: { children: ReactNode }) {
  const s = useSessao();
  const [vinculos, setVinculos] = useState<string[] | null>(null);
  const [escolha, setEscolha] = useState<string | null>(null);
  const uid = s.usuario?.uid;
  const limitado = s.propaga && ["atendimento", "criativo", "midia_social"].includes(s.papel ?? "");

  useEffect(() => { setEscolha(lerEscolha()); }, []); // depois de montar, para não divergir do HTML estático
  useEffect(() => {
    if (!uid || !limitado) { setVinculos(null); return; }
    return onSnapshot(doc(db(), "usuarios", uid),
      (d) => { const c = d.data()?.clientes; setVinculos(Array.isArray(c) ? (c as string[]) : []); },
      () => setVinculos([]));
  }, [uid, limitado]);

  const permitidos = clientesPermitidos({ clienteId: s.clienteId, propaga: s.propaga, limitado, vinculos }, Object.keys(CLIENTES));
  const clienteId = escolherCliente(permitidos, escolha, CLIENTE_PADRAO);
  const valor: ClienteAtivo = {
    clienteId,
    cliente: CLIENTES[clienteId],
    opcoes: s.propaga ? permitidos.map((c) => CLIENTES[c]).filter((c) => !c.oculto) : [],
    escolher: (id) => { if (permitidos.includes(id)) { gravarEscolha(id); setEscolha(id); } },
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useClienteAtivo(): ClienteAtivo {
  const c = useContext(Ctx);
  if (!c) throw new Error("useClienteAtivo fora do ClienteAtivoProvider");
  return c;
}
