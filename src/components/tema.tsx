"use client";
import { useEffect } from "react";
import { useClienteAtivo } from "@/components/cliente-ativo";
import { aplicarMarca, variaveisCss } from "@/lib/tema";

/** Aplica as cores do cliente ativo da sessão (sobre as cores padrão de globals.css). */
export function TemaCliente() {
  const { cliente } = useClienteAtivo();
  useEffect(() => {
    const m = cliente.marca;
    const raiz = document.documentElement;
    for (const [k, v] of Object.entries(variaveisCss(m))) raiz.style.setProperty(k, v);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", m.cores.escura);
    // Nome ao adicionar à tela inicial (iOS lê esta meta no momento de adicionar).
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", m.nomeCurto);
  }, [cliente]);
  return null;
}

/** Marca do cliente da sessão (padrão antes do login). */
export function useMarca() {
  return useClienteAtivo().cliente.marca;
}

/** Função que aplica o nome do cliente da sessão aos textos com {cliente} / {equipe}. */
export function useTxt() {
  const m = useMarca();
  return (texto: string) => aplicarMarca(texto, m);
}
