import { describe, expect, it } from "vitest";
import { arteDe, atrasadaPub, contarPendenciasCal, erroItem, mesDe, pendentePub, semanaDe, type CalItem } from "../src/lib/publicacao";

const canais = ["Instagram", "Facebook", "LinkedIn"];
const ok = { titulo: "Dia do motorista", canais: ["Instagram"], data: "2026-10-30", hora: "09:00", legenda: "Texto" };
const item = (etapa: CalItem["etapa"], extra: Partial<CalItem> = {}): CalItem => ({ id: "p1", mes: "2026-10", ...ok, etapa, desde: "2026-10-01T10:00:00Z", hist: [], ...extra });

describe("publicação: regras compartilhadas", () => {
  it("valida o item do calendário", () => {
    expect(erroItem(ok, "2026-10-18", canais)).toBeNull();
    expect(erroItem({ ...ok, titulo: "" }, "2026-10-18", canais)).toMatch(/tema/);
    expect(erroItem({ ...ok, canais: [] }, "2026-10-18", canais)).toMatch(/canal/);
    expect(erroItem({ ...ok, hora: "9h" }, "2026-10-18", canais)).toMatch(/horário/);
    expect(erroItem({ ...ok, data: "2026-10-20" }, "2026-10-18", canais)).toMatch(/urgência/);
    expect(erroItem({ ...ok, data: "2026-10-20", urgente: "Data comemorativa" }, "2026-10-18", canais)).toBeNull();
    expect(erroItem({ ...ok, data: "2026-10-01" }, "2026-10-18", canais)).toMatch(/passou/);
  });
  it("mês e semana", () => { expect(mesDe("2026-10-18")).toBe("2026-10"); expect(semanaDe("2026-10-18")).toBe("2026-10-12"); });
  it("arte pronta só com a peça vinculada concluída", () => {
    const ped = [{ protocolo: "P1", pecas: [{ id: "a", nome: "A", etapa: "concluida" }, { id: "b", nome: "B", etapa: "cliente" }] }];
    expect(arteDe(item("aprovado"), ped)).toEqual({ vinculada: false, pronta: false });
    expect(arteDe(item("aprovado", { peca: { protocolo: "P1", id: "a", nome: "A" } }), ped).pronta).toBe(true);
    expect(arteDe(item("aprovado", { peca: { protocolo: "P1", id: "b", nome: "B" } }), ped).pronta).toBe(false);
  });
  it("pendências por perfil", () => {
    const pronta = { pronta: true }, nao = { pronta: false };
    expect(pendentePub("midia_social", item("ajuste"), nao)).toBe(true);
    expect(pendentePub("midia_social", item("aprovado"), nao)).toBe(false);
    expect(pendentePub("midia_social", item("aprovado"), pronta)).toBe(true);
    expect(pendentePub("midia_social", item("analise"), nao)).toBe(false);
    expect(pendentePub("atendimento", item("analise"), nao)).toBe(true);
    expect(pendentePub("atendimento", item("aprovado"), nao)).toBe(true);   // falta vincular a peça
    expect(pendentePub("atendimento", item("aprovado", { peca: { protocolo: "P1", id: "a", nome: "A" } }), nao)).toBe(false);
    expect(pendentePub("solicitante", item("debora"), nao)).toBe(true);
    expect(pendentePub("criativo", item("analise"), nao)).toBe(false);
    expect(contarPendenciasCal("solicitante", [{ mes: "2026-10", itens: [item("debora"), item("analise")] }], [])).toBe(1);
  });
  it("atraso conta dias úteis da etapa", () => {
    expect(atrasadaPub(item("analise"), "2026-10-20")).toBe(true);
    expect(atrasadaPub(item("analise"), "2026-10-01")).toBe(false);
    expect(atrasadaPub(item("publicada"), "2027-01-01")).toBe(false);
  });
});
