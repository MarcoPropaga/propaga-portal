"use client";
/* Seleção de habilidades do criativo: até 2 primárias e as secundárias que ele topa fazer. */
import { useState } from "react";
import { HABILIDADES, MAX_PRIMARIAS } from "@/content/habilidades";
import type { PerfilHabilidades } from "@/lib/habilidades";
import { Botao } from "@/components/ui";

type Nivel = "primaria" | "secundaria" | "nao";
const ROTULO: Record<Nivel, string> = { primaria: "Primária", secundaria: "Secundária", nao: "Não faço" };

export function EditorHabilidades({ inicial, enviando, textoBotao, onSalvar, confirmavel }: {
  inicial?: PerfilHabilidades; enviando?: boolean; textoBotao: string; confirmavel?: boolean;
  onSalvar: (v: { primarias: string[]; secundarias: string[]; confirmar: boolean }) => void;
}) {
  const [nivel, setNivel] = useState<Record<string, Nivel>>(() => Object.fromEntries(HABILIDADES.map((h) =>
    [h.id, inicial?.primarias.includes(h.id) ? "primaria" : inicial?.secundarias.includes(h.id) ? "secundaria" : "nao"])));
  const [confirmar, setConfirmar] = useState(true);
  const primarias = HABILIDADES.filter((h) => nivel[h.id] === "primaria").map((h) => h.id);
  const secundarias = HABILIDADES.filter((h) => nivel[h.id] === "secundaria").map((h) => h.id);
  const erro = !primarias.length ? "Marque ao menos 1 habilidade primária." : primarias.length > MAX_PRIMARIAS ? `No máximo ${MAX_PRIMARIAS} habilidades primárias.` : "";

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!erro) onSalvar({ primarias, secundarias, confirmar }); }} className="grid gap-5" noValidate>
      <p className="max-w-[70ch] text-sm text-gray-600"><b>Primária</b> (até {MAX_PRIMARIAS}): é onde você recebe os pedidos por padrão. <b>Secundária</b>: você topa fazer, mas só quando o Atendimento indicar. As demais ficam como &ldquo;não faço&rdquo;.</p>
      {([true, false] as const).map((noCatalogo) => (
        <fieldset key={String(noCatalogo)} className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">{noCatalogo ? "Habilidades do catálogo atual" : "Outras habilidades (material novo, sob orçamento)"}</legend>
          {HABILIDADES.filter((h) => h.noCatalogo === noCatalogo).map((h) => (
            <div key={h.id} className="grid gap-2 rounded border border-gray-200 bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div><b id={`h-${h.id}`}>{h.nome}</b><div className="text-sm text-gray-600">{h.detalhe}</div></div>
              <div role="radiogroup" aria-labelledby={`h-${h.id}`} className="flex flex-wrap gap-2">
                {(["primaria", "secundaria", "nao"] as Nivel[]).map((n) => (
                  <label key={n} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border px-3 text-sm ${nivel[h.id] === n ? "border-ink-900 bg-paper font-semibold" : "border-[#C9D7DC] bg-white"}`}>
                    <input type="radio" name={`n-${h.id}`} className="size-4 accent-marca-700" checked={nivel[h.id] === n} onChange={() => setNivel({ ...nivel, [h.id]: n })} />
                    {ROTULO[n]}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ))}
      {confirmavel && (
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-marca-700" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} />
          Confirmar este perfil (libera a pré-seleção por habilidade)
        </label>
      )}
      <div role="status" aria-live="polite" className="text-sm text-alerta-700">{erro}</div>
      <Botao type="submit" className="justify-self-start" carregando={enviando} disabled={!!erro}>{textoBotao}</Botao>
    </form>
  );
}

export function ResumoHabilidades({ perfil }: { perfil?: PerfilHabilidades }) {
  if (!perfil) return <span className="text-gray-600">Ainda não informou</span>;
  const nome = (id: string) => HABILIDADES.find((h) => h.id === id)?.nome ?? id;
  return (
    <div className="grid gap-1">
      <div><b>Primárias:</b> {perfil.primarias.map(nome).join("; ")}</div>
      {!!perfil.secundarias.length && <div className="text-gray-600"><b>Secundárias:</b> {perfil.secundarias.map(nome).join("; ")}</div>}
      <div className={perfil.confirmado ? "text-[#1E7047]" : "text-alerta-700"}>{perfil.confirmado ? "✓ Confirmado pelo administrador" : "A confirmar pelo administrador"}</div>
    </div>
  );
}
