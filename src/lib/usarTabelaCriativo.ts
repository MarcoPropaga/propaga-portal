"use client";
/* Tabela dos criativos (criativo/tabela) e serviços acordados (criativo/adicionais): só os criativos e o administrador leem (firestore.rules). */
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AdicionaisCriativo, TabelaCriativo } from "@/lib/criativo";

export function useTabelaCriativo() {
  const [tab, setTab] = useState<TabelaCriativo | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => onSnapshot(doc(db(), "criativo", "tabela"),
    (d) => (d.exists() ? (setTab(d.data() as TabelaCriativo), setErro("")) : setErro("A tabela ainda não foi publicada. Fale com o Marco.")),
    () => setErro("Não foi possível carregar a tabela.")), []);
  return { tab, erro };
}
export function useAdicionais() {
  const [ad, setAd] = useState<AdicionaisCriativo | null>(null);
  useEffect(() => onSnapshot(doc(db(), "criativo", "adicionais"),
    (d) => setAd({ itens: [], mapa: {}, propostas: [], ...((d.data() ?? {}) as Partial<AdicionaisCriativo>) }),
    () => setAd({ itens: [], mapa: {}, propostas: [] })), []);
  return ad;
}
export const moeda = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
