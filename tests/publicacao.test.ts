import { describe, expect, it } from "vitest";
import { erroEntrada, pendentePub, semanaDe, atrasadaPub, type Publicacao } from "../src/lib/publicacao";

const canais = ["Instagram", "Facebook", "LinkedIn"];
const ok = { canais: ["Instagram"], data: "2026-10-30", hora: "09:00", legenda: "Texto" };
const pb = (etapa: Publicacao["etapa"], desde = "2026-10-01T10:00:00Z"): Publicacao => ({ etapa, desde, versao: 1, link: "https://x", hist: [] });

describe("publicação: regras compartilhadas", () => {
  it("valida a entrada do calendário", () => {
    expect(erroEntrada(ok, "2026-10-18", canais)).toBeNull();
    expect(erroEntrada({ ...ok, canais: [] }, "2026-10-18", canais)).toMatch(/canal/);
    expect(erroEntrada({ ...ok, hora: "9h" }, "2026-10-18", canais)).toMatch(/horário/);
    expect(erroEntrada({ ...ok, data: "2026-10-20" }, "2026-10-18", canais)).toMatch(/urgência/);
    expect(erroEntrada({ ...ok, data: "2026-10-20", urgente: "Data comemorativa" }, "2026-10-18", canais)).toBeNull();
    expect(erroEntrada({ ...ok, data: "2026-10-01" }, "2026-10-18", canais)).toMatch(/passou/);
  });
  it("semana começa na segunda", () => { expect(semanaDe("2026-10-18")).toBe("2026-10-12"); expect(semanaDe("2026-10-12")).toBe("2026-10-12"); });
  it("pendências por perfil", () => {
    expect(pendentePub("midia_social", pb("receber"))).toBe(true);
    expect(pendentePub("midia_social", pb("debora"))).toBe(false);
    expect(pendentePub("atendimento", pb("analise"))).toBe(true);
    expect(pendentePub("solicitante", pb("debora"), { solicitanteUid: "a" }, "b")).toBe(false);
    expect(pendentePub("solicitante", pb("debora"), { solicitanteUid: "a" }, "a")).toBe(true);
    expect(pendentePub("criativo", pb("receber"))).toBe(false);
  });
  it("atraso conta dias úteis da etapa", () => {
    expect(atrasadaPub(pb("analise"), "2026-10-20")).toBe(true);
    expect(atrasadaPub(pb("analise"), "2026-10-01")).toBe(false);
    expect(atrasadaPub(pb("publicada"), "2027-01-01")).toBe(false);
  });
});
