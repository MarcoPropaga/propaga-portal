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
    await setDoc(doc(d, "criativo/tabela"), { itens: [] });
    await setDoc(doc(d, "relatoriosCriativo/mariane_2026-10"), { total: 355 });
    await setDoc(doc(d, "relatoriosCriativo/criativo2_2026-10"), { total: 90 });
    await setDoc(doc(d, "equipe/criativos"), { lista: [] });
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
  it("solicitantes do mesmo cliente (Débora e Glauco) leem todos os pedidos do cliente, nunca os de outro cliente", async () => {
    const glauco = { ...debora };
    await assertSucceeds(getDoc(doc(db("debora", debora), "clientes/bmlog/solicitacoes/BML-1")));
    await assertSucceeds(getDoc(doc(db("debora", debora), "clientes/bmlog/solicitacoes/BML-2"))); // pedido de outra pessoa da equipe
    await assertSucceeds(getDoc(doc(db("glauco", glauco), "clientes/bmlog/solicitacoes/BML-1")));
    await assertFails(getDoc(doc(db("x", outroCliente), "clientes/bmlog/solicitacoes/BML-1")));
  });
  it("valores: financeiros, Propaga e a equipe de marketing do cliente veem; outro cliente não", async () => {
    await assertSucceeds(getDoc(doc(db("debora", debora), "clientes/bmlog/valores/BML-1")));
    await assertSucceeds(getDoc(doc(db("glauco", { ...debora }), "clientes/bmlog/valores/BML-1")));
    await assertFails(getDoc(doc(db("x", outroCliente), "clientes/bmlog/valores/BML-1")));
    await assertSucceeds(getDoc(doc(db("mariana", mariana), "clientes/bmlog/valores/BML-1")));
  });
  it("Criativo Propaga lê pedidos, mas não vê preços nem valores", async () => {
    const mariane = { papel: "criativo", propaga: true, firebase: { sign_in_second_factor: "totp" } };
    await assertSucceeds(getDoc(doc(db("mariane", mariane), "clientes/bmlog/solicitacoes/BML-2")));
    await assertFails(getDoc(doc(db("mariane", mariane), "clientes/bmlog/catalogo/1.0")));
    await assertFails(getDoc(doc(db("mariane", mariane), "clientes/bmlog/valores/BML-1")));
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
  it("tabela da Mariane: só ela e o admin; relatório dela: ela, a Marisa e o admin; ninguém grava", async () => {
    const t2 = { firebase: { sign_in_second_factor: "totp" } };
    const mariane = { papel: "criativo", propaga: true, ...t2 };
    const marisa = { papel: "financeiro_propaga", propaga: true, ...t2 };
    const marcelo = { papel: "atendimento", propaga: true, ...t2 };
    await assertSucceeds(getDoc(doc(db("mariane", mariane), "criativo/tabela")));
    await assertSucceeds(getDoc(doc(db("marco", marco), "criativo/tabela")));
    for (const [uid, c] of [["marisa", marisa], ["marcelo", marcelo], ["debora", debora], ["mariana", mariana]] as const)
      await assertFails(getDoc(doc(db(uid, c), "criativo/tabela")));
    await assertFails(getDoc(doc(db("mariane", { papel: "criativo", propaga: true }), "criativo/tabela"))); // sem 2FA
    await assertSucceeds(getDoc(doc(db("mariane", mariane), "relatoriosCriativo/mariane_2026-10")));
    await assertFails(getDoc(doc(db("mariane", mariane), "relatoriosCriativo/criativo2_2026-10"))); // o do outro criativo
    await assertSucceeds(getDoc(doc(db("marcelo", marcelo), "equipe/criativos")));
    await assertFails(getDoc(doc(db("debora", debora), "equipe/criativos")));
    await assertSucceeds(getDoc(doc(db("marisa", marisa), "relatoriosCriativo/mariane_2026-10")));
    for (const [uid, c] of [["marcelo", marcelo], ["debora", debora], ["mariana", mariana]] as const)
      await assertFails(getDoc(doc(db(uid, c), "relatoriosCriativo/mariane_2026-10")));
    await assertFails(setDoc(doc(db("mariane", mariane), "relatoriosCriativo/2026-11"), { total: 1 }));
    await assertFails(setDoc(doc(db("mariane", mariane), "criativo/tabela"), { itens: [] }));
    const fila = (uid: string, c: Record<string, unknown>, tipo: string) => addDoc(collection(db(uid, c), "fila"), { tipo, uid, clienteId: null, dados: {}, status: "pendente", criadoEm: serverTimestamp() });
    await assertSucceeds(fila("mariane", mariane, "relatorioCriativo"));
    await assertFails(fila("marcelo", marcelo, "relatorioCriativo"));
    await assertSucceeds(fila("marisa", marisa, "pagarCriativo"));
    await assertFails(fila("mariane", mariane, "pagarCriativo"));
    await assertSucceeds(fila("mariane", mariane, "tabelaCriativo"));
    await assertFails(fila("marcelo", marcelo, "tabelaCriativo"));
    await assertFails(fila("marisa", marisa, "tabelaCriativo"));
  });
});
