"use client";
/* Tabela da Mariane (criativo/tabela): só ela e o administrador conseguem ler (firestore.rules). */
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TabelaCriativo } from "@/lib/criativo";

export function useTabelaCriativo() {
  const [tab, setTab] = useState<TabelaCriativo | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    getDoc(doc(db(), "criativo", "tabela"))
      .then((d) => (d.exists() ? setTab(d.data() as TabelaCriativo) : setErro("A tabela ainda não foi publicada. Fale com o Marco.")))
      .catch(() => setErro("Não foi possível carregar a tabela."));
  }, []);
  return { tab, erro };
}
export const moeda = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
