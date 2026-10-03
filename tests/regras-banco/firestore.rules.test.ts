/* Testes das regras do Firestore (rodam no emulador: npm run test:regras). */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

let env: RulesTestEnvironment;
const fb2 = { firebase: { sign_in_second_factor: "totp" } };
const debora = { papel: "solicitante", clienteId: "bmlog", ...fb2 };
const mariana = { papel: "financeiro_cliente", clienteId: "bmlog", ...fb2 };
const marco = { papel: "admin", propaga: true, ...fb2 };
const outroCliente = { papel: "solicitante", clienteId: "outro", ...fb2 };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-propaga-portal",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, "clientes/bmlog"), { nome: "B&M Log" });
    await setDoc(doc(d, "clientes/bmlog/solicitacoes/BML-1"), { solicitanteUid: "debora", titulo: "x" });
    await setDoc(doc(d, "clientes/bmlog/solicitacoes/BML-2"), { solicitanteUid: "outra", titulo: "y" });
    await setDoc(doc(d, "clientes/bmlog/valores/BML-1"), { total: 100 });
    await setDoc(doc(d, "interno/catalogos/versoes/bmlog-1.0"), { x: 1 });
  });
});

const db = (uid: string, claims: Record<string, unknown>) => env.authenticatedContext(uid, claims).firestore();

describe("regras do Firestore", () => {
  it("exige segundo fator para ler dados do cliente", async () => {
    await assertFails(getDoc(doc(db("debora", { papel: "solicitante", clienteId: "bmlog" }), "clientes/bmlog")));
    await assertSucceeds(getDoc(doc(db("debora", debora), "clientes/bmlog")));
  });
  it("isola clientes", async () => {
    await assertFails(getDoc(doc(db("x", outroCliente), "clientes/bmlog")));
  });
  it("solicitante lê só os próprios pedidos", async () => {
    await assertSucceeds(getDoc(doc(db("debora", debora), "clientes/bmlog/solicitacoes/BML-1")));
    await assertFails(getDoc(doc(db("debora", debora), "clientes/bmlog/solicitacoes/BML-2")));
  });
  it("valores só para quem acessa Relatórios", async () => {
    await assertFails(getDoc(doc(db("debora", debora), "clientes/bmlog/valores/BML-1")));
    await assertSucceeds(getDoc(doc(db("mariana", mariana), "clientes/bmlog/valores/BML-1")));
  });
  it("ninguém grava pedido direto pelo navegador", async () => {
    await assertFails(setDoc(doc(db("debora", debora), "clientes/bmlog/solicitacoes/BML-9"), { solicitanteUid: "debora" }));
    await assertFails(setDoc(doc(db("marco", marco), "clientes/bmlog/valores/BML-1"), { total: 1 }));
  });
  it("referência interna de preço é inacessível", async () => {
    await assertFails(getDoc(doc(db("marco", marco), "interno/catalogos/versoes/bmlog-1.0")));
  });
  it("fila: solicitante cria ação do próprio cliente, não convite", async () => {
    const d = db("debora", debora);
    const base = { uid: "debora", clienteId: "bmlog", dados: {}, status: "pendente", criadoEm: serverTimestamp() };
    await assertSucceeds(addDoc(collection(d, "fila"), { ...base, tipo: "enviar" }));
    await assertFails(addDoc(collection(d, "fila"), { ...base, tipo: "convidar" }));
    await assertFails(addDoc(collection(d, "fila"), { ...base, tipo: "enviar", uid: "marco" }));
    await assertFails(addDoc(collection(d, "fila"), { ...base, tipo: "enviar", clienteId: "outro" }));
    await assertFails(addDoc(collection(d, "fila"), { ...base, tipo: "enviar", status: "ok" }));
    await assertFails(addDoc(collection(d, "fila"), { ...base, tipo: "enviar", extra: 1 }));
  });
  it("rascunho: cada pessoa grava e lê só o próprio", async () => {
    const d = db("debora", debora);
    await assertSucceeds(setDoc(doc(d, "clientes/bmlog/rascunhos/debora"), { dados: { titulo: "x" } }));
    await assertSucceeds(getDoc(doc(d, "clientes/bmlog/rascunhos/debora")));
    await assertFails(getDoc(doc(db("mariana", mariana), "clientes/bmlog/rascunhos/debora")));
    await assertFails(setDoc(doc(d, "clientes/bmlog/rascunhos/mariana"), { dados: {} }));
    await assertFails(setDoc(doc(db("x", outroCliente), "clientes/bmlog/rascunhos/x"), { dados: {} }));
  });
  it("catálogo público: membros leem com 2FA", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "clientes/bmlog/catalogo/1.0"), { versao: "1.0" }); });
    await assertSucceeds(getDoc(doc(db("debora", debora), "clientes/bmlog/catalogo/1.0")));
    await assertFails(getDoc(doc(db("x", outroCliente), "clientes/bmlog/catalogo/1.0")));
  });
  it("fila: admin convida", async () => {
    await assertSucceeds(addDoc(collection(db("marco", marco), "fila"), { tipo: "convidar", uid: "marco", clienteId: null, dados: {}, status: "pendente", criadoEm: serverTimestamp() }));
  });
  it("cadastro de usuários: cada um lê o seu; admin lê todos; ninguém grava", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "usuarios/debora"), { nome: "Débora" }); });
    await assertSucceeds(getDoc(doc(db("debora", debora), "usuarios/debora")));
    await assertFails(getDoc(doc(db("mariana", mariana), "usuarios/debora")));
    await assertSucceeds(getDoc(doc(db("marco", marco), "usuarios/debora")));
    await assertFails(setDoc(doc(db("debora", debora), "usuarios/debora"), { papel: "admin" }));
  });
});
