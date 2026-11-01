"use client";
/* Início da área "Portal Propaga" (admin): lista simples de clientes e prospects. Daqui o admin entra no portal de cada um. */
import { Protegido } from "@/components/auth/protegido";
import { Casca } from "@/components/casca";
import { useClienteAtivo } from "@/components/cliente-ativo";
import { useSessao } from "@/components/auth/sessao";
import { CLIENTES } from "@/content/clientes";

function Linha({ id, prospect }: { id: string; prospect: boolean }) {
  const ativo = useClienteAtivo();
  const c = CLIENTES[id];
  return (
    <li className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <b className="block">{c.nome}</b>
        <span className="text-sm text-gray-600">{prospect ? "Prospect em teste de avaliação" : "Cliente contratado"}</span>
      </div>
      {prospect && <a href="/admin/prospeccao/" className="rounded border border-ink-900 px-3 py-2 text-sm font-semibold hover:bg-ink-900 hover:text-paper">Ver prospecção</a>}
      <a href={`/inicio/?cliente=${id}`} onClick={() => ativo.escolher(id)}
        className="rounded bg-marca-500 px-3 py-2 text-sm font-semibold text-on-marca hover:brightness-105">{prospect ? "Ver como portal" : "Abrir portal"}</a>
    </li>
  );
}

function Conteudo() {
  const s = useSessao();
  const nome = (s.usuario?.displayName || "").split(" ")[0];
  const ids = Object.keys(CLIENTES);
  const clientes = ids.filter((i) => !CLIENTES[i].avaliacao);
  const prospects = ids.filter((i) => !!CLIENTES[i].avaliacao);
  return (
    <Casca titulo={nome ? `Olá, ${nome}.` : "Olá."}>
      <div className="grid max-w-3xl gap-6">
        <section className="grid gap-3">
          <h2 className="text-lg">Clientes</h2>
          <ul className="grid gap-2">{clientes.map((i) => <Linha key={i} id={i} prospect={false} />)}</ul>
        </section>
        {prospects.length > 0 && (
          <section className="grid gap-3">
            <h2 className="text-lg">Prospecção</h2>
            <ul className="grid gap-2">{prospects.map((i) => <Linha key={i} id={i} prospect />)}</ul>
          </section>
        )}
      </div>
    </Casca>
  );
}

export default function PortalPropaga() {
  return <Protegido papeis={["admin"]}><Conteudo /></Protegido>;
}
