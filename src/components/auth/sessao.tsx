"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onIdTokenChanged, multiFactor, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { Papel } from "@/lib/tipos";

export interface Sessao {
  carregando: boolean;
  usuario: User | null;
  papel: Papel | null;
  clienteId: string | null;
  propaga: boolean;
  /** Tem fator TOTP cadastrado. */
  temSegundoFator: boolean;
  /** A sessão atual passou pelo segundo fator (exigido pelas regras do banco). */
  entrouComSegundoFator: boolean;
  sair: () => Promise<void>;
}

const Ctx = createContext<Sessao | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [s, set] = useState<Omit<Sessao, "sair">>({
    carregando: true, usuario: null, papel: null, clienteId: null, propaga: false,
    temSegundoFator: false, entrouComSegundoFator: false,
  });

  useEffect(() => onIdTokenChanged(auth(), async (u) => {
    if (!u) return set({ carregando: false, usuario: null, papel: null, clienteId: null, propaga: false, temSegundoFator: false, entrouComSegundoFator: false });
    const t = await u.getIdTokenResult();
    const fb = t.claims.firebase as { sign_in_second_factor?: string } | undefined;
    set({
      carregando: false, usuario: u,
      papel: (t.claims.papel as Papel) ?? null,
      clienteId: (t.claims.clienteId as string) ?? null,
      propaga: t.claims.propaga === true,
      temSegundoFator: multiFactor(u).enrolledFactors.length > 0,
      entrouComSegundoFator: !!fb?.sign_in_second_factor,
    });
  }), []);

  return <Ctx.Provider value={{ ...s, sair: () => signOut(auth()) }}>{children}</Ctx.Provider>;
}

export function useSessao(): Sessao {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSessao fora do SessaoProvider");
  return c;
}
