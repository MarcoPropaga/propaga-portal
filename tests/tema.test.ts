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
  it("DalPet: botão vermelho com texto branco passa; o vermelho do logo e o bege do site com marrom não passam", () => {
    const m = CLIENTES.dalpet.marca;
    expect(variaveisCss(m)["--color-on-marca"]).toBe("#FFFFFF");
    expect(variaveisCss(CLIENTES[CLIENTE_PADRAO].marca)["--color-on-marca"]).toBe("#003C57");
    expect(validarMarca({ ...m, cores: { ...m.cores, destaque: "#EC1C24" } }).join()).toMatch(/contraste/);
    expect(validarMarca({ ...m, cores: { ...m.cores, claro: "#E9E4D7", escura: "#756959" } }).join()).toBe("");  // claro não entra na validação
    expect(validarMarca({ ...m, cores: { ...m.cores, sobreDestaque: undefined } }).join()).toMatch(/Texto do botão primário/);
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
    const m = { nomeCurto: "DalPet", equipe: "Comercial DalPet" };
    expect(aplicarMarca("Aguardando {equipe}. Cancelada pela {cliente}.", m)).toBe("Aguardando Comercial DalPet. Cancelada pela DalPet.");
    expect(aplicarMarca("{cliente} e {cliente}", m)).toBe("DalPet e DalPet");
    expect(aplicarMarca("sem marcador", m)).toBe("sem marcador");
  });
  it("a marca da B&M Log mantém os textos atuais", () => {
    expect(aplicarMarca("{equipe}", CLIENTES[CLIENTE_PADRAO].marca)).toBe("Marketing B&M Log");
  });
});
