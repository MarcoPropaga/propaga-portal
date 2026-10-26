/* Tema do portal por cliente: converte a marca em variáveis CSS e confere o contraste (WCAG 2.2 AA). */
import type { Marca } from "@/content/clientes";

/** Variáveis CSS que o portal usa (mesmos nomes de globals.css). */
export function variaveisCss(m: Marca): Record<string, string> {
  const c = m.cores;
  return {
    "--color-marca-900": c.escura,
    "--color-ink-900": c.escura,
    "--color-marca-700": c.texto,
    "--color-marca-500": c.destaque,
    "--color-marca-100": c.claro,
    "--color-paper": c.papel,
    "--color-gray-200": c.borda,
    "--color-gray-600": c.cinza,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function luminancia(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

/** Razão de contraste entre duas cores hex (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Problemas da marca para AA (texto normal 4,5:1). Lista vazia = pode usar. */
export function validarMarca(m: Marca): string[] {
  const c = m.cores, erros: string[] = [];
  for (const [k, v] of Object.entries(c)) if (!HEX.test(v)) erros.push(`Cor "${k}" inválida: ${v}.`);
  if (erros.length) return erros;
  const exigir = (rotulo: string, a: string, b: string) => { const r = contraste(a, b); if (r < 4.5) erros.push(`${rotulo}: contraste ${r.toFixed(2)}:1 (mínimo 4,5:1).`); };
  exigir("Texto escuro sobre o destaque (botão primário)", c.escura, c.destaque);
  exigir("Texto do menu (papel) sobre a cor escura", c.papel, c.escura);
  exigir("Texto de destaque sobre o papel", c.texto, c.papel);
  exigir("Texto escuro sobre o papel", c.escura, c.papel);
  exigir("Texto cinza sobre o papel", c.cinza, c.papel);
  return erros;
}

/** Troca os marcadores de texto pelos nomes do cliente: {cliente} = "B&M Log", {equipe} = "Marketing B&M Log". */
export function aplicarMarca(texto: string, m: Pick<Marca, "nomeCurto" | "equipe">): string {
  return texto.replaceAll("{cliente}", m.nomeCurto).replaceAll("{equipe}", m.equipe);
}
