import { NOME_CAL } from "@/lib/publicacao";
import { REGRAS } from "@/lib/fluxo";
import { describe, expect, it } from "vitest";
import { CLIENTES, clienteAtivo, CLIENTE_PADRAO } from "@/content/clientes";
import { aplicarMarca, contraste, validarMarca, variaveisCss } from "@/lib/tema";

describe("tema por cliente", () => {
  it("a marca de todo cliente cadastrado passa no contraste AA", () => {
    for (const c of Object.values(CLIENTES)) expect(validarMarca(c.marca), c.id).toEqual([]);
  });
  it("rejeita cor inválida e contraste baixo", () => {
    const m = { ...CLIENTES[CLIENTE_PADRAO].marca };
    expect(validarMarca({ ...m, cores: { ...m.cores, destaque: "azul" } })[0]).toMatch(/inválida/);
    expect(validarMarca({ ...m, cores: { ...m.cores, destaque: "#003C58" } }).join()).toMatch(/contraste/);
  });
  it("contraste conhecido: preto sobre branco = 21", () => {
    expect(Math.round(contraste("#000000", "#ffffff"))).toBe(21);
  });
  it("gera as variáveis CSS da marca", () => {
    const v = variaveisCss(CLIENTES[CLIENTE_PADRAO].marca);
    expect(v["--color-marca-500"]).toBe("#55C5D0");
  });
  it("sem cliente usa o padrão", () => {
    expect(clienteAtivo(null).id).toBe(CLIENTE_PADRAO);
    expect(clienteAtivo("inexistente").id).toBe(CLIENTE_PADRAO);
  });
  it("aplica o nome do cliente nos marcadores", () => {
    const m = { nomeCurto: "DalPet", equipe: "Comercial DalPet", atendimento: "Carla" };
    expect(aplicarMarca("Aguardando {equipe}. Cancelada pela {cliente}.", m)).toBe("Aguardando Comercial DalPet. Cancelada pela DalPet.");
    expect(aplicarMarca("Enviar ao {atendimento}", m)).toBe("Enviar ao Carla");
    expect(aplicarMarca("{cliente} e {cliente}", m)).toBe("DalPet e DalPet");
    expect(aplicarMarca("sem marcador", m)).toBe("sem marcador");
  });
  it("a marca da B&M Log mantém os textos atuais", () => {
    expect(aplicarMarca("{equipe}", CLIENTES[CLIENTE_PADRAO].marca)).toBe("Marketing B&M Log");
  });
  it("o atendente da B&M Log continua Marcelo nos textos de fluxo", () => {
    const m = CLIENTES[CLIENTE_PADRAO].marca;
    expect(aplicarMarca(NOME_CAL.analise, m)).toBe("Em análise (Marcelo)");
    expect(aplicarMarca(REGRAS.ajustarProposta.rotulo, m)).toBe("Pedir ajuste ao Marcelo");
    expect(aplicarMarca("{atendimento} revisa", m)).toBe("Marcelo revisa");
  });
});
