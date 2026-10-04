import { describe, it, expect, beforeEach } from "vitest";
import { paraValor, deValor } from "../apps-script/src/firestore";
import { configurarProjeto, convidar, processarFila } from "../apps-script/src/servidor";
import { resumoDiario } from "../apps-script/src/pecas";
import { Firestore } from "../apps-script/src/firestore";
import { CLIENTES } from "@/content/clientes";
import type { Plataforma, RespostaHttp } from "../apps-script/src/plataforma";

/* Simula Firestore REST + Identity Toolkit em memória. */
function fake() {
  const docs = new Map<string, { fields: Record<string, unknown>; updateTime: string }>();
  const usuarios = new Map<string, { localId: string; email: string; claims?: string }>();
  const emails: { para: string; assunto: string; html: string }[] = [];
  let v = 0, seguranca: unknown = null;
  const raiz = "projects/propaga-portal/databases/(default)/documents/";
  const r = (status: number, o: unknown): RespostaHttp => ({ status, corpo: JSON.stringify(o) });
  const p: Plataforma = {
    http(url, metodo, corpo: any) {
      if (url.includes("firestore.googleapis.com")) {
        if (url.endsWith(":commit")) {
          for (const w of corpo.writes) {
            const nome = w.update.name.replace(raiz, "");
            const atual = docs.get(nome);
            if (w.currentDocument?.updateTime && atual?.updateTime !== w.currentDocument.updateTime) return r(409, { error: "precondition" });
            if (w.currentDocument?.exists === false && atual) return r(409, { error: "exists" });
            const fields = w.updateMask ? { ...(atual?.fields || {}), ...w.update.fields } : w.update.fields;
            docs.set(nome, { fields, updateTime: `t${++v}` });
          }
          return r(200, {});
        }
        if (url.endsWith(":runQuery")) {
          const q = corpo.structuredQuery; const col = q.from[0].collectionId;
          const val = deValor(q.where.fieldFilter.value);
          const out = [...docs.entries()].filter(([k, d]) => k.split("/").length === 2 && k.startsWith(col + "/")
            && deValor(d.fields[q.where.fieldFilter.field.fieldPath] as any) === val)
            .map(([k, d]) => ({ document: { name: raiz + k, fields: d.fields, updateTime: d.updateTime } }));
          return r(200, out.length ? out : [{}]);
        }
        if (url.includes("?pageSize=")) {
          const col = url.split("/documents/")[1].split("?")[0];
          const out = [...docs.entries()].filter(([k]) => k.split("/").length === col.split("/").length + 1 && k.startsWith(col + "/"))
            .map(([k, d]) => ({ name: raiz + k, fields: d.fields, updateTime: d.updateTime }));
          return r(200, { documents: out });
        }
        const nome = url.split("/documents/")[1];
        const d = docs.get(nome);
        return d ? r(200, { name: raiz + nome, fields: d.fields, updateTime: d.updateTime }) : r(404, {});
      }
      if (url.includes("accounts:lookup")) {
        const u = [...usuarios.values()].find((x) => x.email === corpo.email[0]);
        return r(200, u ? { users: [u] } : {});
      }
      if (url.endsWith("/accounts")) { const id = `uid${usuarios.size + 1}`; usuarios.set(id, { localId: id, email: corpo.email }); return r(200, { localId: id }); }
      if (url.includes("accounts:update")) { usuarios.get(corpo.localId)!.claims = corpo.customAttributes; return r(200, {}); }
      if (url.includes("accounts:sendOobCode")) return r(200, { oobLink: `https://x.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC%2B123&apiKey=k` });
      if (url.includes("/admin/v2/") && metodo === "patch") { seguranca = corpo; return r(200, {}); }
      return r(404, { error: url });
    },
    enviarEmail: (m) => emails.push(m),
    propriedade: (k) => ({ PORTAL_URL: "https://portal.propaga.com", ADMIN_EMAIL: "marco@propaga.com", ADMIN_NOME: "Marco Chaves" } as Record<string, string>)[k] ?? null,
    agora: () => new Date("2026-10-02T12:00:00Z"),
    log: () => {},
  };
  const doc = (k: string) => { const d = docs.get(k); return d ? (deValor({ mapValue: { fields: d.fields } }) as any) : null; };
  return { p, docs, usuarios, emails, doc, get seguranca() { return seguranca; } };
}

describe("conversão Firestore", () => {
  it("ida e volta preserva tipos", () => {
    const o = { a: 1, b: 1.5, c: "x", d: true, e: null, f: [1, "y"], g: { h: 2 } };
    expect(deValor(paraValor(o))).toEqual(o);
  });
});

describe("servidor Apps Script", () => {
  let f: ReturnType<typeof fake>;
  beforeEach(() => { f = fake(); });

  it("configura TOTP, política de senha e catálogo público sem referência", () => {
    configurarProjeto(f.p);
    const s = f.seguranca as any;
    expect(s.mfa.providerConfigs[0].totpProviderConfig).toBeTruthy();
    expect(s.passwordPolicyConfig.passwordPolicyVersions[0].customStrengthOptions.minPasswordLength).toBe(8);
    const pub = f.doc("clientes/bmlog/catalogo/1.0");
    expect(pub.servicos).toHaveLength(68);
    expect(JSON.stringify(pub)).not.toContain("referencia");
    expect(f.doc("interno/catalogos/versoes/bmlog-1.0").servicos[0].variantes[0].referencia).toBe(200);
    expect(f.doc("clientes/bmlog").unidades[0]).toBe("Matriz · Itajaí/SC");
  });

  it("convida cliente: claims, cadastro e e-mail com link do portal", () => {
    const r = convidar(f.p, { nome: "Débora", email: "demorabmlog@gmail.com", papel: "solicitante", clienteId: "bmlog" }, { uid: "adm", nome: "Marco Chaves" });
    expect(JSON.parse(f.usuarios.get(r.uid)!.claims!)).toEqual({ papel: "solicitante", clienteId: "bmlog" });
    expect(f.doc(`usuarios/${r.uid}`).status).toBe("convidado");
    expect(f.emails[0].html).toContain("https://portal.propaga.com/primeiro-acesso/?oobCode=ABC%2B123");
    expect(f.emails[0].assunto).toContain("Portal B&M Log");
  });

  it("equipe Propaga recebe claim propaga, sem cliente", () => {
    const r = convidar(f.p, { nome: "Marcelo Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: "adm", nome: "Marco" });
    expect(JSON.parse(f.usuarios.get(r.uid)!.claims!)).toEqual({ papel: "atendimento", propaga: true });
  });

  it("recusa perfil de cliente sem cliente", () => {
    expect(() => convidar(f.p, { nome: "X Y", email: "x@y.com", papel: "solicitante" }, { uid: "a", nome: "M" })).toThrow(/cliente vinculado/);
  });

  it("fila: só admin convida; resultado volta para o item", () => {
    const adm = convidar(f.p, { nome: "Marco Chaves", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" });
    const deb = convidar(f.p, { nome: "Débora", email: "d@x.com", papel: "solicitante", clienteId: "bmlog" }, { uid: adm.uid, nome: "Marco" });
    const enfileirar = (id: string, uid: string) => f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({
      tipo: "convidar", uid, clienteId: "bmlog", status: "pendente", criadoEm: id,
      dados: { nome: "Mariana Fontora", email: "financeiro@bmlog.com.br", papel: "financeiro_cliente", clienteId: "bmlog" },
    }) as any).mapValue.fields });
    enfileirar("a1", adm.uid);
    enfileirar("a2", deb.uid);
    const res = processarFila(f.p);
    expect(res).toEqual({ ok: 1, erro: 1 });
    expect(f.doc("fila/a1").status).toBe("ok");
    expect(f.doc("fila/a2").mensagem).toMatch(/Somente o administrador/);
    expect(processarFila(f.p)).toEqual({ ok: 0, erro: 0 }); // nada pendente: não reprocessa
  });
});

describe("nova solicitação (fila 'enviar')", () => {
  let f: ReturnType<typeof fake>;
  let deb: string, mar: string, adm: string;
  const pedido = (extra: Record<string, unknown> = {}) => ({
    titulo: "Campanha de segurança", unidade: "Filial · Guarulhos/SP", email: "marketing@bmlog.com.br",
    objetivo: "Reduzir ocorrências", publico: "Colaboradores da matriz e das filiais",
    itens: [
      { cod: "21", variante: 0, qtd: 1, opcao: "16:9 horizontal", canal: CLIENTES.bmlog.canaisVideo[0], audio: CLIENTES.bmlog.audiosVideo[0] },
      { cod: "01", variante: 0, qtd: 3, opcao: "4:5", canal: "não se aplica", obs: "  " },
      { cod: "02", variante: 1, qtd: 1, opcao: "1:1" },
    ],
    drive: { link: "https://drive.google.com/drive/folders/abc123", conferido: true },
    obs: "Observações", prazo: { desejada: "2026-10-20", urgente: false }, conferido: true, ...extra,
  });
  let seq = 0;
  const enfileirar = (uid: string, dados: unknown, clienteId = "bmlog") => {
    const id = `e${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo: "enviar", uid, clienteId, status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    return id;
  };
  beforeEach(() => {
    f = fake();
    adm = convidar(f.p, { nome: "Marco Chaves", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    deb = convidar(f.p, { nome: "Débora", email: "deborabmlog@gmail.com", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    mar = convidar(f.p, { nome: "Mariana Fontora", email: "financeiro@bmlog.com.br", papel: "financeiro_cliente", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    convidar(f.p, { nome: "Marcelo Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" });
    f.emails.length = 0;
  });

  it("grava pedido, valores e eventos; numera o protocolo; avisa sem valores", () => {
    const a = enfileirar(deb, pedido());
    expect(processarFila(f.p)).toEqual({ ok: 1, erro: 0 });
    expect(f.doc(`fila/${a}`).resultado).toEqual({ protocolo: "BML-2026-0001" });
    const s = f.doc("clientes/bmlog/solicitacoes/BML-2026-0001");
    expect(s.status).toBe("enviada");
    expect(s.solicitanteUid).toBe(deb);
    expect(s.itens[0]).toMatchObject({ cod: "21", nome: "Vídeo para TV interna", sobOrcamento: false });
    expect(s.itens[1].canal).toBeUndefined(); // não é vídeo: canal descartado
    expect(s.itens[1].obs).toBeUndefined();    // observação vazia descartada
    expect(s.itens[2].sobOrcamento).toBe(true); // carrossel 6 a 10 telas = a cotar
    expect(JSON.stringify(s)).not.toMatch(/referencia|preco|unitario/);
    const v = f.doc("clientes/bmlog/valores/BML-2026-0001");
    expect(v.pendencias).toBe(1);
    expect(v.total).toBeGreaterThan(0);
    const evs = [...f.docs.keys()].filter((k) => k.startsWith("clientes/bmlog/solicitacoes/BML-2026-0001/eventos/"));
    expect(evs).toHaveLength(2);
    expect(f.emails.map((e) => e.para).sort()).toEqual(["deborabmlog@gmail.com", "marcelo@propaga.com", "marco@propaga.com"]);
    expect(f.emails[0].assunto).toBe("Nova solicitação BML-2026-0001 · Campanha de segurança");
    expect(f.emails[0].html).not.toMatch(/R\$/);
    expect(f.emails[0].html).toContain("sob orçamento");

    enfileirar(deb, pedido());
    processarFila(f.p);
    expect(f.doc("clientes/bmlog/solicitacoes/BML-2026-0002")).toBeTruthy();
  });

  it("recusa perfil sem permissão, outro cliente e dados inválidos", () => {
    const a = enfileirar(mar, pedido());
    const b = enfileirar(deb, pedido(), "outro");
    const c = enfileirar(deb, pedido({ itens: [{ cod: "21", variante: 0, qtd: 1, opcao: "16:9 horizontal" }] }));
    const d = enfileirar(deb, pedido({ unidade: "Filial · Marte" }));
    const e = enfileirar(deb, pedido({ prazo: { desejada: "2026-09-01", urgente: false } }));
    expect(processarFila(f.p)).toEqual({ ok: 0, erro: 5 });
    expect(f.doc(`fila/${a}`).mensagem).toMatch(/não envia solicitações/);
    expect(f.doc(`fila/${b}`).mensagem).toMatch(/Cliente inválido/);
    expect(f.doc(`fila/${c}`).mensagem).toMatch(/canal do vídeo/);
    expect(f.doc(`fila/${d}`).mensagem).toMatch(/unidade/);
    expect(f.doc(`fila/${e}`).mensagem).toMatch(/já passou/);
    expect(f.emails).toHaveLength(0);
  });
});

describe("ações do pedido (fila 'acao')", () => {
  let f: ReturnType<typeof fake>;
  let adm: string, deb: string, mar: string, mcl: string, mrs: string;
  let seq = 0;
  const fila = (tipo: string, uid: string, dados: unknown) => {
    const id = `x${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo, uid, clienteId: "bmlog", status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    processarFila(f.p);
    return f.doc(`fila/${id}`);
  };
  const acao = (uid: string, acao: string, extra: Record<string, unknown> = {}) => fila("acao", uid, { protocolo: "BML-2026-0001", acao, ...extra });
  const ped = () => f.doc("clientes/bmlog/solicitacoes/BML-2026-0001");
  const cron = { inicio: "2026-10-05", primeira: "2026-10-09", final: "2026-10-16" };
  beforeEach(() => {
    f = fake();
    adm = convidar(f.p, { nome: "Marco Chaves", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    deb = convidar(f.p, { nome: "Débora", email: "deborabmlog@gmail.com", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    mar = convidar(f.p, { nome: "Mariana Fontora", email: "financeiro@bmlog.com.br", papel: "financeiro_cliente", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    mcl = convidar(f.p, { nome: "Marcelo Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    mrs = convidar(f.p, { nome: "Marisa Coelho", email: "marisa@propaga.com", papel: "financeiro_propaga" }, { uid: adm, nome: "Marco" }).uid;
    fila("enviar", deb, {
      titulo: "Campanha", unidade: "Matriz · Itajaí/SC", email: "m@bmlog.com.br", objetivo: "Reforçar", publico: "Ambos os públicos",
      itens: [{ cod: "01", variante: 0, qtd: 2, opcao: "4:5" }, { cod: "02", variante: 1, qtd: 1, opcao: "1:1" }],
      drive: { link: "https://drive.google.com/drive/folders/abc", conferido: true }, obs: "", prazo: { desejada: "2026-10-20", urgente: false }, conferido: true,
    });
    f.emails.length = 0;
  });

  it("ciclo completo: aceite com valor a cotar, versão, ajuste, aprovação, entrega, recebimento, faturamento e pagamento", () => {
    expect(acao(mcl, "aceitarPedido", { cronograma: cron }).mensagem).toMatch(/valor do item 2/);
    expect(acao(mcl, "aceitarPedido", { cronograma: cron, valores: [{ indice: 1, valor: 510 }], driveVerificado: true }).status).toBe("ok");
    expect(ped().status).toBe("producao");
    expect(ped().prazo.primeira).toBe("2026-10-09");
    const v = f.doc("clientes/bmlog/valores/BML-2026-0001");
    expect(v.pendencias).toBe(0);
    expect(v.total).toBe(850); // 2 × 170 + 510
    expect(f.emails.map((e) => e.para)).toEqual(["deborabmlog@gmail.com"]);
    expect(f.emails[0].html).not.toContain("510");

    acao(mcl, "disponibilizarVersao", { nota: "Versão 1 na pasta 03 Provas." });
    expect(ped().status).toBe("apresentacao");
    expect(acao(deb, "pedirAjustes", {}).mensagem).toMatch(/Descreva os ajustes/);
    acao(deb, "pedirAjustes", { nota: "Aumentar o logo." });
    expect(ped().rodadas).toBe(1);
    acao(mcl, "disponibilizarVersao", {});
    expect(ped().versao).toBe(2);
    acao(deb, "aprovar");
    expect(ped().status).toBe("aprovada");
    f.emails.length = 0;
    acao(mcl, "entregar");
    expect(f.emails.map((e) => e.para).sort()).toEqual(["deborabmlog@gmail.com", "marisa@propaga.com"]);
    acao(deb, "confirmarRecebimento");
    expect(ped().recebidoPeloCliente).toBe(true);
    expect(acao(deb, "confirmarRecebimento").status).toBe("erro");
    acao(mrs, "faturar", { nota: "NF 1234" });
    acao(mrs, "registrarPagamento");
    expect(ped().status).toBe("paga");
    const evs = [...f.docs.keys()].filter((k) => k.includes("/BML-2026-0001/eventos/"));
    expect(evs.length).toBe(11); // envio + aviso + 9 ações válidas
  });

  it("bloqueios: Financeiro do cliente não age, solicitante não aceita, outro cliente não mexe", () => {
    expect(acao(mar, "aceitarPedido", { cronograma: cron }).mensagem).toMatch(/não está disponível/);
    expect(acao(deb, "aceitarPedido", { cronograma: cron }).mensagem).toMatch(/não está disponível/);
    expect(acao(mcl, "aprovar").mensagem).toMatch(/não está disponível/);
    const outro = convidar(f.p, { nome: "Outra", email: "o@x.com", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "M" }).uid;
    expect(acao(outro, "cancelar", { nota: "teste" }).mensagem).toMatch(/não é seu/);
    expect(ped().status).toBe("enviada");
  });

  it("cancelamento exige motivo e avisa solicitante e atendimento", () => {
    expect(acao(deb, "cancelar").mensagem).toMatch(/motivo/);
    acao(deb, "cancelar", { nota: "Campanha adiada." });
    expect(ped().status).toBe("cancelada");
    expect(f.emails.map((e) => e.para)).toEqual(["marcelo@propaga.com"]);
  });

  it("3ª refação: Atendimento decide se cobra +30% ao disponibilizar a versão", () => {
    acao(mcl, "aceitarPedido", { cronograma: cron, valores: [{ indice: 1, valor: 900 }], driveVerificado: true });
    for (let i = 0; i < 2; i++) { acao(mcl, "disponibilizarVersao", {}); acao(deb, "pedirAjustes", { nota: `Ajuste ${i + 1}` }); }
    acao(mcl, "disponibilizarVersao", {});
    acao(deb, "pedirAjustes", { nota: "Trocar a foto e o título." });
    expect(ped().rodadas).toBe(3);
    expect(ped().refacaoExtraPendente).toBe(true);
    expect(acao(mcl, "disponibilizarVersao", {}).mensagem).toMatch(/refação extra/);
    f.emails.length = 0;
    acao(mcl, "disponibilizarVersao", { refacaoExtraCobrada: true });
    expect(ped().refacoesExtrasCobradas).toBe(1);
    expect(ped().refacaoExtraPendente).toBe(false);
    expect(f.emails.map((e) => e.para).sort()).toEqual(["deborabmlog@gmail.com", "marisa@propaga.com"]);
    acao(deb, "pedirAjustes", { nota: "Repete: aumentar o logo." });
    acao(mcl, "disponibilizarVersao", { refacaoExtraCobrada: false });
    expect(ped().refacoesExtrasCobradas).toBe(1);
  });

  it("solicitante cancela em apresentação: cobrança de 50% registrada e Financeiro Propaga avisado", () => {
    expect(acao(mcl, "aceitarPedido", { cronograma: cron, valores: [{ indice: 1, valor: 900 }], driveVerificado: true }).status).toBe("ok");
    acao(mcl, "disponibilizarVersao", {});
    f.emails.length = 0;
    expect(acao(mcl, "cancelar", { nota: "x".repeat(5) }).mensagem).toMatch(/não está disponível/);
    acao(deb, "cancelar", { nota: "Campanha suspensa." });
    expect(ped().status).toBe("cancelada");
    const evs = [...f.docs.keys()].filter((k) => k.includes("/BML-2026-0001/eventos/")).map((k) => String(f.doc(k).rotulo));
    expect(evs.some((r) => /50%/.test(r))).toBe(true);
    expect(f.emails.map((e) => e.para).sort()).toEqual(["marcelo@propaga.com", "marisa@propaga.com"]);
  });
});

describe("aprovação por peça (fila 'peca')", () => {
  let f: ReturnType<typeof fake>;
  let deb: string, adm: string, mcl: string, mri: string, seq = 0;
  const fila = (tipo: string, uid: string, dados: unknown) => {
    const id = `y${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo, uid, clienteId: "bmlog", status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    processarFila(f.p);
    return f.doc(`fila/${id}`);
  };
  const peca = (uid: string, acao: string, extra: Record<string, unknown> = {}) => fila("peca", uid, { protocolo: "BML-2026-0001", acao, ...extra });
  const ped = () => f.doc("clientes/bmlog/solicitacoes/BML-2026-0001");
  const pc = (id: string) => ped().pecas.find((x: any) => x.id === id);
  const link = (n: string) => `https://drive.google.com/file/d/${n}/view`;
  const para = () => f.emails.map((e) => e.para).sort();
  beforeEach(() => {
    f = fake();
    adm = convidar(f.p, { nome: "Marco Chaves", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    deb = convidar(f.p, { nome: "Débora", email: "deborabmlog@gmail.com", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    mcl = convidar(f.p, { nome: "Marcelo Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    mri = convidar(f.p, { nome: "Mariane", email: "mariane@propaga.com", papel: "criativo" }, { uid: adm, nome: "Marco" }).uid;
    convidar(f.p, { nome: "Marisa Coelho", email: "marisa@propaga.com", papel: "financeiro_propaga" }, { uid: adm, nome: "Marco" });
    fila("enviar", deb, {
      titulo: "Campanha", unidade: "Matriz · Itajaí/SC", email: "m@bmlog.com.br", objetivo: "Reforçar", publico: "Ambos os públicos",
      itens: [{ cod: "01", variante: 0, qtd: 3, opcao: "4:5" }],
      drive: { link: "https://drive.google.com/drive/folders/abc", conferido: true }, obs: "", prazo: { desejada: "2026-10-20", urgente: false }, conferido: true,
    });
    fila("acao", mcl, { protocolo: "BML-2026-0001", acao: "aceitarPedido", cronograma: { inicio: "2026-10-05", primeira: "2026-10-09", final: "2026-10-16" }, driveVerificado: true });
    expect(para()).toContain("mariane@propaga.com"); // o aceite entrega o job à Mariane
    f.emails.length = 0;
  });

  it("ciclo: publicar → avaliar (aprova, refaz, cancela) → encaminhar → nova versão → revisão → Débora aprova → final → pronto para entrega", () => {
    expect(peca(deb, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }] }).mensagem).toMatch(/perfil/);
    expect(peca(mcl, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }, { nome: "Post B", item: 0, link: link("b") }, { nome: "Post C", item: 0, link: link("c") }] }).status).toBe("ok");
    expect(ped().status).toBe("apresentacao");
    expect(para()).toEqual(["deborabmlog@gmail.com"]);

    f.emails.length = 0;
    expect(peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }] }).mensagem).toMatch(/Avalie todas/);
    expect(peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }, { id: "p2", tipo: "refacao", itens: [] }, { id: "p3", tipo: "cancelada", nota: "Suspensa." }] }).mensagem).toMatch(/Liste os ajustes/);
    expect(peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }, { id: "p2", tipo: "refacao", itens: ["Aumentar título", "Trocar foto"] }, { id: "p3", tipo: "cancelada", nota: "Campanha suspensa." }] }).status).toBe("ok");
    expect([pc("p1").etapa, pc("p1").tarefa]).toEqual(["criativo", "final"]);   // aprovada vai direto à Mariane
    expect([pc("p3").etapa, pc("p3").tarefa]).toEqual(["criativo", "ciencia"]); // cancelada também
    expect(pc("p2").etapa).toBe("triagem");                                       // só a refação passa pelo Marcelo
    expect(ped().rodadas).toBe(1);
    expect(ped().status).toBe("producao");
    expect(para()).toEqual(["marcelo@propaga.com", "mariane@propaga.com", "marisa@propaga.com"]);

    f.emails.length = 0;
    expect(peca(mcl, "encaminhar", { prazo: "2026-10-07", refacoes: [{ id: "p2", itens: ["Aumentar título", "Foto do caminhão azul"] }] }).status).toBe("ok");
    expect([pc("p2").etapa, pc("p2").tarefa, pc("p2").orientacao.prazo]).toEqual(["criativo", "refazer", "2026-10-07"]);
    expect(para()).toEqual(["mariane@propaga.com"]);

    expect(peca(mri, "enviarVersao", { id: "p2", link: link("b2"), feitos: 1 }).mensagem).toMatch(/Marque todos/);
    expect(peca(mri, "enviarVersao", { id: "p2", link: link("b2"), feitos: 2 }).status).toBe("ok");
    expect(pc("p2").etapa).toBe("revisao");
    expect(pc("p2").versoes).toHaveLength(2);

    // devolver (ajuste interno) não conta refação
    expect(peca(mcl, "devolver", { id: "p2", itens: ["Alinhar o logo"] }).status).toBe("ok");
    expect([pc("p2").etapa, pc("p2").versoes.length, ped().rodadas]).toEqual(["criativo", 2, 1]); // v2 fica marcada como devolvida e é substituída
    peca(mri, "enviarVersao", { id: "p2", link: link("b2"), feitos: 1 });
    f.emails.length = 0;
    expect(peca(mcl, "liberar", { ids: ["p2"] }).status).toBe("ok");
    expect(pc("p2").etapa).toBe("cliente");
    expect(ped().status).toBe("apresentacao");
    expect(para()).toEqual(["deborabmlog@gmail.com"]);

    peca(deb, "avaliar", { decisoes: [{ id: "p2", tipo: "aprovada" }] });
    expect(ped().status).toBe("aprovada");
    expect(fila("acao", mcl, { protocolo: "BML-2026-0001", acao: "entregar" }).mensagem).toMatch(/peças em andamento/);
    peca(mri, "ciente", { id: "p3" });
    peca(mri, "finalizar", { id: "p1" });
    f.emails.length = 0;
    expect(peca(mri, "finalizar", { id: "p2" }).resultado.pronto).toBe(true);
    expect(f.emails.some((e) => e.para === "marcelo@propaga.com" && /pronto para entrega/.test(e.assunto))).toBe(true);
    expect(fila("acao", mcl, { protocolo: "BML-2026-0001", acao: "entregar" }).status).toBe("ok");
    // ações antigas por pedido ficam bloqueadas
    expect(fila("acao", deb, { protocolo: "BML-2026-0001", acao: "aprovar" }).mensagem).toMatch(/Aprovações|disponível/);
  });

  it("Mariane cria as peças → Marcelo revisa (devolve a v1, ela substitui) → Débora recebe", () => {
    expect(peca(mri, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }] }).status).toBe("ok");
    expect([pc("p1").etapa, pc("p1").versoes[0].interna]).toEqual(["revisao", true]);
    expect(ped().status).toBe("producao");
    expect(para()).toEqual(["marcelo@propaga.com"]);
    peca(mcl, "devolver", { id: "p1", itens: ["Usar a foto do caminhão"] });
    expect([pc("p1").etapa, pc("p1").tarefa, pc("p1").versoes.length]).toEqual(["criativo", "refazer", 1]);
    peca(mri, "enviarVersao", { id: "p1", link: link("a2"), feitos: 1 });
    expect([pc("p1").etapa, pc("p1").versoes.length, pc("p1").versoes[0].v, pc("p1").versoes[0].link]).toEqual(["revisao", 1, 1, link("a2")]);
    f.emails.length = 0;
    peca(mcl, "liberar", { ids: ["p1"] });
    expect([pc("p1").etapa, ped().status, ped().rodadas]).toEqual(["cliente", "apresentacao", 0]);
    expect(para()).toEqual(["deborabmlog@gmail.com"]);
  });

  it("resumo diário: uma vez por dia, só para quem tem pendência", () => {
    peca(mcl, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }] });
    f.docs.delete("interno/resumos/dias/2026-10-02");
    f.emails.length = 0;
    const cfg = { p: f.p };
    expect(resumoDiario(cfg.p, new Firestore(f.p, "propaga-portal"))).toBe(1);
    expect(f.emails[0].para).toBe("deborabmlog@gmail.com");
    expect(f.emails[0].assunto).toMatch(/pendências/);
    expect(resumoDiario(cfg.p, new Firestore(f.p, "propaga-portal"))).toBe(0);
  });

  it("3ª refação: +30% só quando o Marcelo marca; criativo não avalia", () => {
    peca(mcl, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }] });
    expect(peca(mri, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }] }).mensagem).toMatch(/perfil/);
    for (let i = 0; i < 3; i++) {
      peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "refacao", itens: [`Ajuste ${i}`] }] });
      peca(mcl, "encaminhar", { prazo: "2026-10-07", refacoes: [{ id: "p1", itens: [`Ajuste ${i}`], cobrar30: true }] });
      peca(mri, "enviarVersao", { id: "p1", link: link(`a${i}`), feitos: 1 });
      peca(mcl, "liberar", { ids: ["p1"] });
    }
    expect(ped().rodadas).toBe(3);
    expect(pc("p1").extras30).toBe(1); // só a 3ª conta
  });
});
