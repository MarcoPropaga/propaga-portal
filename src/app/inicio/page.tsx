"use client";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { CLIENTES, NOMES_PAPEIS } from "@/content/clientes";

const MODULOS = ["Nova solicitação", "Solicitações", "Valores", "Relatórios", "Contrato", "Arquivos no Drive"];

function Conteudo() {
  const s = useSessao();
  const nome = (s.usuario?.displayName || "").split(" ")[0];
  return (
    <Casca titulo={nome ? `Olá, ${nome}.` : "Olá."}>
      <div className="grid max-w-3xl gap-6">
        <section className="grid gap-2 rounded border border-gray-200 bg-white p-5">
          <h2 className="text-lg">Seu acesso</h2>
          <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-gray-600">Perfil</dt><dd>{s.papel ? NOMES_PAPEIS[s.papel] : "—"}</dd>
            <dt className="text-gray-600">Empresa</dt><dd>{s.propaga ? "Propaga" : (s.clienteId && CLIENTES[s.clienteId]?.nome) || "—"}</dd>
            <dt className="text-gray-600">Segurança</dt><dd className="text-[#1E7047]">Verificação em duas etapas ativa</dd>
          </dl>
        </section>
        <section className="grid gap-3">
          <h2 className="text-lg">Em implantação</h2>
          <p className="text-sm text-gray-600">Os módulos abaixo entram no portal nas próximas etapas, já validados na prévia.</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODULOS.map((m) => <li key={m} className="rounded border border-dashed border-[#D6D2CE] px-4 py-3 text-sm text-gray-600">{m}</li>)}
          </ul>
        </section>
      </div>
    </Casca>
  );
}

export default function Inicio() {
  return <Protegido><Conteudo /></Protegido>;
}
