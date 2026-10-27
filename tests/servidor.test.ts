import { describe, it, expect, beforeEach } from "vitest";
import { paraValor, deValor } from "../apps-script/src/firestore";
import { configurarProjeto, convidar as convidarBase, definirVinculos, processarFila } from "../apps-script/src/servidor";
import { resumoDiario } from "../apps-script/src/pecas";
import { Firestore } from "../apps-script/src/firestore";
import { comTrava, emailPermitido } from "../apps-script/src/trava";
import { CLIENTES } from "@/content/clientes";
import { situacaoRelatorio } from "@/lib/pecas";
import type { Plataforma, RespostaHttp } from "../apps-script/src/plataforma";

/* Simula Firestore REST + Identity Toolkit em memória. */
/** Como o admin faria depois do convite: profissional novo vinculado à B&M Log (os testes de vínculo usam convidarBase). */
function convidar(p: Plataforma, dados: Record<string, unknown>, por: { uid: string; nome: string }) {
  const r = convidarBase(p, dados, por);
  if (["atendimento", "criativo", "midia_social"].includes(String(dados.papel))) definirVinculos(new Firestore(p, "propaga-portal"), { uid: r.uid, clientes: ["bmlog"] });
  return r;
}

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
            if (w.delete) { docs.delete(w.delete.replace(raiz, "")); continue; }
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

  describe("trava de e-mails do período de teste (EMAILS_PERMITIDOS)", () => {
    const com = (lista: string | null): Plataforma => ({ ...f.p, propriedade: (k) => (k === "EMAILS_PERMITIDOS" ? lista : f.p.propriedade(k)) });

    it("sem a propriedade, a trava está desligada", () => {
      expect(emailPermitido(com(null), "qualquer@cliente.com")).toBe(true);
      expect(emailPermitido(com("  , "), "qualquer@cliente.com")).toBe(true);
    });
    it("aceita domínio ou endereço exato, sem diferenciar maiúsculas", () => {
      const p = com("propaga.com, @bmlog-teste.com, Marco.Teste@gmail.com");
      expect(emailPermitido(p, "Marcelo@Propaga.com")).toBe(true);
      expect(emailPermitido(p, "glauco@bmlog-teste.com")).toBe(true);
      expect(emailPermitido(p, "marco.teste@gmail.com")).toBe(true);
      expect(emailPermitido(p, "glauco@bmlog.com.br")).toBe(false);
      expect(emailPermitido(p, "outro@gmail.com")).toBe(false);
      expect(emailPermitido(p, "x@evilpropaga.com")).toBe(false);
      expect(emailPermitido(p, "x@propaga.com.evil.com")).toBe(false);
    });
    it("convite fora da lista falha antes de criar conta ou enviar e-mail", () => {
      expect(() => convidar(com("propaga.com"), { nome: "Glauco", email: "glauco@bmlog.com.br", papel: "solicitante", clienteId: "bmlog" }, { uid: "adm", nome: "Marco" })).toThrow(/lista permitida/);
      expect(f.usuarios.size).toBe(0);
      expect(f.emails).toHaveLength(0);
    });
    it("convite da lista segue normal", () => {
      const r = convidar(com("propaga.com"), { nome: "Marcelo Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: "adm", nome: "Marco" });
      expect(f.usuarios.has(r.uid)).toBe(true);
      expect(f.emails).toHaveLength(1);
    });
    it("comTrava descarta o envio fora da lista e deixa passar o da lista", () => {
      const p = comTrava(com("propaga.com"));
      const msg = { assunto: "Aviso", html: "<p>x</p>", texto: "x", nomeRemetente: "Portal" };
      p.enviarEmail({ ...msg, para: "glauco@bmlog.com.br" });
      expect(f.emails).toHaveLength(0);
      p.enviarEmail({ ...msg, para: "marisa@propaga.com" });
      expect(f.emails).toHaveLength(1);
    });
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

  it("aceite com valor a cotar; nova solicitação avisa o Atendimento e manda só um recibo para quem enviou", () => {
    expect(acao(mcl, "aceitarPedido", { cronograma: cron }).mensagem).toMatch(/valor do item 2/);
    expect(acao(mcl, "aceitarPedido", { cronograma: cron, valores: [{ indice: 1, valor: 510 }], driveVerificado: true, pastaPropaga: "https://drive.google.com/drive/folders/propaga1" }).status).toBe("ok");
    expect(ped().status).toBe("producao");
    expect(ped().prazo.primeira).toBe("2026-10-09");
    const v = f.doc("clientes/bmlog/valores/BML-2026-0001");
    expect(v.pendencias).toBe(0);
    expect(v.total).toBe(850); // 2 × 170 + 510
    expect(f.emails.map((e) => e.para)).toEqual(["deborabmlog@gmail.com"]);
    expect(f.emails[0].html).not.toContain("510");
    expect(acao(mcl, "entregar").mensagem).toMatch(/peças em andamento/); // sem peças não há entrega
  });

  it("bloqueios: Financeiro do cliente não age, solicitante não aceita; pedido de outro solicitante não existe para ele", () => {
    expect(acao(mar, "aceitarPedido", { cronograma: cron }).mensagem).toMatch(/não está disponível/);
    expect(acao(deb, "aceitarPedido", { cronograma: cron }).mensagem).toMatch(/não está disponível/);
    // O pedido pertence a quem o originou (24/10/2026): o colega não age nele, nem sabe que existe.
    const outro = convidar(f.p, { nome: "Glauco", email: "glauco@bmlog.com.br", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "M" }).uid;
    expect(acao(outro, "cancelar", { nota: "Teste" }).mensagem).toMatch(/Pedido não encontrado/);
    expect(acao(outro, "aceitarPedido", { cronograma: cron }).mensagem).toMatch(/Pedido não encontrado/);
    expect(ped().status).toBe("enviada");
  });

  it("edição de itens pelo Marcelo devolve ao Marketing (bloqueia aceite e recusa); outras mudanças não devolvem", () => {
    const itens = [{ cod: "01", variante: 0, qtd: 3, opcao: "4:5" }, { cod: "02", variante: 1, qtd: 1, opcao: "1:1" }];
    const env = (extra: Record<string, unknown>) => fila("enviar", mcl, {
      titulo: "Campanha", unidade: "Matriz · Itajaí/SC", email: "m@bmlog.com.br", objetivo: "Reforçar", publico: "Ambos os públicos", itens,
      drive: { link: "https://drive.google.com/drive/folders/abc", conferido: true }, obs: "", prazo: { desejada: "2026-10-20", urgente: false }, conferido: true,
      editar: "BML-2026-0001", ...extra,
    });
    // só o título muda: segue em "enviada"
    expect(env({ titulo: "Campanha nova", itens: [{ cod: "01", variante: 0, qtd: 2, opcao: "4:5" }, { cod: "02", variante: 1, qtd: 1, opcao: "1:1" }] }).status).toBe("ok");
    expect(ped().status).toBe("enviada");
    expect(ped().edicaoPendente).toBeUndefined();
    // muda a quantidade: volta ao Marketing
    f.emails.length = 0;
    expect(env({ titulo: "Campanha nova" }).status).toBe("ok");
    expect(ped()).toMatchObject({ status: "proposta", edicaoPendente: true });
    expect(f.emails.map((e) => e.para)).toEqual(["deborabmlog@gmail.com"]);
    expect(acao(mcl, "aceitarPedido", { cronograma: cron }).mensagem).toMatch(/não está disponível/); // aceite bloqueado até a aprovação
    expect(acao(deb, "recusarProposta", { nota: "Não quero" }).mensagem).toMatch(/não está disponível/); // edição não se recusa
    expect(acao(deb, "aprovarProposta").status).toBe("ok");
    expect(ped()).toMatchObject({ status: "enviada", edicaoPendente: false });
  });

  it("cancelar o pedido não existe no portal (fica só no contrato)", () => {
    expect(acao(deb, "cancelar", { nota: "Campanha adiada." }).status).toBe("erro");
    expect(ped().status).not.toBe("cancelada");
  });


});

describe("solicitação criada pelo Marcelo (proposta em nome da Débora)", () => {
  let f: ReturnType<typeof fake>;
  let adm: string, deb: string, mcl: string;
  let seq = 0;
  const fila = (tipo: string, uid: string, dados: unknown) => {
    const id = `m${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo, uid, clienteId: "bmlog", status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    processarFila(f.p);
    return f.doc(`fila/${id}`);
  };
  const base = {
    titulo: "Outubro Rosa", unidade: "Matriz · Itajaí/SC", email: "marcelo@propaga.com", objetivo: "Engajar", publico: "Ambos os públicos",
    itens: [{ cod: "01", variante: 0, qtd: 2, opcao: "4:5" }],
    drive: { link: "https://drive.google.com/drive/folders/abc", conferido: true }, obs: "", prazo: { desejada: "2026-10-20", urgente: false }, conferido: true,
  };
  const acao = (uid: string, acao: string, extra: Record<string, unknown> = {}) => fila("acao", uid, { protocolo: "BML-2026-0001", acao, ...extra });
  const ped = () => f.doc("clientes/bmlog/solicitacoes/BML-2026-0001");
  beforeEach(() => {
    f = fake();
    adm = convidar(f.p, { nome: "Marco Chaves", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    deb = convidar(f.p, { nome: "Débora", email: "deborabmlog@gmail.com", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    mcl = convidar(f.p, { nome: "Marcelo H. Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    convidar(f.p, { nome: "Mariane Garcia", email: "contato@mondesign.com.br", papel: "criativo" }, { uid: adm, nome: "Marco" });
    f.emails.length = 0;
  });

  it("Marcelo cria → fica em nome da Débora como proposta e só ela é avisada", () => {
    expect(fila("enviar", mcl, base).resultado).toEqual({ protocolo: "BML-2026-0001", proposta: true });
    expect(ped()).toMatchObject({ status: "proposta", solicitanteUid: deb, solicitanteNome: "Débora", criadoPor: { uid: mcl, nome: "Marcelo H. Brum" } });
    expect(f.emails.map((e) => e.para)).toEqual(["deborabmlog@gmail.com"]);
    expect(f.emails[0].html).toContain("/aprovacoes/");
    expect(acao(mcl, "aceitarPedido", { cronograma: { inicio: "2026-10-05", primeira: "2026-10-09", final: "2026-10-16" } }).mensagem).toMatch(/não está disponível/);
  });

  it("dois solicitantes: o Marcelo escolhe o dono; só o dono é avisado, vê e age; o colega não", () => {
    const glauco = convidar(f.p, { nome: "Glauco", email: "glauco@bmlog.com.br", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    f.emails.length = 0;
    expect(fila("enviar", mcl, base).mensagem).toMatch(/Escolha o solicitante/); // com dois, não há escolha automática
    expect(fila("enviar", mcl, { ...base, solicitanteUid: mcl }).mensagem).toMatch(/Solicitante inválido/);
    expect(f.doc("clientes/bmlog/solicitacoes/BML-2026-0001")).toBeFalsy();
    expect(fila("enviar", mcl, { ...base, solicitanteUid: glauco }).status).toBe("ok");
    expect(ped()).toMatchObject({ status: "proposta", solicitanteUid: glauco, solicitanteNome: "Glauco" });
    expect(f.emails.map((e) => e.para)).toEqual(["glauco@bmlog.com.br"]); // a Débora não é avisada
    expect(f.emails[0].html).toMatch(/em nome do Marketing B(&amp;|&)M Log/);
    expect(acao(deb, "aprovarProposta").mensagem).toMatch(/Pedido não encontrado/);
    expect(acao(deb, "ajustarProposta", { nota: "Trocar" }).mensagem).toMatch(/Pedido não encontrado/);
    f.emails.length = 0;
    expect(acao(glauco, "ajustarProposta", { nota: "Trocar para 3 posts" }).status).toBe("ok");
    expect(ped().status).toBe("ajuste");
    expect(f.emails.map((e) => e.para)).toEqual(["marcelo@propaga.com"]);
    expect(acao(glauco, "aprovarProposta").mensagem).toMatch(/não está disponível|ajuste/i);
  });

  it("com um só solicitante o dono é automático", () => {
    expect(fila("enviar", mcl, base).status).toBe("ok");
    expect(ped()).toMatchObject({ solicitanteUid: deb });
  });

  it("Débora pede ajuste → Marcelo edita e reenvia → Débora aprova → Marcelo aceita e a Mariane recebe", () => {
    fila("enviar", mcl, base); f.emails.length = 0;
    expect(acao(deb, "ajustarProposta").mensagem).toMatch(/ajustado/);
    expect(acao(deb, "ajustarProposta", { nota: "Trocar para 3 posts" }).status).toBe("ok");
    expect(ped().status).toBe("ajuste");
    expect(f.emails.map((e) => e.para)).toEqual(["marcelo@propaga.com"]);
    f.emails.length = 0;
    expect(fila("enviar", deb, { ...base, editar: "BML-2026-0001" }).mensagem).toMatch(/atendimento/);
    expect(fila("enviar", mcl, { ...base, itens: [{ cod: "01", variante: 0, qtd: 3, opcao: "4:5" }], editar: "BML-2026-0001" }).status).toBe("ok");
    expect(ped().status).toBe("proposta");
    expect(ped().itens[0].qtd).toBe(3);
    expect(f.doc("clientes/bmlog/valores/BML-2026-0001").total).toBe(510);
    expect(f.emails.map((e) => e.para)).toEqual(["deborabmlog@gmail.com"]);
    expect(f.emails[0].html).toMatch(/2× .* → 3×/);
    f.emails.length = 0;
    expect(acao(deb, "aprovarProposta").status).toBe("ok");
    expect(ped().status).toBe("enviada");
    expect(f.emails.map((e) => e.para)).toEqual(["marcelo@propaga.com"]);
    f.emails.length = 0;
    expect(acao(mcl, "aceitarPedido", { cronograma: { inicio: "2026-10-05", primeira: "2026-10-09", final: "2026-10-16" }, pastaPropaga: "https://drive.google.com/drive/folders/propaga1" }).status).toBe("ok");
    expect(f.emails.map((e) => e.para).sort()).toEqual(["contato@mondesign.com.br", "deborabmlog@gmail.com"]);
  });

  it("Marcelo devolve à Débora com dúvida ou sugestão → ela responde na aprovação → volta ao Marcelo", () => {
    fila("enviar", deb, base); f.emails.length = 0;
    expect(ped().status).toBe("enviada");
    expect(acao(deb, "devolverDuvida", { nota: "Posso?" }).mensagem).toMatch(/não está disponível/); // só o atendimento devolve
    expect(acao(mcl, "devolverDuvida").mensagem).toMatch(/dúvida ou a sugestão/);
    expect(acao(mcl, "devolverDuvida", { nota: "Podemos trocar o formato 4:5 por 1:1?" }).status).toBe("ok");
    expect(ped().status).toBe("proposta");
    expect(f.emails.map((e) => e.para)).toEqual(["deborabmlog@gmail.com"]);
    expect(f.emails[0].html).toContain("Podemos trocar");
    f.emails.length = 0;
    expect(acao(deb, "aprovarProposta", { nota: "Pode ser 1:1." }).status).toBe("ok");
    expect(ped().status).toBe("enviada");
    expect(f.emails.map((e) => e.para)).toEqual(["marcelo@propaga.com"]);
    expect(acao(mcl, "devolverDuvida", { nota: "Outra dúvida" }).status).toBe("ok"); // pode repetir enquanto não aceita
  });

  it("Débora recusa: cancelada sem cobrança; proposta não pode ser editada nem a da Débora depois do aceite", () => {
    fila("enviar", mcl, base);
    expect(acao(deb, "recusarProposta").mensagem).toMatch(/motivo/);
    acao(deb, "recusarProposta", { nota: "Não é prioridade" });
    expect(ped().status).toBe("cancelada");
    expect(fila("enviar", mcl, { ...base, editar: "BML-2026-0001" }).mensagem).toMatch(/antes do aceite/);
  });

  it("Marcelo edita a solicitação da Débora antes do aceite: ela é avisada do que mudou", () => {
    fila("enviar", deb, base); f.emails.length = 0;
    expect(fila("enviar", mcl, { ...base, editar: "BML-2026-0001" }).mensagem).toMatch(/Nada foi alterado/);
    expect(fila("enviar", mcl, { ...base, titulo: "Outubro Rosa 2026", editar: "BML-2026-0001" }).status).toBe("ok");
    expect(ped()).toMatchObject({ status: "enviada", titulo: "Outubro Rosa 2026", solicitanteUid: deb });
    expect(f.emails.map((e) => e.para)).toEqual(["deborabmlog@gmail.com"]);
    expect(f.emails[0].html).toContain("Outubro Rosa 2026");
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
    fila("acao", mcl, { protocolo: "BML-2026-0001", acao: "aceitarPedido", cronograma: { inicio: "2026-10-05", primeira: "2026-10-09", final: "2026-10-16" }, driveVerificado: true, pastaPropaga: "https://drive.google.com/drive/folders/propaga1" });
    expect(para()).toContain("mariane@propaga.com"); // o aceite entrega o job à Mariane
    f.emails.length = 0;
  });

  it("ciclo: publicar → avaliar (aprova e refaz) → refação direto à Mariane → nova versão → revisão → Débora aprova → final → pronto para entrega", () => {
    expect(peca(deb, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }] }).mensagem).toMatch(/perfil/);
    expect(peca(mcl, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }] }).mensagem).toMatch(/perfil/); // só a Mariane cria (admin: emergência)
    expect(peca(adm, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }, { nome: "Post B", item: 0, link: link("b") }, { nome: "Post C", item: 0, link: link("c") }] }).status).toBe("ok");
    expect(ped().status).toBe("apresentacao");
    expect(para()).toEqual(["deborabmlog@gmail.com"]);

    f.emails.length = 0;
    expect(peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }] }).mensagem).toMatch(/Avalie todas/);
    expect(peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }, { id: "p2", tipo: "refacao", itens: [] }, { id: "p3", tipo: "aprovada" }] }).mensagem).toMatch(/Liste os ajustes/);
    expect(peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }, { id: "p2", tipo: "aprovada" }, { id: "p3", tipo: "cancelada", nota: "Suspensa." }] }).mensagem).toMatch(/só aprovar ou pedir refação/);
    expect(peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }, { id: "p2", tipo: "refacao", itens: ["Aumentar título", "Trocar foto"] }, { id: "p3", tipo: "aprovada" }] }).status).toBe("ok");
    expect([pc("p1").etapa, pc("p1").tarefa]).toEqual(["criativo", "final"]);   // aprovada vai direto à Mariane
    expect([pc("p3").etapa, pc("p3").tarefa]).toEqual(["criativo", "final"]); // cancelar não existe mais na avaliação
    expect([pc("p2").etapa, pc("p2").tarefa]).toEqual(["criativo", "refazer"]);   // refação vai direto à Mariane, sem passar pelo Marcelo
    expect(pc("p2").orientacao).toMatchObject({ itens: ["Aumentar título", "Trocar foto"], por: "Débora" });
    expect(ped().rodadas).toBe(1);
    expect(ped().status).toBe("producao");
    // aprovação e refação avisam o Marcelo e a Mariane (um e-mail de cada tipo para cada um)
    expect([...new Set(para())]).toEqual(["marcelo@propaga.com", "mariane@propaga.com"]);
    expect(f.emails.filter((e) => e.para === "marcelo@propaga.com").map((e) => e.assunto).join("|")).toMatch(/aprovadas|refação/i);
    expect(situacaoRelatorio(pc("p1")).rotulo).toBe("Concluída · sem refação · arquivo final em preparação");
    expect(situacaoRelatorio(pc("p2")).chave).toBe("refacao");
    f.emails.length = 0;

    expect(peca(mri, "enviarVersao", { id: "p2", link: link("b2"), feitos: 1 }).mensagem).toMatch(/Marque todos/);
    expect(peca(mri, "enviarVersao", { id: "p2", link: link("b2"), feitos: 2 }).status).toBe("ok");
    expect(pc("p2").etapa).toBe("revisao");
    expect(pc("p2").versoes).toHaveLength(2);

    // devolver (ajuste interno) não conta refação
    expect(peca(mcl, "devolver", { id: "p2", itens: ["Alinhar o logo"] }).status).toBe("ok");
    expect([pc("p2").etapa, pc("p2").versoes.length, ped().rodadas]).toEqual(["criativo", 2, 1]); // v2 fica marcada como devolvida e é substituída
    peca(mri, "enviarVersao", { id: "p2", link: link("b2"), feitos: 1 });
    f.emails.length = 0;
    expect(peca(mcl, "liberar", { ids: ["p2"], cobrar30: ["p2"] }).mensagem).toMatch(/3ª refação/); // com 1 refação ainda não há +30%
    expect(peca(mcl, "liberar", { ids: ["p2"] }).status).toBe("ok");
    expect(pc("p2").etapa).toBe("cliente");
    expect(ped().status).toBe("apresentacao");
    expect(para()).toEqual(["deborabmlog@gmail.com"]);

    peca(deb, "avaliar", { decisoes: [{ id: "p2", tipo: "aprovada" }] });
    expect(situacaoRelatorio(pc("p2")).rotulo).toBe("Concluída · 1 refação · arquivo final em preparação"); // observação do relatório na hora da aprovação
    expect(ped().status).toBe("producao"); // aprovadas, mas arquivos finais ainda em preparação
    expect(fila("acao", mcl, { protocolo: "BML-2026-0001", acao: "entregar" }).mensagem).toMatch(/peças em andamento/);
    expect(peca(mri, "finalizar", { id: "p1" }).mensagem).toMatch(/05 Arquivos abertos/);
    peca(mri, "finalizar", { id: "p1", abertos: true });
    peca(mri, "finalizar", { id: "p3", abertos: true }); // p3 agora também é aprovada
    f.emails.length = 0;
    expect(peca(mri, "finalizar", { id: "p2", abertos: true }).resultado.pronto).toBe(true);
    expect(ped().status).toBe("aprovada"); // "Pronto para entrega"
    expect(f.emails.some((e) => e.para === "marcelo@propaga.com" && /pronto para entrega/.test(e.assunto))).toBe(true);
    expect(fila("acao", mcl, { protocolo: "BML-2026-0001", acao: "entregar" }).status).toBe("ok");
    // ações antigas por pedido ficam bloqueadas
    expect(fila("acao", deb, { protocolo: "BML-2026-0001", acao: "aprovar" }).mensagem).toMatch(/Invalid option|inválid|disponível/); // ação antiga não existe mais
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
    peca(adm, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }] });
    f.docs.delete("interno/resumos/dias/2026-10-02");
    f.emails.length = 0;
    const cfg = { p: f.p };
    expect(resumoDiario(cfg.p, new Firestore(f.p, "propaga-portal"))).toBe(1);
    expect(f.emails[0].para).toBe("deborabmlog@gmail.com");
    expect(f.emails[0].assunto).toMatch(/pendências/);
    expect(resumoDiario(cfg.p, new Firestore(f.p, "propaga-portal"))).toBe(0);
  });

  it("3ª refação: +30% só quando o Marcelo marca ao enviar à Débora; criativo não avalia", () => {
    peca(adm, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }] });
    expect(peca(mri, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }] }).mensagem).toMatch(/perfil/);
    for (let i = 0; i < 3; i++) {
      peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "refacao", itens: [`Ajuste ${i}`] }] });
      expect(peca(mcl, "encaminhar", { prazo: "2026-10-07", refacoes: [{ id: "p1", itens: ["x"] }] }).status).toBe("erro"); // não existe mais
      peca(mri, "enviarVersao", { id: "p1", link: link(`a${i}`), feitos: 1 });
      peca(mcl, "liberar", { ids: ["p1"], cobrar30: i === 2 ? ["p1"] : undefined });
    }
    expect(ped().rodadas).toBe(3);
    expect(pc("p1").extras30).toBe(1); // só a 3ª conta
    peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }] });
    expect(situacaoRelatorio(pc("p1")).rotulo).toBe("Concluída · 3 refações · arquivo final em preparação");
  });
});

describe("relatório mensal da Mariane (criativo) e pagamento pela Marisa", () => {
  let f: ReturnType<typeof fake>;
  let mri: string, mrs: string, mcl: string;
  let seq = 0;
  const fila = (tipo: string, uid: string, dados: unknown) => {
    const id = `c${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo, uid, clienteId: "bmlog", status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    processarFila(f.p);
    return f.doc(`fila/${id}`);
  };
  const peca = (id: string, item: number, etapa: string, em: string, refacoes = 0) => ({
    id, nome: `Peça ${id}`, item, etapa, extras30: 0, desde: em,
    versoes: [...Array(refacoes)].map((_, k) => ({ v: k + 1, link: "x", em, por: "M", decisao: { tipo: "refacao", por: "D", em } }))
      .concat([{ v: refacoes + 1, link: "x", em, por: "M", decisao: { tipo: etapa === "encerrada" ? "cancelada" : "aprovada", por: "D", em } } as any]),
    hist: [{ em, por: "Sistema", txt: "fechada" }],
  });
  beforeEach(() => {
    f = fake();
    const adm = convidar(f.p, { nome: "Marco Chaves", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    mri = convidar(f.p, { nome: "Mariane Garcia", email: "contato@mondesign.com.br", papel: "criativo" }, { uid: adm, nome: "Marco" }).uid;
    mrs = convidar(f.p, { nome: "Marisa Coelho", email: "marisa@propaga.com", papel: "financeiro_propaga" }, { uid: adm, nome: "Marco" }).uid;
    mcl = convidar(f.p, { nome: "Marcelo H. Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    f.docs.set("clientes/bmlog/solicitacoes/BML-2026-0001", { updateTime: "t0", fields: (paraValor({
      protocolo: "BML-2026-0001", titulo: "Natal", status: "producao",
      itens: [{ cod: "01", variante: 0, qtd: 2, nome: "Post estático" }, { cod: "49", variante: 0, qtd: 1, nome: "Campanha institucional" }, { cod: "01", variante: 1, qtd: 1, nome: "Post estático" }],
      pecas: [
        peca("p1", 0, "concluida", "2026-10-10T15:00:00Z", 1),
        peca("p2", 1, "encerrada", "2026-10-20T15:00:00Z"),
        peca("p3", 2, "concluida", "2026-10-31T23:30:00Z"), // 31/10 20h30 em SP: outubro
        peca("p4", 0, "criativo", "2026-10-05T15:00:00Z"),  // em andamento: fora
        peca("p5", 0, "concluida", "2026-09-30T12:00:00Z"), // setembro: fora
      ],
    }) as any).mapValue.fields });
    f.emails.length = 0;
  });

  it("publica a tabela com a sugestão por serviço (Novo → Nova criação, Edição → Adaptação)", () => {
    configurarProjeto(f.p);
    const t = f.doc("criativo/tabela");
    expect(t.itens).toHaveLength(17);
    expect(t.mapa["01:0"]).toEqual({ item: "post", coluna: "nova" });
    expect(t.mapa["01:1"]).toEqual({ item: "post", coluna: "adaptacao" });
    expect(t.mapa["49:0"]).toEqual({ item: "complexo", coluna: "nova" });
  });

  it("Mariane envia: só peças fechadas no mês, valores da tabela dela, sob consulta exige valor; Marisa e Marco são avisados", () => {
    expect(fila("relatorioCriativo", mri, { mes: "2026-10" }).mensagem).toMatch(/Informe o valor de Peça p2/);
    const r = fila("relatorioCriativo", mri, { mes: "2026-10", ajustes: [{ chave: "BML-2026-0001:p2", item: "complexo", coluna: "nova", valor: 300 }] });
    expect(r.resultado).toEqual({ id: `${mri}_2026-10`, mes: "2026-10", total: 205, pecas: 3 }); // 45 + 50% de 300 + 10
    const rel = f.doc(`relatoriosCriativo/${mri}_2026-10`);
    expect(rel.status).toBe("enviado");
    expect(rel.linhas.map((l: any) => [l.peca, l.situacao, l.valor, l.refacoes])).toEqual([
      ["Peça p1", "aprovada", 45, 1], ["Peça p2", "cancelada", 300, 0], ["Peça p3", "aprovada", 10, 0]]);
    expect(rel.linhas[1].cobrado).toBe(150);
    const rel2 = f.emails.filter((e) => e.assunto.startsWith("Relatório de Mariane"));
    expect(rel2.map((e) => e.para).sort()).toEqual(["marco@propaga.com", "marisa@propaga.com"]);
    expect(rel2[0].assunto).toBe("Relatório de Mariane · outubro/2026");
    const cx = f.emails.filter((e) => e.assunto.startsWith("Valor de projeto complexo"));
    expect(cx.map((e) => e.para)).toEqual(["marcelo@propaga.com"]);
    expect((cx[0] as any).texto).toMatch(/Peça p2: R\$\s300,00 \(cancelada: 50%\)/);
    expect((rel2[0] as any).texto ?? rel2[0].html).toMatch(/R\$\s205,00/);
  });

  it("Mariane pode trocar o item; não pode inventar valor de item com preço fixo", () => {
    const r = fila("relatorioCriativo", mri, { mes: "2026-10", ajustes: [
      { chave: "BML-2026-0001:p1", item: "carrossel", coluna: "nova", valor: 999 },
      { chave: "BML-2026-0001:p2", item: "manipulacao", coluna: "nova" },
    ] });
    expect(r.resultado.total).toBe(90 + 22.5 + 10); // manipulação cancelada: 50% de 45
    expect(fila("relatorioCriativo", mri, { mes: "2026-10", ajustes: [{ chave: "BML-2026-0001:p1", item: "carrossel", coluna: "adaptacao" }] }).mensagem).toMatch(/não tem valor de Adaptação/);
  });

  it("sigilo e papéis: Marcelo não envia; Mariane não paga; Marisa paga e a Mariane é avisada; mês pago não é reenviado", () => {
    const aj = [{ chave: "BML-2026-0001:p2", item: "complexo", coluna: "nova", valor: 300 }];
    expect(fila("relatorioCriativo", mcl, { mes: "2026-10", ajustes: aj }).mensagem).toMatch(/Só o criativo/);
    fila("relatorioCriativo", mri, { mes: "2026-10", ajustes: aj });
    expect(fila("relatorioCriativo", mri, { mes: "2026-10", ajustes: aj }).status).toBe("ok"); // correção antes do pagamento
    expect(f.doc(`relatoriosCriativo/${mri}_2026-10`).envios).toBe(2);
    expect(fila("pagarCriativo", mri, { id: `${mri}_2026-10` }).mensagem).toMatch(/Financeiro/);
    f.emails.length = 0;
    expect(fila("pagarCriativo", mrs, { id: `${mri}_2026-10`, nota: "PIX 05/11" }).status).toBe("ok");
    expect(f.doc(`relatoriosCriativo/${mri}_2026-10`)).toMatchObject({ status: "pago", pagoPor: "Marisa Coelho", notaPagamento: "PIX 05/11" });
    expect(f.emails.filter((e) => e.assunto.startsWith("Pagamento registrado")).map((e) => e.para)).toEqual(["contato@mondesign.com.br"]);
    expect(fila("relatorioCriativo", mri, { mes: "2026-10", ajustes: aj }).mensagem).toMatch(/já foi pago/);
    expect(fila("relatorioCriativo", mri, { mes: "2026-08" }).mensagem).toMatch(/Nenhuma peça/);
  });
});

describe("pedido cancelado com cobrança de 50%: Financeiro da Propaga fatura", () => {
  it("todas as peças canceladas depois de apresentadas → tarefa Faturar para a Marisa; Mariana (B&M) não fatura", () => {
    const f = fake();
    const adm = convidar(f.p, { nome: "Marco", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "P" }).uid;
    const mrs = convidar(f.p, { nome: "Marisa Coelho", email: "marisa@propaga.com", papel: "financeiro_propaga" }, { uid: adm, nome: "M" }).uid;
    const mar = convidar(f.p, { nome: "Mariana", email: "mariana@bmlog.com.br", papel: "financeiro_cliente", clienteId: "bmlog" }, { uid: adm, nome: "M" }).uid;
    const em = "2026-10-10T12:00:00Z";
    const pc = { id: "p1", nome: "Post", item: 0, etapa: "encerrada", extras30: 0, desde: em, hist: [], versoes: [{ v: 1, link: "x", em, por: "M", decisao: { tipo: "cancelada", por: "D", em } }] };
    f.docs.set("clientes/bmlog/solicitacoes/BML-2026-0001", { updateTime: "t0", fields: (paraValor({ protocolo: "BML-2026-0001", titulo: "X", status: "cancelada", solicitanteUid: "deb", temPecas: true, versao: 1, itens: [{ cod: "01", variante: 0, qtd: 1, nome: "Post" }], pecas: [pc], prazo: {}, drive: {} }) as any).mapValue.fields });
    let n = 0;
    const acao = (uid: string, a: string) => { const id = `z${++n}`; f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo: "acao", uid, clienteId: "bmlog", status: "pendente", criadoEm: id, dados: { protocolo: "BML-2026-0001", acao: a } }) as any).mapValue.fields }); processarFila(f.p); return f.doc(`fila/${id}`); };
    expect(acao(mar, "faturar").status).toBe("erro");
    expect(acao(mrs, "faturar").status).toBe("ok");
    expect(f.doc("clientes/bmlog/solicitacoes/BML-2026-0001")).toMatchObject({ status: "faturada", canceladoCobrado: true });
    expect(acao(mrs, "registrarPagamento").status).toBe("ok");
  });
});

describe("dois criativos (criativo2): o Marcelo escolhe no aceite, só quem está com o pedido trabalha, troca e relatórios separados", () => {
  let f: ReturnType<typeof fake>;
  let deb: string, mcl: string, mri: string, cr2: string, mrs: string;
  let seq = 0;
  const fila = (tipo: string, uid: string, dados: unknown) => {
    const id = `k${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo, uid, clienteId: "bmlog", status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    processarFila(f.p);
    return f.doc(`fila/${id}`);
  };
  const ped = () => f.doc("clientes/bmlog/solicitacoes/BML-2026-0001");
  const link = (n: string) => `https://drive.google.com/file/d/${n}/view`;
  const cron = { inicio: "2026-10-05", primeira: "2026-10-09", final: "2026-10-16" };
  const pasta = "https://drive.google.com/drive/folders/propaga1";
  beforeEach(() => {
    f = fake();
    const adm = convidar(f.p, { nome: "Marco Antônio", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    deb = convidar(f.p, { nome: "Débora", email: "marcopropaga7@gmail.com", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    mcl = convidar(f.p, { nome: "Marcelo H. Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    mri = convidar(f.p, { nome: "Mariane Garcia", email: "contato@mondesign.com.br", papel: "criativo" }, { uid: adm, nome: "Marco" }).uid;
    cr2 = convidar(f.p, { nome: "Paula Criativa", email: "paula@exemplo.com", papel: "criativo" }, { uid: adm, nome: "Marco" }).uid;
    mrs = convidar(f.p, { nome: "Marisa Coelho", email: "marisa@propaga.com", papel: "financeiro_propaga" }, { uid: adm, nome: "Marco" }).uid;
    fila("enviar", deb, {
      titulo: "Campanha", unidade: "Matriz · Itajaí/SC", email: "m@bmlog.com.br", objetivo: "Reforçar", publico: "Ambos os públicos",
      itens: [{ cod: "01", variante: 0, qtd: 1, opcao: "4:5" }],
      drive: { link: "https://drive.google.com/drive/folders/abc", conferido: true }, obs: "", prazo: { desejada: "2026-10-20", urgente: false }, conferido: true,
    });
    f.emails.length = 0;
  });

  it("a equipe de criativos fica publicada para o formulário do aceite", () => {
    expect(f.doc("equipe/criativos").lista.map((x: any) => x.nome).sort()).toEqual(["Mariane Garcia", "Paula Criativa"]);
  });

  it("aceite exige a pasta no Drive da Propaga e, com dois criativos, a escolha de um", () => {
    const base = { protocolo: "BML-2026-0001", acao: "aceitarPedido", cronograma: cron, driveVerificado: true };
    expect(fila("acao", mcl, base).mensagem).toMatch(/Drive da Propaga|pasta/i);
    expect(fila("acao", mcl, { ...base, pastaPropaga: pasta }).mensagem).toMatch(/criativo/i);
    expect(fila("acao", mcl, { ...base, pastaPropaga: pasta, criativoUid: cr2 }).status).toBe("ok");
    expect(ped().criativo).toEqual({ uid: cr2, nome: "Paula Criativa" });
    expect(ped().drive.propaga).toBe(pasta);
    expect(f.emails.map((e) => e.para)).toContain("paula@exemplo.com");
    expect(f.emails.map((e) => e.para)).not.toContain("contato@mondesign.com.br");

    // só quem está com o pedido cria as peças
    expect(fila("peca", mri, { protocolo: "BML-2026-0001", acao: "publicar", pecas: [{ nome: "Post A", item: 0, link: link("a") }] }).mensagem).toMatch(/está com Paula/);
    expect(fila("peca", cr2, { protocolo: "BML-2026-0001", acao: "publicar", pecas: [{ nome: "Post A", item: 0, link: link("a") }] }).status).toBe("ok");

    // troca: só Atendimento/Admin; a Mariane assume e é avisada
    expect(fila("acao", cr2, { protocolo: "BML-2026-0001", acao: "trocarCriativo", criativoUid: mri }).status).toBe("erro");
    f.emails.length = 0;
    expect(fila("acao", mcl, { protocolo: "BML-2026-0001", acao: "trocarCriativo", criativoUid: mri }).status).toBe("ok");
    expect(ped().criativo.uid).toBe(mri);
    expect(f.emails.map((e) => e.para)).toEqual(["contato@mondesign.com.br"]);
    expect(fila("peca", cr2, { protocolo: "BML-2026-0001", acao: "devolver", id: "p1", itens: ["x"] }).status).toBe("erro");
  });

  it("cada criativo envia o próprio relatório; a Marisa paga cada um separadamente", () => {
    const pecaFechada = (id: string, uid: string, nome: string) => ({
      id, nome: `Peça ${id}`, item: 0, etapa: "concluida", extras30: 0, desde: "2026-10-10T15:00:00Z", criativo: { uid, nome },
      versoes: [{ v: 1, link: "x", em: "2026-10-10T15:00:00Z", por: nome, decisao: { tipo: "aprovada", por: "D", em: "2026-10-10T15:00:00Z" } }],
      hist: [{ em: "2026-10-10T15:00:00Z", por: "Sistema", txt: "fechada" }],
    });
    f.docs.set("clientes/bmlog/solicitacoes/BML-2026-0002", { updateTime: "t0", fields: (paraValor({
      protocolo: "BML-2026-0002", titulo: "Natal", status: "aprovada", criativo: { uid: mri, nome: "Mariane Garcia" },
      itens: [{ cod: "01", variante: 0, qtd: 3, nome: "Post estático" }],
      pecas: [pecaFechada("p1", mri, "Mariane Garcia"), pecaFechada("p2", cr2, "Paula Criativa"), pecaFechada("p3", cr2, "Paula Criativa")],
    }) as any).mapValue.fields });
    expect(fila("relatorioCriativo", mri, { mes: "2026-10" }).resultado).toMatchObject({ id: `${mri}_2026-10`, pecas: 1, total: 45 });
    expect(fila("relatorioCriativo", cr2, { mes: "2026-10" }).resultado).toMatchObject({ id: `${cr2}_2026-10`, pecas: 2, total: 90 });
    expect(f.doc(`relatoriosCriativo/${cr2}_2026-10`)).toMatchObject({ uid: cr2, nome: "Paula Criativa", status: "enviado" });
    f.emails.length = 0;
    expect(fila("pagarCriativo", mrs, { id: `${cr2}_2026-10` }).status).toBe("ok");
    expect(f.emails.filter((e) => e.assunto.startsWith("Pagamento registrado")).map((e) => e.para)).toEqual(["paula@exemplo.com"]);
    expect(f.doc(`relatoriosCriativo/${mri}_2026-10`).status).toBe("enviado");
  });
});

describe("serviço fora da tabela do criativo: proposta do criativo, aprovação do admin, entra na tabela", () => {
  let f: ReturnType<typeof fake>;
  let adm: string, mri: string, mcl: string;
  let seq = 0;
  const fila = (tipo: string, uid: string, dados: unknown) => {
    const id = `t${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo, uid, clienteId: "bmlog", status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    processarFila(f.p);
    return f.doc(`fila/${id}`);
  };
  const em = "2026-10-20T15:00:00Z";
  beforeEach(() => {
    f = fake();
    adm = convidar(f.p, { nome: "Marco Antônio", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    mri = convidar(f.p, { nome: "Mariane Garcia", email: "contato@mondesign.com.br", papel: "criativo" }, { uid: adm, nome: "Marco" }).uid;
    mcl = convidar(f.p, { nome: "Marcelo H. Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    configurarProjeto(f.p);
    f.docs.set("clientes/bmlog/solicitacoes/BML-2026-0001", { updateTime: "t0", fields: (paraValor({
      protocolo: "BML-2026-0001", titulo: "Institucional", status: "producao", criativo: { uid: mri, nome: "Mariane Garcia" },
      itens: [{ cod: "49", variante: 0, qtd: 1, nome: "Campanha institucional", varianteRotulo: "Novo" }, { cod: "01", variante: 0, qtd: 1, nome: "Post estático" }],
      pecas: [{ id: "p1", nome: "Campanha", item: 0, etapa: "concluida", extras30: 0, desde: em,
        versoes: [{ v: 1, link: "x", em, por: "M", decisao: { tipo: "aprovada", por: "D", em } }], hist: [{ em, por: "Sistema", txt: "fechada" }] }],
    }) as any).mapValue.fields });
    f.emails.length = 0;
  });
  const propor = (uid: string, extra: Record<string, unknown> = {}) =>
    fila("tabelaCriativo", uid, { acao: "propor", protocolo: "BML-2026-0001", item: 0, nome: "Campanha institucional (peça-chave)", coluna: "nova", valor: 250, ...extra });

  it("criativo propõe → admin é avisado → admin aprova com o valor acordado → item na tabela e no relatório", () => {
    expect(propor(mcl).mensagem).toMatch(/Só o criativo/);
    expect(propor(mri, { item: 1 }).mensagem).toMatch(/já está na sua tabela/);
    const r = propor(mri);
    expect(r.status).toBe("ok");
    const novo1 = f.emails.filter((e) => /Novo serviço para a tabela de Mariane/.test(e.assunto));
    expect(novo1.map((e) => e.para)).toEqual(["marco@propaga.com"]);
    expect(propor(mri).mensagem).toMatch(/aguardando aprovação/);
    const id = r.resultado.id;
    expect(fila("tabelaCriativo", mri, { acao: "aprovar", id }).mensagem).toMatch(/administração/);
    f.emails.length = 0;
    expect(fila("tabelaCriativo", adm, { acao: "aprovar", id, valor: 230 }).status).toBe("ok");
    const t = f.doc("criativo/tabela");
    const novo = t.itens.find((i: any) => i.nome === "Campanha institucional (peça-chave)");
    expect(novo).toMatchObject({ nova: 230, adaptacao: null });
    expect(novo.acordado).toMatch(/BML-2026-0001/);
    expect(t.itens[t.itens.length - 1].id).toBe("complexo"); // projeto complexo continua por último
    expect(t.mapa["49:0"]).toEqual({ item: novo.id, coluna: "nova" });
    expect(f.emails.filter((e) => /incluído na sua tabela/.test(e.assunto)).map((e) => e.para)).toEqual(["contato@mondesign.com.br"]);
    expect(fila("tabelaCriativo", adm, { acao: "aprovar", id }).mensagem).toMatch(/já foi decidida/);
    // o relatório já usa o valor acordado, sem pedir valor sob consulta
    expect(fila("relatorioCriativo", mri, { mes: "2026-10" }).resultado).toMatchObject({ total: 230, pecas: 1 });
    // uma nova proposta para o mesmo serviço não cabe mais
    expect(propor(mri).mensagem).toMatch(/já está na sua tabela/);
  });

  it("admin recusa com motivo; o criativo é avisado e pode propor de novo", () => {
    const id = propor(mri).resultado.id;
    expect(fila("tabelaCriativo", adm, { acao: "recusar", id }).mensagem).toMatch(/motivo/);
    f.emails.length = 0;
    expect(fila("tabelaCriativo", adm, { acao: "recusar", id, motivo: "Valor acima do combinado com a B&M Log." }).status).toBe("ok");
    expect(f.emails.filter((e) => /não aprovada/.test(e.assunto)).map((e) => e.para)).toEqual(["contato@mondesign.com.br"]);
    expect(f.doc("criativo/adicionais").propostas[0]).toMatchObject({ status: "recusada", decididoPor: "Marco Antônio" });
    expect(f.doc("criativo/tabela").mapa["49:0"].item).toBe("complexo");
    expect(propor(mri, { valor: 200 }).status).toBe("ok");
  });

  it("o criativo só cria a peça de serviço fora da tabela depois da aprovação do valor (16/10)", () => {
    const link = (n: string) => `https://drive.google.com/file/d/${n}/view`;
    const publicar = (item: number) => fila("peca", mri, { protocolo: "BML-2026-0001", acao: "publicar", pecas: [{ nome: "Peça nova", item, link: link("a") }] });
    // serviço da tabela (item 1): segue normal
    expect(publicar(1).status).toBe("ok");
    // serviço fora da tabela (item 0): bloqueado, mesmo com proposta pendente
    expect(publicar(0).mensagem).toMatch(/Proponha o valor e aguarde a aprovação/);
    const id = propor(mri).resultado.id;
    expect(publicar(0).mensagem).toMatch(/aguarde a aprovação/);
    // aprovada: libera
    expect(fila("tabelaCriativo", adm, { acao: "aprovar", id, valor: 230 }).status).toBe("ok");
    expect(publicar(0).status).toBe("ok");
  });

  it("proposta recusada não libera a criação da peça", () => {
    const id = propor(mri).resultado.id;
    fila("tabelaCriativo", adm, { acao: "recusar", id, motivo: "Valor acima do combinado." });
    const r = fila("peca", mri, { protocolo: "BML-2026-0001", acao: "publicar", pecas: [{ nome: "Peça nova", item: 0, link: "https://drive.google.com/file/d/a/view" }] });
    expect(r.mensagem).toMatch(/aguarde a aprovação/);
  });

  it("tabela de 16/10: PNG incluso (sai da tabela), Canva é nova criação e cartão vai de 2 a 5 alterações", () => {
    const t = f.doc("criativo/tabela");
    expect(t.itens.find((i: any) => i.id === "png")).toBeUndefined();
    expect(t.itens.find((i: any) => i.id === "canva")).toMatchObject({ adaptacao: null, nova: 50 });
    expect(t.itens.find((i: any) => i.id === "cartao-5")).toMatchObject({ adaptacao: 20, nova: null });
    expect(t.itens.find((i: any) => i.id === "cartao-1")).toMatchObject({ adaptacao: 10, nova: null });
  });
});

describe("arquivar a rodada de testes (fila 'arquivarRodada')", () => {
  let f: ReturnType<typeof fake>;
  let adm: string, mcl: string;
  let seq = 0;
  const fila = (tipo: string, uid: string, dados: unknown) => {
    const id = `a${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo, uid, clienteId: "bmlog", status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    processarFila(f.p);
    return f.doc(`fila/${id}`);
  };
  beforeEach(() => {
    f = fake();
    adm = convidar(f.p, { nome: "Marco", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    mcl = convidar(f.p, { nome: "Marcelo H. Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    const deb = convidar(f.p, { nome: "Débora", email: "marcopropaga7@gmail.com", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    configurarProjeto(f.p);
    fila("enviar", deb, {
      titulo: "Teste", unidade: "Matriz · Itajaí/SC", email: "m@bmlog.com.br", objetivo: "Reforçar", publico: "Ambos os públicos",
      itens: [{ cod: "01", variante: 0, qtd: 1, opcao: "4:5" }],
      drive: { link: "https://drive.google.com/drive/folders/abc", conferido: true }, obs: "", prazo: { desejada: "2026-10-20", urgente: false }, conferido: true,
    });
  });

  it("só o admin e só com a palavra ARQUIVAR", () => {
    expect(fila("arquivarRodada", mcl, { confirmar: "ARQUIVAR" }).status).toBe("erro");
    expect(fila("arquivarRodada", adm, {}).status).toBe("erro");
    expect(f.docs.has("clientes/bmlog/solicitacoes/BML-2026-0001")).toBe(true);
  });

  it("copia para arquivo/, remove o pedido, zera a numeração e mantém usuários e tabela", () => {
    const r = fila("arquivarRodada", adm, { confirmar: "ARQUIVAR" });
    expect(r.status).toBe("ok");
    const rodada = [...f.docs.keys()].find((k) => /^arquivo\/[^/]+$/.test(k))!;
    expect(f.doc(rodada).itens).toBeGreaterThan(2);
    const guardados = [...f.docs.keys()].filter((k) => k.startsWith(`${rodada}/itens/`));
    expect(guardados.some((k) => k.endsWith("clientes~bmlog~solicitacoes~BML-2026-0001"))).toBe(true);
    expect([...f.docs.keys()].some((k) => k.startsWith("clientes/bmlog/solicitacoes/"))).toBe(false);
    expect([...f.docs.keys()].some((k) => k.startsWith("clientes/bmlog/valores/"))).toBe(false);
    expect(f.doc("interno/contadores/protocolos/bmlog-2026").n).toBe(0);
    expect(f.doc("criativo/tabela").itens).toHaveLength(17);
    expect(f.docs.has(`usuarios/${mcl}`)).toBe(true);
  });

  it("sem nada a arquivar, não cria arquivo", () => {
    fila("arquivarRodada", adm, { confirmar: "ARQUIVAR" });
    const antes = [...f.docs.keys()].filter((k) => k.startsWith("arquivo/")).length;
    expect(fila("arquivarRodada", adm, { confirmar: "ARQUIVAR" }).status).toBe("ok");
    expect([...f.docs.keys()].filter((k) => k.startsWith("arquivo/")).length).toBe(antes);
  });
});

describe("publicação nas redes sociais (fila 'publicacao'): calendário do Kauan → Marcelo → Débora → Mariane → Kauan", () => {
  let f: ReturnType<typeof fake>;
  let deb: string, adm: string, mcl: string, mri: string, kau: string, seq = 0;
  const fila = (tipo: string, uid: string, dados: unknown) => {
    const id = `z${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo, uid, clienteId: "bmlog", status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    processarFila(f.p);
    return f.doc(`fila/${id}`);
  };
  const peca = (uid: string, acao: string, extra: Record<string, unknown> = {}) => fila("peca", uid, { protocolo: "BML-2026-0001", acao, ...extra });
  const pub = (uid: string, acao: string, extra: Record<string, unknown> = {}) => fila("publicacao", uid, { acao, ...extra });
  const ped = () => f.doc("clientes/bmlog/solicitacoes/BML-2026-0001");
  const cal = () => f.doc("clientes/bmlog/calendarios/2026-10");
  const item = (id = "p1") => cal().itens.find((x: any) => x.id === id);
  const ref = (id = "p1") => ({ mes: "2026-10", id });
  const link = (n: string) => `https://drive.google.com/file/d/${n}/view`;
  const para = () => f.emails.map((e) => e.para).sort();
  const post = (extra: Record<string, unknown> = {}) => ({ titulo: "Dia do motorista", canais: ["Instagram", "LinkedIn"], data: "2026-10-12", hora: "09:30", legenda: "Seguimos juntos na logística.", ...extra });
  beforeEach(() => {
    f = fake();
    adm = convidar(f.p, { nome: "Marco Chaves", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    deb = convidar(f.p, { nome: "Débora", email: "deborabmlog@gmail.com", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    mcl = convidar(f.p, { nome: "Marcelo Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    mri = convidar(f.p, { nome: "Mariane", email: "mariane@propaga.com", papel: "criativo" }, { uid: adm, nome: "Marco" }).uid;
    kau = convidar(f.p, { nome: "Kauan Guerreiro", email: "kauan@propaga.com", papel: "midia_social" }, { uid: adm, nome: "Marco" }).uid;
    fila("enviar", deb, {
      titulo: "Campanha", unidade: "Matriz · Itajaí/SC", email: "m@bmlog.com.br", objetivo: "Reforçar", publico: "Ambos os públicos",
      itens: [{ cod: "01", variante: 0, qtd: 2, opcao: "4:5" }],
      drive: { link: "https://drive.google.com/drive/folders/abc", conferido: true }, obs: "", prazo: { desejada: "2026-10-20", urgente: false }, conferido: true,
    });
    fila("acao", mcl, { protocolo: "BML-2026-0001", acao: "aceitarPedido", cronograma: { inicio: "2026-10-05", primeira: "2026-10-09", final: "2026-10-16" }, driveVerificado: true, pastaPropaga: "https://drive.google.com/drive/folders/propaga" });
    peca(adm, "publicar", { pecas: [{ nome: "Post A", item: 0, link: link("a") }, { nome: "Post B", item: 0, link: link("b") }] });
    f.emails.length = 0;
  });
  const aprovarCalendario = (id = "p1") => { pub(kau, "enviarCalendario", { itens: [post()] }); pub(mcl, "enviarADebora", { itens: [ref(id)] }); pub(deb, "avaliarCalendario", { decisoes: [{ ...ref(id), tipo: "aprovada" }] }); };
  const aprovarArte = (idPeca = "p1") => { peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }, { id: "p2", tipo: "aprovada" }] }); peca(mri, "finalizar", { id: idPeca, abertos: true }); };

  it("ciclo do mês: calendário → Marcelo → Débora → vínculo → arte aprovada → agenda → publica; o pedido não muda de status por isso", () => {
    // Kauan envia o calendário (validações)
    expect(pub(mcl, "enviarCalendario", { itens: [post()] }).mensagem).toMatch(/perfil/);
    expect(pub(kau, "enviarCalendario", { itens: [post({ titulo: " " })] }).mensagem).toMatch(/tema/);
    expect(pub(kau, "enviarCalendario", { itens: [post({ canais: [] })] }).mensagem).toMatch(/canal/);
    expect(pub(kau, "enviarCalendario", { itens: [post({ canais: ["TikTok"] })] }).mensagem).toMatch(/Canal inválido/);
    expect(pub(kau, "enviarCalendario", { itens: [post({ legenda: "  " })] }).mensagem).toMatch(/legenda/);
    expect(pub(kau, "enviarCalendario", { itens: [post({ data: "2026-10-05" })] }).mensagem).toMatch(/justifique a urgência/);
    expect(pub(kau, "enviarCalendario", { itens: [post(), post({ titulo: "Urgente", data: "2026-10-05", urgente: "Data comemorativa" })] }).status).toBe("ok");
    expect(cal().itens.length).toBe(2);
    expect(item().etapa).toBe("analise");
    expect(para()).toEqual(["marcelo@propaga.com"]);

    // Marcelo devolve um; Kauan corrige
    f.emails.length = 0;
    expect(pub(mcl, "devolverCalendario", { itens: [ref()], motivo: "" }).status).toBe("erro");
    expect(pub(mcl, "devolverCalendario", { itens: [ref()], motivo: "Trocar o horário" }).status).toBe("ok");
    expect(item().etapa).toBe("ajuste");
    expect(para()).toEqual(["kauan@propaga.com"]);
    expect(pub(kau, "enviarCalendario", { itens: [{ ...post({ hora: "11:00" }), ...ref() }] }).status).toBe("ok");
    expect(item().hora).toBe("11:00");
    expect(item("p2").etapa).toBe("analise");

    // Marcelo envia à Débora; só ela (ou admin) aprova
    f.emails.length = 0;
    expect(pub(kau, "enviarADebora", { itens: [ref()] }).mensagem).toMatch(/perfil/);
    expect(pub(mcl, "enviarADebora", { itens: [ref(), ref("p2")] }).status).toBe("ok");
    expect(para()).toEqual(["deborabmlog@gmail.com"]);
    expect(pub(mcl, "avaliarCalendario", { decisoes: [{ ...ref(), tipo: "aprovada" }] }).mensagem).toMatch(/perfil/);
    f.emails.length = 0;
    expect(pub(deb, "avaliarCalendario", { decisoes: [{ ...ref(), tipo: "ajuste" }] }).mensagem).toMatch(/ajuste pedido/);
    expect(pub(deb, "avaliarCalendario", { decisoes: [{ ...ref(), tipo: "ajuste", nota: "Legenda mais curta" }, { ...ref("p2"), tipo: "aprovada" }] }).status).toBe("ok");
    expect(item().etapa).toBe("analise");           // volta ao Marcelo
    expect(item().ajuste.de).toBe("debora");
    expect(item("p2").etapa).toBe("aprovado");
    expect([...new Set(para())]).toEqual(["kauan@propaga.com", "marcelo@propaga.com"]); // aprovado volta a Marcelo e Kauan
    pub(mcl, "devolverCalendario", { itens: [ref()], motivo: "A Débora pede legenda mais curta" });
    pub(kau, "enviarCalendario", { itens: [{ ...post({ legenda: "Logística com cuidado." }), ...ref() }] });
    pub(mcl, "enviarADebora", { itens: [ref()] });
    expect(pub(deb, "avaliarCalendario", { decisoes: [{ ...ref(), tipo: "aprovada" }] }).status).toBe("ok");
    expect(item().etapa).toBe("aprovado");

    // Marcelo vincula as peças da Mariane aos posts
    const statusAntes = ped().status;
    expect(pub(kau, "vincular", { ...ref(), protocolo: "BML-2026-0001", pecaId: "p1" }).mensagem).toMatch(/perfil/);
    expect(pub(mcl, "vincular", { ...ref(), protocolo: "BML-2026-0001", pecaId: "zz" }).mensagem).toMatch(/não encontrada/);
    expect(pub(mcl, "vincular", { ...ref(), protocolo: "BML-2026-0001", pecaId: "p1" }).status).toBe("ok");
    expect(pub(mcl, "vincular", { ...ref("p2"), protocolo: "BML-2026-0001", pecaId: "p1" }).mensagem).toMatch(/já está vinculada/);
    expect(item().peca.nome).toBe("Post A");
    expect(ped().pecas.find((x: any) => x.id === "p1").cal).toEqual({ mes: "2026-10", id: "p1" });

    // Kauan ainda não agenda: arte não aprovada
    expect(pub(kau, "agendar", { itens: [ref()] }).mensagem).toMatch(/ainda não foi aprovada/);
    // Débora aprova a arte; Mariane entrega o arquivo final; Kauan é avisado nesse momento
    peca(deb, "avaliar", { decisoes: [{ id: "p1", tipo: "aprovada" }, { id: "p2", tipo: "aprovada" }] });
    expect(pub(kau, "agendar", { itens: [ref()] }).mensagem).toMatch(/ainda não foi aprovada/); // falta o arquivo final
    f.emails.length = 0;
    peca(mri, "finalizar", { id: "p1", abertos: true });
    expect(para()).toContain("kauan@propaga.com");

    expect(pub(kau, "agendar", { itens: [ref()] }).status).toBe("ok");
    expect(item().etapa).toBe("agendada");
    expect(pub(kau, "publicar", { itens: [{ ...ref(), data: "2026-10-02" }] }).mensagem).toMatch(/link da publicação/);
    expect(pub(kau, "publicar", { itens: [{ ...ref(), data: "2026-10-09", link: "https://instagram.com/p/x" }] }).mensagem).toMatch(/futura/);
    expect(pub(kau, "publicar", { itens: [{ ...ref(), data: "2026-10-02", link: "https://instagram.com/p/x" }] }).status).toBe("ok");
    expect(item().etapa).toBe("publicada");
    expect(item().hist.length).toBeGreaterThan(8);              // histórico preservado
    expect(ped().status).not.toBe("entregue");
    expect(ped().status).toBe(statusAntes === "entregue" ? "entregue" : ped().status);
  });

  it("arte devolvida pelo Kauan volta ao Marcelo, que reenvia; sem link exige justificativa", () => {
    aprovarCalendario();
    pub(mcl, "vincular", { ...ref(), protocolo: "BML-2026-0001", pecaId: "p1" });
    expect(pub(kau, "devolverArte", { ...ref(), motivo: "Sem a versão para stories" }).mensagem).toMatch(/ainda não está pronta/);
    aprovarArte();
    f.emails.length = 0;
    expect(pub(kau, "devolverArte", { ...ref(), motivo: "" }).status).toBe("erro");
    const rr = pub(kau, "devolverArte", { ...ref(), motivo: "Arquivo sem a versão para stories" });
    expect(rr.mensagem ?? "").toBe("");
    expect(rr.status).toBe("ok");
    expect(para()).toEqual(["marcelo@propaga.com"]);
    expect(item().etapa).toBe("devolvida");
    expect(pub(kau, "reenviarArte", { itens: [ref()] }).mensagem).toMatch(/perfil/);
    expect(pub(mcl, "reenviarArte", { itens: [ref()] }).status).toBe("ok");
    expect(item().etapa).toBe("aprovado");
    pub(kau, "agendar", { itens: [ref()] });
    expect(pub(kau, "publicar", { itens: [{ ...ref(), data: "2026-10-02", semLink: "Story sem link público" }] }).status).toBe("ok");
    expect(item().publicada.semLink).toBe("Story sem link público");
  });

  it("post avulso guarda a etiqueta e segue o mesmo caminho de aprovação", () => {
    expect(pub(kau, "enviarCalendario", { itens: [post({ avulso: true })] }).status).toBe("ok");
    expect(item().avulso).toBe(true);
    expect(item().etapa).toBe("analise");
  });

  it("agendar exige peça vinculada; Débora de outro cliente não vê; resumo diário lista as pendências", () => {
    aprovarCalendario();
    expect(pub(kau, "agendar", { itens: [ref()] }).mensagem).toMatch(/não vinculou/);
    f.docs.delete("interno/resumos/dias/2026-10-02");
    f.emails.length = 0;
    expect(resumoDiario(f.p, new Firestore(f.p, "propaga-portal"))).toBeGreaterThan(0);
    const m = f.emails.find((e) => e.para === "marcelo@propaga.com");
    expect(m?.html).toMatch(/Dia do motorista/);
  });
});

describe("vínculo profissional × cliente (etapa 3a)", () => {
  let f: ReturnType<typeof fake>;
  let adm: string, deb: string, m1: string, m2: string, cr1: string, cr2: string;
  let seq = 0;
  const fila = (tipo: string, uid: string, dados: unknown) => {
    const id = `v${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo, uid, clienteId: "bmlog", status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    processarFila(f.p);
    return f.doc(`fila/${id}`);
  };
  const base = {
    titulo: "Campanha", unidade: "Matriz · Itajaí/SC", email: "m@bmlog.com.br", objetivo: "Reforçar", publico: "Ambos os públicos",
    itens: [{ cod: "01", variante: 0, qtd: 2, opcao: "4:5" }],
    drive: { link: "https://drive.google.com/drive/folders/abc", conferido: true }, obs: "", prazo: { desejada: "2026-10-20", urgente: false }, conferido: true,
  };
  const cron = { inicio: "2026-10-05", primeira: "2026-10-09", final: "2026-10-16" };
  const fsx = () => new Firestore(f.p, "propaga-portal");
  const acao = (uid: string, a: string, extra: Record<string, unknown> = {}) => fila("acao", uid, { protocolo: "BML-2026-0001", acao: a, ...extra });
  const ped = () => f.doc("clientes/bmlog/solicitacoes/BML-2026-0001");
  const usr = (uid: string) => f.doc(`usuarios/${uid}`);
  beforeEach(() => {
    f = fake();
    adm = convidarBase(f.p, { nome: "Marco Chaves", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    deb = convidarBase(f.p, { nome: "Débora", email: "deborabmlog@gmail.com", papel: "solicitante", clienteId: "bmlog" }, { uid: adm, nome: "Marco" }).uid;
    m1 = convidarBase(f.p, { nome: "Marcelo Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    m2 = convidarBase(f.p, { nome: "Paulo Cobertura", email: "paulo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    cr1 = convidarBase(f.p, { nome: "Mariane Garcia", email: "contato@mondesign.com.br", papel: "criativo" }, { uid: adm, nome: "Marco" }).uid;
    cr2 = convidarBase(f.p, { nome: "Paula Criativa", email: "paula@exemplo.com", papel: "criativo" }, { uid: adm, nome: "Marco" }).uid;
    f.emails.length = 0;
  });

  it("profissional novo nasce sem clientes; reenviar o convite não apaga vínculos", () => {
    expect(usr(m1).clientes).toEqual([]);
    definirVinculos(fsx(), { uid: m1, clientes: ["bmlog"] });
    convidarBase(f.p, { nome: "Marcelo Brum", email: "marcelo@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" });
    expect(usr(m1).clientes).toEqual(["bmlog"]);
    expect(usr(deb).clientes).toBeUndefined(); // perfil de cliente não usa vínculo
  });

  it("sem vínculo, o atendimento não cria pedido nem age; com vínculo, sim", () => {
    expect(fila("enviar", m1, base).mensagem).toMatch(/não está vinculado/);
    definirVinculos(fsx(), { uid: m1, clientes: ["bmlog"] });
    expect(fila("enviar", deb, base).status).toBe("ok");
    expect(acao(m2, "aceitarPedido", { cronograma: cron, pastaPropaga: "https://drive.google.com/drive/folders/p" }).mensagem).toMatch(/não está vinculado/);
    expect(ped().status).toBe("enviada");
  });

  it("atendimento é único por cliente: quem assume tira o anterior", () => {
    definirVinculos(fsx(), { uid: m1, clientes: ["bmlog"] });
    const r = definirVinculos(fsx(), { uid: m2, clientes: ["bmlog"] });
    expect(r.substituiu).toEqual(["Marcelo Brum"]);
    expect(usr(m1).clientes).toEqual([]);
    expect(usr(m2).clientes).toEqual(["bmlog"]);
    expect(() => definirVinculos(fsx(), { uid: deb, clientes: ["bmlog"] })).toThrow(/não usa vínculos/);
    expect(() => definirVinculos(fsx(), { uid: m1, clientes: ["inexistente"] })).toThrow(/Cliente não encontrado/);
  });

  it("só o admin define vínculos pela fila", () => {
    expect(fila("vinculos", m1, { uid: m1, clientes: ["bmlog"] }).mensagem).toMatch(/Somente o administrador/);
    expect(fila("vinculos", adm, { uid: m1, clientes: ["bmlog"] }).status).toBe("ok");
    expect(usr(m1).clientes).toEqual(["bmlog"]);
  });

  it("avisos de nova solicitação vão só ao atendimento vinculado; o criativo da lista é só o vinculado", () => {
    definirVinculos(fsx(), { uid: m1, clientes: ["bmlog"] });
    definirVinculos(fsx(), { uid: cr1, clientes: ["bmlog"] });
    f.emails.length = 0;
    fila("enviar", deb, base);
    expect(f.emails.map((e) => e.para).sort()).toEqual(["deborabmlog@gmail.com", "marcelo@propaga.com", "marco@propaga.com"]); // recibo da Débora; Paulo (sem vínculo) fora
    expect(f.doc("equipe/criativos").porCliente.bmlog.map((x: { uid: string }) => x.uid)).toEqual([cr1]);
    // aceite: só a Mariane é elegível; a Paula (sem vínculo) não
    expect(acao(m1, "aceitarPedido", { cronograma: cron, pastaPropaga: "https://drive.google.com/drive/folders/p", criativoUid: cr2 }).mensagem).toMatch(/Criativo não encontrado/);
    expect(acao(m1, "aceitarPedido", { cronograma: cron, pastaPropaga: "https://drive.google.com/drive/folders/p" }).status).toBe("ok");
    expect(ped()).toMatchObject({ criativo: { uid: cr1 }, criativoUid: cr1 });
  });

  it("trocar o criativo atualiza criativoUid; pedido novo nasce sem criativo", () => {
    definirVinculos(fsx(), { uid: m1, clientes: ["bmlog"] });
    definirVinculos(fsx(), { uid: cr1, clientes: ["bmlog"] });
    definirVinculos(fsx(), { uid: cr2, clientes: ["bmlog"] });
    fila("enviar", deb, base);
    expect(ped().criativoUid).toBe("");
    acao(m1, "aceitarPedido", { cronograma: cron, pastaPropaga: "https://drive.google.com/drive/folders/p", criativoUid: cr1 });
    expect(ped().criativoUid).toBe(cr1);
    expect(acao(m1, "trocarCriativo", { criativoUid: cr2, nota: "Cobertura" }).status).toBe("ok");
    expect(ped()).toMatchObject({ criativo: { uid: cr2 }, criativoUid: cr2 });
  });

  it("migração: profissionais antigos sem 'clientes' ficam na B&M Log e pedidos ganham criativoUid", () => {
    const x = fsx();
    x.gravar([{ caminho: `usuarios/${m1}`, mesclar: true, dados: { clientes: null as unknown as string[] } }]);
    // simula cadastro legado: remove o campo
    f.docs.get(`usuarios/${m1}`)!.fields = Object.fromEntries(Object.entries(f.docs.get(`usuarios/${m1}`)!.fields).filter(([k]) => k !== "clientes"));
    f.docs.set("clientes/bmlog/solicitacoes/BML-2026-0009", { updateTime: "t0", fields: (paraValor({ protocolo: "BML-2026-0009", criativo: { uid: cr1, nome: "Mariane" } }) as any).mapValue.fields });
    configurarProjeto(f.p);
    expect(usr(m1).clientes).toEqual(["bmlog"]);
    expect(f.doc("clientes/bmlog/solicitacoes/BML-2026-0009").criativoUid).toBe(cr1);
    configurarProjeto(f.p); // idempotente
    expect(usr(m1).clientes).toEqual(["bmlog"]);
    expect(usr(m2).clientes).toEqual([]); // quem já tinha o campo não muda
  });
});

describe("dois clientes: protocolo, desconto e isolamento (Pet Teste × Varejo Teste)", () => {
  let f: ReturnType<typeof fake>;
  let adm: string, pet: string, varejo: string, atPet: string, atVar: string;
  let seq = 0;
  const pedidoDe = (id: "pet" | "varejo") => ({
    titulo: "Post de teste", unidade: CLIENTES[id].unidades[0], email: "m@teste.com", objetivo: "Reforçar", publico: CLIENTES[id].publicos[0].valor,
    itens: [{ cod: "01", variante: 0, qtd: 1, opcao: "4:5" }],
    drive: { link: "https://drive.google.com/drive/folders/abc123", conferido: true },
    obs: "", prazo: { desejada: "2026-10-20", urgente: false }, conferido: true,
  });
  const enfileirar = (uid: string, dados: unknown, clienteId: string) => {
    const id = `d${++seq}`;
    f.docs.set(`fila/${id}`, { updateTime: "t0", fields: (paraValor({ tipo: "enviar", uid, clienteId, status: "pendente", criadoEm: id, dados }) as any).mapValue.fields });
    return id;
  };
  beforeEach(() => {
    f = fake();
    adm = convidarBase(f.p, { nome: "Marco Chaves", email: "marco@propaga.com", papel: "admin" }, { uid: "sistema", nome: "Portal" }).uid;
    pet = convidarBase(f.p, { nome: "Paula Pet", email: "paula@pet-teste.com", papel: "solicitante", clienteId: "pet" }, { uid: adm, nome: "Marco" }).uid;
    varejo = convidarBase(f.p, { nome: "Vera Varejo", email: "vera@varejo-teste.com", papel: "solicitante", clienteId: "varejo" }, { uid: adm, nome: "Marco" }).uid;
    atPet = convidarBase(f.p, { nome: "Ana Pet", email: "ana@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    atVar = convidarBase(f.p, { nome: "Beto Varejo", email: "beto@propaga.com", papel: "atendimento" }, { uid: adm, nome: "Marco" }).uid;
    definirVinculos(new Firestore(f.p, "propaga-portal"), { uid: atPet, clientes: ["pet"] });
    definirVinculos(new Firestore(f.p, "propaga-portal"), { uid: atVar, clientes: ["varejo"] });
    f.emails.length = 0;
  });

  it("cada cliente grava no próprio caminho, com protocolo e desconto próprios", () => {
    const a = enfileirar(pet, pedidoDe("pet"), "pet");
    const b = enfileirar(varejo, pedidoDe("varejo"), "varejo");
    expect(processarFila(f.p)).toEqual({ ok: 2, erro: 0 });
    expect(f.doc(`fila/${a}`).resultado).toEqual({ protocolo: "PET-2026-0001" });
    expect(f.doc(`fila/${b}`).resultado).toEqual({ protocolo: "VAR-2026-0001" });
    expect(f.doc("clientes/pet/solicitacoes/PET-2026-0001").solicitanteUid).toBe(pet);
    expect(f.doc("clientes/varejo/solicitacoes/VAR-2026-0001").solicitanteUid).toBe(varejo);
    expect(f.docs.has("clientes/varejo/solicitacoes/PET-2026-0001")).toBe(false);
    expect(f.docs.has("clientes/pet/solicitacoes/VAR-2026-0001")).toBe(false);
    // serviço 01 (referência 200): Pet 10% → 180; Varejo 5% → 190 (B&M Log 15% daria 170)
    expect(f.doc("clientes/pet/valores/PET-2026-0001").total).toBe(180);
    expect(f.doc("clientes/varejo/valores/VAR-2026-0001").total).toBe(190);
  });

  it("os avisos de um pedido só chegam a quem é do cliente dele", () => {
    enfileirar(pet, pedidoDe("pet"), "pet");
    processarFila(f.p);
    expect(f.emails.map((e) => e.para).sort()).toEqual(["ana@propaga.com", "marco@propaga.com", "paula@pet-teste.com"]);
    f.emails.length = 0;
    enfileirar(varejo, pedidoDe("varejo"), "varejo");
    processarFila(f.p);
    expect(f.emails.map((e) => e.para).sort()).toEqual(["beto@propaga.com", "marco@propaga.com", "vera@varejo-teste.com"]);
  });

  it("os e-mails do pedido saem na identidade do cliente dele (nome e cores), sem rastro da B&M Log", () => {
    enfileirar(pet, pedidoDe("pet"), "pet");
    processarFila(f.p);
    for (const e of f.emails) {
      expect(e.html).toContain("Portal MKT Pet Teste");
      expect(e.html).toContain(`background:${CLIENTES.pet.marca.cores.escura}`);
      expect(e.html).not.toMatch(/B&amp;M|#003C57|#55C5D0/);
    }
    f.emails.length = 0;
    enfileirar(varejo, pedidoDe("varejo"), "varejo");
    processarFila(f.p);
    for (const e of f.emails) {
      expect(e.html).toContain("Portal MKT Varejo Teste");
      expect(e.html).not.toContain("Pet Teste");
    }
  });

  it("quem é de um cliente não age no outro (solicitante e atendimento sem vínculo)", () => {
    const a = enfileirar(pet, pedidoDe("varejo"), "varejo");   // solicitante do Pet no Varejo
    const b = enfileirar(atPet, pedidoDe("varejo"), "varejo"); // atendimento só do Pet no Varejo
    const c = enfileirar(atPet, pedidoDe("pet"), "pet");        // o mesmo atendimento no Pet: pode
    processarFila(f.p);
    expect(f.doc(`fila/${a}`).status).toBe("erro");
    expect(f.doc(`fila/${a}`).mensagem).toMatch(/Cliente inválido/);
    expect(f.doc(`fila/${b}`).status).toBe("erro");
    expect(f.doc(`fila/${b}`).mensagem).toMatch(/não está vinculado/);
    expect(f.doc(`fila/${c}`).status).toBe("ok");
    expect([...f.docs.keys()].some((k) => k.startsWith("clientes/varejo/solicitacoes/"))).toBe(false);
  });

  it("o catálogo publicado de cada cliente traz o preço com o desconto dele e nunca a referência", () => {
    configurarProjeto(f.p);
    const preco = (c: string) => f.doc(`clientes/${c}/catalogo/1.0`).servicos[0].variantes[0].preco;
    expect([preco("bmlog"), preco("pet"), preco("varejo")]).toEqual([170, 180, 190]);
    expect(f.doc("clientes/pet/catalogo/1.0").desconto).toBe(0.1);
    expect(f.doc("clientes/varejo/catalogo/1.0").desconto).toBe(0.05);
    expect(JSON.stringify(f.doc("clientes/pet/catalogo/1.0"))).not.toContain("referencia");
    expect(f.doc("interno/catalogos/versoes/pet-1.0").servicos[0].variantes[0].referencia).toBe(200);
  });
});
