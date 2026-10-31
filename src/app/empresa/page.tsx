"use client";
/* Cadastro da empresa (42 campos). No teste de avaliação, o Baixar dos posts só libera com tudo preenchido. */
import { useEffect, useState } from "react";
import { Protegido } from "@/components/auth/protegido";
import { Casca } from "@/components/casca";
import { useCadastro } from "@/components/avaliacao";
import { useClienteAtivo } from "@/components/cliente-ativo";
import { Aviso, Botao } from "@/components/ui";
import { CADASTRO, CAMPOS_CADASTRO, MAX_CAMPO_CADASTRO, preenchidos, type ValoresCadastro } from "@/content/cadastro";
import { useFila } from "@/lib/usarFila";

function Conteudo() {
  const { clienteId, cliente } = useClienteAtivo();
  const salvo = useCadastro();
  const enviar = useFila();
  const [v, setV] = useState<ValoresCadastro>({});
  const [pronto, setPronto] = useState(false);
  const [estado, setEstado] = useState<{ tipo: "ok" | "erro" | "aguardando"; msg: string } | null>(null);

  useEffect(() => { if (salvo !== undefined && !pronto) { setV(salvo ?? {}); setPronto(true); } }, [salvo, pronto]);
  const n = preenchidos(v), total = CAMPOS_CADASTRO.length;

  async function salvar() {
    setEstado({ tipo: "aguardando", msg: "Salvando…" });
    const r = await enviar("cadastro", { valores: Object.fromEntries(CAMPOS_CADASTRO.map((c) => [c.id, v[c.id] ?? ""])) });
    setEstado(r.ok ? { tipo: "ok", msg: `Cadastro salvo: ${(r.resultado as { preenchidos: number }).preenchidos} de ${total} campos.` } : { tipo: "erro", msg: r.msg });
  }

  if (!cliente.avaliacao) return <p className="text-gray-600">O cadastro da empresa vale para clientes em teste de avaliação.</p>;
  return (
    <div className="grid max-w-3xl gap-6">
      <p className="max-w-[70ch] text-gray-600">Conte à Propaga como é a empresa. Escreva só o que sabe; “não se aplica” vale como resposta. Os posts do teste só podem ser baixados com os {total} campos preenchidos.</p>
      <p className="font-display text-2xl font-semibold tabular-nums" aria-live="polite">{n} de {total} campos preenchidos</p>
      {CADASTRO.map((g) => (
        <fieldset key={g.titulo} className="grid gap-4 rounded border border-gray-200 bg-white p-5">
          <legend className="px-1 font-display text-lg font-semibold">{g.titulo}</legend>
          {g.campos.map((c) => (
            <div key={c.id} className="grid gap-1">
              <label htmlFor={`c-${c.id}`} className="font-semibold">{c.rotulo}</label>
              <span id={`a-${c.id}`} className="text-sm text-gray-600">{c.ajuda}</span>
              <textarea id={`c-${c.id}`} aria-describedby={`a-${c.id}`} rows={2} maxLength={MAX_CAMPO_CADASTRO} value={v[c.id] ?? ""}
                onChange={(e) => setV({ ...v, [c.id]: e.target.value })} className="min-h-11 w-full rounded border border-gray-300 p-2" />
            </div>
          ))}
        </fieldset>
      ))}
      {estado && <Aviso tipo={estado.tipo === "erro" ? "erro" : "ok"}>{estado.msg}</Aviso>}
      <Botao className="justify-self-start" carregando={estado?.tipo === "aguardando"} onClick={salvar}>Salvar cadastro</Botao>
    </div>
  );
}

export default function Empresa() {
  return <Protegido papeis={["solicitante", "atendimento", "admin"]}><Casca titulo="Empresa"><Conteudo /></Casca></Protegido>;
}
