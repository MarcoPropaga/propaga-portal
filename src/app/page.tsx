"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "@/components/auth/sessao";

export default function Raiz() {
  const s = useSessao();
  const router = useRouter();
  useEffect(() => {
    if (!s.carregando) router.replace(s.usuario && s.entrouComSegundoFator ? "/inicio/" : "/entrar/");
  }, [s.carregando, s.usuario, s.entrouComSegundoFator, router]);
  return <main className="grid min-h-screen place-items-center text-gray-600" aria-busy="true">Carregando…</main>;
}
