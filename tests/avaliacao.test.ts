import { describe, expect, it } from "vitest";
import { downloadAte, expiraEmDe, faseAvaliacao, restante, validarPedidoAvaliacao } from "@/lib/avaliacao";

const cfg = { horas: 48, maxPedidos: 3, servicos: ["01", "02"], diasDownload: 7 };
const t0 = new Date("2026-10-30T12:00:00Z");

describe("avaliação de 48 h (regras puras)", () => {
  it("fases: sem teste, não iniciada, ativa, expirada, aceita e recusada", () => {
    const e = { iniciadoEm: t0.toISOString(), expiraEm: expiraEmDe(t0, 48).toISOString() };
    expect(faseAvaliacao(undefined, null, t0)).toBe("contratado");
    expect(faseAvaliacao(cfg, null, t0)).toBe("nao_iniciada");
    expect(faseAvaliacao(cfg, e, new Date("2026-11-01T11:59:00Z"))).toBe("ativa");
    expect(faseAvaliacao(cfg, e, new Date("2026-11-01T12:00:00Z"))).toBe("expirada");
    expect(faseAvaliacao(cfg, { ...e, decisao: "aceita" }, new Date("2026-12-01T00:00:00Z"))).toBe("contratado");
    expect(faseAvaliacao(cfg, { ...e, decisao: "recusada" }, t0)).toBe("recusada");
  });
  it("relógio e janela de download", () => {
    const fim = expiraEmDe(t0, 48).toISOString();
    expect(restante(fim, new Date("2026-10-31T12:00:00Z"))).toEqual({ horas: 24, minutos: 0 });
    expect(restante(fim, new Date("2026-11-05T00:00:00Z"))).toEqual({ horas: 0, minutos: 0 });
    expect(downloadAte(fim, 7).toISOString()).toBe("2026-11-08T12:00:00.000Z");
  });
  it("pedido do teste: 1 post, Job liberado, no máximo 3", () => {
    expect(validarPedidoAvaliacao(cfg, [{ cod: "01", qtd: 1 }], 2)).toBeNull();
    expect(validarPedidoAvaliacao(cfg, [{ cod: "01", qtd: 1 }], 3)).toMatch(/3 pedidos/);
    expect(validarPedidoAvaliacao(cfg, [{ cod: "09", qtd: 1 }], 0)).toMatch(/não está disponível/);
    expect(validarPedidoAvaliacao(cfg, [{ cod: "01", qtd: 2 }], 0)).toMatch(/um post/);
  });
});
