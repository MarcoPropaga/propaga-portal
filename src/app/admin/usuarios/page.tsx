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
import { ehVinculado } from "@/lib/vinculos";
import { useTxt } from "@/components/tema";

interface Usuario { id: string; nome: string; email: string; papel: string; clienteId: string | null; status: string; clientes?: string[] }
type Acesso = { senha: boolean; doisFatores: boolean; ultimoAcesso: string | null };
type Estado = { tipo: "ocioso" } | { tipo: "aguardando"; id: string } | { tipo: "ok"; msg: string } | { tipo: "erro"; msg: string };

function Conteudo() {
  const t = useTxt();
  const s = useSessao();
  const [lista, setLista] = useState<Usuario[]>([]);
  const [form, setForm] = useState({ nome: "", email: "", papel: "solicitante", clienteId: "bmlog", adiar: false });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<Estado>({ tipo: "ocioso" });

  const [acessos, setAcessos] = useState<Record<string, Acesso> | null>(null);
  const [erroAcessos, setErroAcessos] = useState(false);

  async function carregar() {
    const snap = await getDocs(query(collection(db(), "usuarios"), orderBy("nome")));
    setLista(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Usuario, "id">) })));
    carregarAcessos();
  }

  // Situação de acesso vem do cadastro de login (só o servidor consulta): senha criada, verificação e último acesso.
  async function carregarAcessos() {
    setErroAcessos(false);
    try {
      const ref = await addDoc(collection(db(), "fila"), { tipo: "acessos", uid: s.usuario!.uid, clienteId: null, dados: {}, status: "pendente", criadoEm: serverTimestamp() });
      avisarServidor();
      const fim = onSnapshot(doc(db(), "fila", ref.id), (d) => {
        const x = d.data() as { status: string; resultado?: { acessos?: Record<string, Acesso> } } | undefined;
        if (x?.status === "ok") { fim(); setAcessos(x.resultado?.acessos ?? {}); }
        if (x?.status === "erro") { fim(); setErroAcessos(true); }
      }, () => setErroAcessos(true));
    } catch { setErroAcessos(true); }
  }
  useEffect(() => { carregar().catch(() => setEstado({ tipo: "erro", msg: "Não foi possível carregar a lista de usuários." })); }, []);

  // Acompanha o item da fila até o servidor concluir.
  useEffect(() => {
    if (estado.tipo !== "aguardando") return;
    return onSnapshot(doc(db(), "fila", estado.id), (d) => {
      const x = d.data() as { status: string; mensagem?: string } | undefined;
      if (x?.status === "ok") { setEstado({ tipo: "ok", msg: form.adiar ? "Pessoa cadastrada, sem convite. O e-mail sai no Iniciar teste." : "Convite enviado. A pessoa recebe o e-mail em instantes." }); carregar(); }
      if (x?.status === "erro") setEstado({ tipo: "erro", msg: x.mensagem || "Não foi possível enviar o convite." });
    });
  }, [estado]);

  async function convidar(e: React.FormEvent, reenviar?: Usuario) {
    e.preventDefault();
    const dados = reenviar
      ? { nome: reenviar.nome, email: reenviar.email, papel: reenviar.papel, clienteId: reenviar.clienteId ?? undefined }
      : { ...form, clienteId: (PAPEIS_CLIENTE as readonly string[]).includes(form.papel) ? form.clienteId : undefined, adiar: form.adiar && !!CLIENTES[form.clienteId]?.avaliacao ? true : undefined };
    const r = conviteSchema.safeParse(dados);
    if (!r.success) {
      setErros(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErros({});
    const ref = await addDoc(collection(db(), "fila"), {
      tipo: reenviar ? "reenviarConvite" : "convidar", uid: s.usuario!.uid, clienteId: r.data.clienteId ?? null,
      dados: Object.fromEntries(Object.entries(r.data).filter(([, v]) => v != null)), status: "pendente", criadoEm: serverTimestamp(),
    });
    avisarServidor();
    setEstado({ tipo: "aguardando", id: ref.id });
    if (!reenviar) setForm({ ...form, nome: "", email: "" });
  }

  // Vínculos (etapa 3a): quais clientes cada profissional atende. Atendimento é único por cliente: quem assume tira o anterior.
  const [vinc, setVinc] = useState<{ tipo: "ocioso" } | { tipo: "salvando" } | { tipo: "ok"; msg: string } | { tipo: "erro"; msg: string }>({ tipo: "ocioso" });
  async function alternar(u: Usuario, clienteId: string) {
    const atuais = u.clientes ?? [];
    const novos = atuais.includes(clienteId) ? atuais.filter((c) => c !== clienteId) : [...atuais, clienteId];
    setVinc({ tipo: "salvando" });
    try {
      const ref = await addDoc(collection(db(), "fila"), { tipo: "vinculos", uid: s.usuario!.uid, clienteId: null, dados: { uid: u.id, clientes: novos }, status: "pendente", criadoEm: serverTimestamp() });
      avisarServidor();
      const fim = onSnapshot(doc(db(), "fila", ref.id), (d) => {
        const x = d.data() as { status: string; mensagem?: string; resultado?: { substituiu?: string[] } } | undefined;
        if (x?.status === "ok") {
          fim();
          const t = x.resultado?.substituiu?.length ? ` ${x.resultado.substituiu.join(", ")} deixou de atender este cliente.` : "";
          setVinc({ tipo: "ok", msg: `Vínculo de ${u.nome} atualizado.${t}` }); carregar();
        }
        if (x?.status === "erro") { fim(); setVinc({ tipo: "erro", msg: x.mensagem || "Não foi possível salvar o vínculo." }); }
      }, () => setVinc({ tipo: "erro", msg: "Não foi possível salvar o vínculo." }));
    } catch { setVinc({ tipo: "erro", msg: "Não foi possível salvar o vínculo." }); }
  }
  const profissionais = lista.filter((u) => ehVinculado(u.papel));

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
              <select id="papel" value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value })} className="min-h-11 rounded border border-[#C9D7DC] bg-white px-3">
                {Object.entries(NOMES_PAPEIS).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
              </select>
            </div>
            {cliente && (
              <div className="grid gap-1.5">
                <label htmlFor="cliente" className="text-sm font-semibold">Cliente</label>
                <select id="cliente" value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} aria-describedby={erros.clienteId ? "cliente-erro" : undefined} className="min-h-11 rounded border border-[#C9D7DC] bg-white px-3">
                  {Object.values(CLIENTES).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                {erros.clienteId && <p id="cliente-erro" className="text-sm text-alerta-700">{erros.clienteId}</p>}
              </div>
            )}
          </div>
          {cliente && !!CLIENTES[form.clienteId]?.avaliacao && (
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={form.adiar} onChange={(e) => setForm({ ...form, adiar: e.target.checked })} />
              <span>Cadastrar sem enviar o convite agora. O e-mail sai quando você clicar em <b>Iniciar teste</b> em Prospecção.</span></label>
          )}
          {estado.tipo === "aguardando" && <Aviso>Enviando convite… costuma levar poucos segundos (no máximo 1 minuto).</Aviso>}
          {estado.tipo === "ok" && <Aviso tipo="ok">{estado.msg}</Aviso>}
          {estado.tipo === "erro" && <Aviso tipo="erro">{estado.msg}</Aviso>}
          <Botao type="submit" className="justify-self-start" carregando={estado.tipo === "aguardando"}>Enviar convite</Botao>
        </form>

        <section className="grid gap-3" aria-labelledby="vinculos-titulo">
          <h2 id="vinculos-titulo" className="text-lg">Vínculos com clientes</h2>
          <p className="max-w-[70ch] text-sm text-gray-600">Atendimento, criativo e mídia social só veem e atuam nos clientes marcados aqui. O atendimento é um por cliente: ao marcar outra pessoa, a anterior deixa de atender. Admin e Financeiro da Propaga atuam em todos.</p>
          {vinc.tipo === "salvando" && <Aviso>Salvando… costuma levar poucos segundos.</Aviso>}
          {vinc.tipo === "ok" && <Aviso tipo="ok">{vinc.msg}</Aviso>}
          {vinc.tipo === "erro" && <Aviso tipo="erro">{vinc.msg}</Aviso>}
          <div className="relative overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600">
                <tr><th className="px-3 py-2.5">Profissional</th><th className="px-3 py-2.5">Perfil</th>{Object.values(CLIENTES).map((c) => <th key={c.id} className="px-3 py-2.5">{c.nome}</th>)}</tr>
              </thead>
              <tbody>
                {profissionais.map((u) => (
                  <tr key={u.id} className="border-t border-gray-200">
                    <td className="px-3 py-2.5"><b>{u.nome}</b><div className="text-gray-600">{u.email}</div></td>
                    <td className="px-3 py-2.5">{t(NOMES_PAPEIS[u.papel] ?? u.papel)}</td>
                    {Object.values(CLIENTES).map((c) => (
                      <td key={c.id} className="px-3 py-2.5">
                        <label className="inline-flex min-h-11 items-center gap-2">
                          <input type="checkbox" className="size-5 accent-marca-700" checked={(u.clientes ?? []).includes(c.id)} disabled={vinc.tipo === "salvando"} onChange={() => alternar(u, c.id)} />
                          <span className="sr-only">{u.nome} atende {c.nome}</span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
                {!profissionais.length && <tr><td colSpan={2 + Object.keys(CLIENTES).length} className="px-3 py-6 text-center text-gray-600">Nenhum profissional cadastrado ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg">Pessoas com acesso</h2>
            <button type="button" onClick={() => { setAcessos(null); carregarAcessos(); }} className="text-sm font-semibold text-marca-700 underline-offset-2 hover:underline">Atualizar situação</button>
          </div>
          <p className="max-w-[70ch] text-sm text-gray-600"><b>Convite aceito</b> = a pessoa criou a senha e ativou a verificação em duas etapas. <b>Acesso ao portal</b> mostra a data e a hora do último login.</p>
          <div className="relative overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600">
                <tr><th className="px-3 py-2.5">Pessoa</th><th className="px-3 py-2.5">Perfil</th><th className="px-3 py-2.5">Empresa</th><th className="px-3 py-2.5">Situação</th><th className="px-3 py-2.5">Acesso ao portal</th><th className="px-3 py-2.5"><span className="sr-only">Ações</span></th></tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id} className="border-t border-gray-200">
                    <td className="px-3 py-2.5"><b>{u.nome}</b><div className="text-gray-600">{u.email}</div></td>
                    <td className="px-3 py-2.5">{t(NOMES_PAPEIS[u.papel] ?? u.papel)}</td>
                    <td className="px-3 py-2.5">{u.clienteId ? CLIENTES[u.clienteId]?.nome : "Propaga"}</td>
                    <td className="px-3 py-2.5">{situacao(acessos?.[u.id], !!acessos)}</td>
                    <td className="px-3 py-2.5">{acesso(acessos?.[u.id], !!acessos, erroAcessos)}</td>
                    <td className="px-3 py-2.5 text-right">{u.id !== s.usuario?.uid && !acessos?.[u.id]?.doisFatores && <Botao variante="discreto" className="min-h-9 px-3 text-sm" onClick={(e) => convidar(e, u)}>Reenviar convite</Botao>}</td>
                  </tr>
                ))}
                {!lista.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-600">Nenhuma pessoa cadastrada ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Casca>
  );
}

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
const Selo = ({ cor, children }: { cor: "ok" | "aviso" | "neutro"; children: React.ReactNode }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${{ ok: "bg-[#E3F2EA] text-[#1E7047]", aviso: "bg-alerta-100 text-alerta-700", neutro: "bg-[#EAF3F5] text-ink-900" }[cor]}`}>{children}</span>
);
function situacao(a: Acesso | undefined, carregado: boolean) {
  if (!carregado) return <span className="text-gray-600">…</span>;
  if (a?.doisFatores) return <Selo cor="ok">✓ Convite aceito</Selo>;
  if (a?.senha) return <Selo cor="aviso">Senha criada · falta o código</Selo>;
  return <Selo cor="neutro">Convite enviado</Selo>;
}
function acesso(a: Acesso | undefined, carregado: boolean, erro: boolean) {
  if (erro) return <span className="text-gray-600">Não foi possível consultar</span>;
  if (!carregado) return <span className="text-gray-600">Consultando…</span>;
  if (a?.doisFatores && a.ultimoAcesso) return <span>Ativo<span className="block text-xs text-gray-600">último acesso {dataHora(a.ultimoAcesso)}</span></span>;
  return <span className="text-gray-600">Ainda não acessou</span>;
}

export default function Usuarios() {
  return <Protegido papeis={["admin"]}><Conteudo /></Protegido>;
}
