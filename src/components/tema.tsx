"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useClienteAtivo } from "@/components/cliente-ativo";
import { useSessao } from "@/components/auth/sessao";
import { MARCA_PROPAGA } from "@/content/clientes";
import { areaDe } from "@/lib/area";
import { aplicarMarca, variaveisCss } from "@/lib/tema";

/** Marca exibida agora: a da Propaga na área Propaga do admin; senão a do cliente ativo. */
export function useMarcaExibida() {
  const { cliente } = useClienteAtivo();
  const s = useSessao();
  const caminho = usePathname() ?? "";
  return areaDe(s.papel, caminho) === "propaga" ? MARCA_PROPAGA : cliente.marca;
}

/** Aplica as cores do cliente ativo da sessão (sobre as cores padrão de globals.css). */
export function TemaCliente() {
  const m = useMarcaExibida();
  useEffect(() => {
    const raiz = document.documentElement;
    for (const [k, v] of Object.entries(variaveisCss(m))) raiz.style.setProperty(k, v);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", m.cores.escura);
    // Nome ao adicionar à tela inicial (iOS lê esta meta no momento de adicionar).
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", m.nomeCurto);
  }, [m]);
  return null;
}

/** Marca do cliente da sessão (padrão antes do login). */
export function useMarca() {
  return useMarcaExibida();
}

/** Função que aplica o nome do cliente da sessão aos textos com {cliente} / {equipe}. */
export function useTxt() {
  const m = useMarca();
  return (texto: string) => aplicarMarca(texto, m);
}
