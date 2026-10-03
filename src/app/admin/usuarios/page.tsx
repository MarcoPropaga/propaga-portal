"use client";
import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db, avisarServidor } from "@/lib/firebase";
import { conviteSchema, PAPEIS_CLIENTE } from "@/lib/schemas";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Aviso, Botao, Campo } from "@/components/ui";
import { CLIENTES, NOMES_PAPEIS } from "@/content/clientes";

interface Usuario { id: string; nome: string; email: string; papel: string; clienteId: string | null; status: string }
type Estado = { tipo: "ocioso" } | { tipo: "aguardando"; id: string } | { tipo: "ok"; msg: string } | { tipo: "erro"; msg: string };

function Conteudo() {
  const s = useSessao();
  const [lista, setLista] = useState<Usuario[]>([]);
  const [form, setForm] = useState({ nome: "", email: "", papel: "solicitante", clienteId: "bmlog" });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<Estado>({ tipo: "ocioso" });

  async function carregar() {
    const snap = await getDocs(query(collection(db(), "usuarios"), orderBy("nome")));
    setLista(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Usuario, "id">) })));
  }
  useEffect(() => { carregar().catch(() => setEstado({ tipo: "erro", msg: "Não foi possível carregar a lista de usuários." })); }, []);

  // Acompanha o item da fila até o servidor concluir.
  useEffect(() => {
    if (estado.tipo !== "aguardando") return;
    return onSnapshot(doc(db(), "fila", estado.id), (d) => {
      const x = d.data() as { status: string; mensagem?: string } | undefined;
      if (x?.status === "ok") { setEstado({ tipo: "ok", msg: "Convite enviado. A pessoa recebe o e-mail em instantes." }); carregar(); }
      if (x?.status === "erro") setEstado({ tipo: "erro", msg: x.mensagem || "Não foi possível enviar o convite." });
    });
  }, [estado]);

  async function convidar(e: React.FormEvent, reenviar?: Usuario) {
    e.preventDefault();
    const dados = reenviar
      ? { nome: reenviar.nome, email: reenviar.email, papel: reenviar.papel, clienteId: reenviar.clienteId ?? undefined }
      : { ...form, clienteId: (PAPEIS_CLIENTE as readonly string[]).includes(form.papel) ? form.clienteId : undefined };
    const r = conviteSchema.safeParse(dados);
    if (!r.success) {
      setErros(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErros({});
    const ref = await addDoc(collection(db(), "fila"), {
      tipo: reenviar ? "reenviarConvite" : "convidar", uid: s.usuario!.uid, clienteId: r.data.clienteId ?? null,
      dados: { ...r.data, clienteId: r.data.clienteId ?? null }, status: "pendente", criadoEm: serverTimestamp(),
    });
    avisarServidor();
    setEstado({ tipo: "aguardando", id: ref.id });
    if (!reenviar) setForm({ ...form, nome: "", email: "" });
  }

  const cliente = (PAPEIS_CLIENTE as readonly string[]).includes(form.papel);
  return (
    <Casca titulo="Usuários">
      <div className="grid max-w-5xl gap-8">
        <p className="max-w-[70ch] text-gray-600">Só o administrador cadastra pessoas. O convite chega por e-mail com um link de uso único (válido por 1 hora) para criar a senha e ativar a verificação em duas etapas.</p>

        <form onSubmit={(e) => convidar(e)} className="grid gap-4 rounded border border-gray-200 bg-white p-5" noValidate>
          <h2 className="text-lg">Convidar pessoa</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="nome" rotulo="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} erro={erros.nome} />
            <Campo id="emailConvite" rotulo="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} erro={erros.email} />
            <div className="grid gap-1.5">
              <label htmlFor="papel" className="text-sm font-semibold">Perfil</label>
              <select id="papel" value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value })} className="min-h-11 rounded border border-[#D6D2CE] bg-white px-3">
                {Object.entries(NOMES_PAPEIS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {cliente && (
              <div className="grid gap-1.5">
                <label htmlFor="cliente" className="text-sm font-semibold">Cliente</label>
                <select id="cliente" value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} aria-describedby={erros.clienteId ? "cliente-erro" : undefined} className="min-h-11 rounded border border-[#D6D2CE] bg-white px-3">
                  {Object.values(CLIENTES).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                {erros.clienteId && <p id="cliente-erro" className="text-sm text-orange-700">{erros.clienteId}</p>}
              </div>
            )}
          </div>
          {estado.tipo === "aguardando" && <Aviso>Enviando convite… costuma levar poucos segundos (no máximo 1 minuto).</Aviso>}
          {estado.tipo === "ok" && <Aviso tipo="ok">{estado.msg}</Aviso>}
          {estado.tipo === "erro" && <Aviso tipo="erro">{estado.msg}</Aviso>}
          <Botao type="submit" className="justify-self-start" carregando={estado.tipo === "aguardando"}>Enviar convite</Botao>
        </form>

        <section className="grid gap-3">
          <h2 className="text-lg">Pessoas com acesso</h2>
          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#F1EEEA] text-left text-xs uppercase tracking-wide text-gray-600">
                <tr><th className="px-3 py-2.5">Pessoa</th><th className="px-3 py-2.5">Perfil</th><th className="px-3 py-2.5">Empresa</th><th className="px-3 py-2.5">Situação</th><th className="px-3 py-2.5"><span className="sr-only">Ações</span></th></tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id} className="border-t border-gray-200">
                    <td className="px-3 py-2.5"><b>{u.nome}</b><div className="text-gray-600">{u.email}</div></td>
                    <td className="px-3 py-2.5">{NOMES_PAPEIS[u.papel] ?? u.papel}</td>
                    <td className="px-3 py-2.5">{u.clienteId ? CLIENTES[u.clienteId]?.nome : "Propaga"}</td>
                    <td className="px-3 py-2.5">{u.status === "convidado" ? "Convite enviado" : u.status}</td>
                    <td className="px-3 py-2.5 text-right">{u.id !== s.usuario?.uid && <Botao variante="discreto" className="min-h-9 px-3 text-sm" onClick={(e) => convidar(e, u)}>Reenviar convite</Botao>}</td>
                  </tr>
                ))}
                {!lista.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-600">Nenhuma pessoa cadastrada ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Casca>
  );
}

export default function Usuarios() {
  return <Protegido papeis={["admin"]}><Conteudo /></Protegido>;
}
