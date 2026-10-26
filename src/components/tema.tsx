"use client";
import { useEffect } from "react";
import { useSessao } from "@/components/auth/sessao";
import { clienteAtivo } from "@/content/clientes";
import { variaveisCss } from "@/lib/tema";

/** Aplica as cores do cliente ativo da sessão (sobre as cores padrão de globals.css). */
export function TemaCliente() {
  const { clienteId } = useSessao();
  useEffect(() => {
    const m = clienteAtivo(clienteId).marca;
    const raiz = document.documentElement;
    for (const [k, v] of Object.entries(variaveisCss(m))) raiz.style.setProperty(k, v);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", m.cores.escura);
  }, [clienteId]);
  return null;
}
