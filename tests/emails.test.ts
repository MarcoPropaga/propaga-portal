import { describe, expect, it } from "vitest";
import { CLIENTES } from "@/content/clientes";
import { contraste } from "@/lib/tema";
import { emailAtualizacao, emailConvite, emailNovaSolicitacao, emailResumo, MARCA_PROPAGA } from "../apps-script/src/emails";

const h = (t: string) => t.replace(/&/g, "&amp;"); // o e-mail escapa o "&" do nome
const base = { cliente: "x", protocolo: "P-1", titulo: "T", rotulo: "R", nota: "", autor: "A", etapa: "E", link: "https://x/y" };

describe("e-mails na identidade do cliente", () => {
  it.each(Object.values(CLIENTES))("$id: cabeçalho, nome e cores vêm da marca", (c) => {
    const { html } = emailAtualizacao({ ...base, marca: c.marca });
    expect(html).toContain(h(c.marca.nomeCurto));
    expect(html).toContain(h(c.marca.rotuloPortal));
    expect(html).toContain(`background:${c.marca.cores.escura}`);
    expect(html).toContain(`background:${c.marca.cores.destaque}`);
    for (const outro of Object.values(CLIENTES).filter((o) => o.id !== c.id)) expect(html).not.toContain(h(outro.marca.rotuloPortal));
  });

  it("Pet Teste não herda nada da B&M Log", () => {
    const { html } = emailAtualizacao({ ...base, marca: CLIENTES.pet.marca });
    expect(html).not.toMatch(/B&amp;M|B&M|#003C57|#55C5D0/);
  });

  it("todos os tipos de e-mail usam a marca recebida", () => {
    const m = CLIENTES.varejo.marca;
    const nova = emailNovaSolicitacao({ ...base, solicitante: "S", unidade: "U", publico: "P", objetivo: "O", desejada: "2026-10-30", urgente: false, itens: [], marca: m });
    const convite = emailConvite({ nome: "N", link: "https://x", cliente: "C", convidadoPor: "D", marca: m });
    const resumo = emailResumo({ nome: "N", link: "https://x", linhas: [{ protocolo: "P", titulo: "T", peca: "x", etapa: "e", prazo: null, atrasada: false }], marca: m });
    for (const { html } of [nova, convite, resumo]) {
      expect(html).toContain(h(m.nomeCurto));
      expect(html).toContain(`background:${m.cores.escura}`);
      expect(html).not.toContain("#003C57");
    }
  });

  it("marca neutra da Propaga (convite da equipe): sem 'mkt' nem nome de cliente", () => {
    const { html } = emailConvite({ nome: "N", link: "https://x", cliente: "Portal Propaga", convidadoPor: "D", marca: MARCA_PROPAGA });
    expect(html).toContain("Portal Propaga");
    expect(html).not.toContain(">mkt<");
    expect(html).not.toContain("B&amp;M");
  });

  it("sem marca informada mantém o visual da B&M Log (compatibilidade)", () => {
    const { html } = emailAtualizacao(base);
    expect(html).toContain("B&amp;M Log");
  });

  it("botão e cabeçalho legíveis (AA) em todas as marcas", () => {
    for (const m of [...Object.values(CLIENTES).map((c) => c.marca), MARCA_PROPAGA]) {
      expect(contraste(m.cores.sobreDestaque ?? m.cores.escura, m.cores.destaque)).toBeGreaterThanOrEqual(4.5);
      expect(contraste("#FFFFFF", m.cores.escura)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(m.cores.destaque, m.cores.sobreDestaque ?? m.cores.escura)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
