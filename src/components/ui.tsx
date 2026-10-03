/* Componentes de interface básicos, com os tokens da marca. */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Logo({ className = "w-[170px]" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-horizontal-cor.svg" alt="Propaga" className={`h-auto ${className}`} />;
}

type Variante = "primario" | "linha" | "discreto";
export function Botao({ variante = "primario", className = "", carregando, children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  const v = {
    primario: "bg-marca-500 text-ink-900 hover:brightness-105 disabled:bg-gray-200 disabled:text-gray-600",
    linha: "bg-white border border-ink-900 text-ink-900 hover:bg-paper",
    discreto: "bg-transparent border border-[#C9D7DC] text-ink-900 hover:bg-white",
  }[variante];
  return (
    <button {...p} disabled={p.disabled || carregando} aria-busy={carregando || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded px-5 font-semibold transition disabled:cursor-not-allowed ${v} ${className}`}>
      {carregando ? "Aguarde…" : children}
    </button>
  );
}

export function Campo({ id, rotulo, erro, ajuda, ...p }:
  InputHTMLAttributes<HTMLInputElement> & { id: string; rotulo: string; erro?: string; ajuda?: ReactNode }) {
  const desc = [erro ? `${id}-erro` : "", ajuda ? `${id}-ajuda` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{rotulo}</label>
      <input id={id} {...p} aria-invalid={erro ? true : undefined} aria-describedby={desc}
        className={`min-h-11 w-full rounded border bg-white px-3 ${erro ? "border-alerta-700 ring-1 ring-alerta-700" : "border-[#C9D7DC]"}`} />
      {ajuda && <p id={`${id}-ajuda`} className="text-sm text-gray-600">{ajuda}</p>}
      {erro && <p id={`${id}-erro`} className="text-sm font-medium text-alerta-700" role="alert">{erro}</p>}
    </div>
  );
}

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "ok" | "erro"; children: ReactNode }) {
  const c = { info: "bg-[#EAF3F5]", ok: "bg-[#E3F2EA] text-[#1E7047]", erro: "bg-alerta-100 text-alerta-700" }[tipo];
  return <div role={tipo === "erro" ? "alert" : "status"} className={`rounded px-4 py-3 text-sm ${c}`}>{children}</div>;
}

/* Tela dividida do acesso: painel grafite com a marca + formulário. */
export function TelaAcesso({ titulo, subtitulo, children }: { titulo: string; subtitulo?: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col gap-5 bg-ink-900 p-6 text-paper md:gap-7 md:p-12">
        <Logo />
        <span className="w-fit rounded-full bg-marca-500 px-3 py-1 text-xs font-semibold text-marca-900">Portal de clientes</span>
        <p className="max-w-[16ch] font-display text-2xl font-semibold leading-tight md:text-4xl">Solicitações, valores e entregas no mesmo lugar.</p>
        <p className="hidden max-w-[46ch] text-[#A9CBD6] md:block">Área exclusiva para clientes da Propaga pedirem serviços, acompanharem cada etapa e consultarem o contrato vigente.</p>
      </section>
      <section className="grid place-items-center px-4 py-10 md:px-6">
        <div className="grid w-full max-w-[420px] gap-5">
          <div className="grid gap-1.5">
            <h1 className="text-2xl">{titulo}</h1>
            {subtitulo && <p className="text-sm text-gray-600">{subtitulo}</p>}
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

export function RegrasSenha({ senha, regras }: { senha: string; regras: { texto: string; ok: (s: string) => boolean }[] }) {
  return (
    <ul className="grid gap-1 text-sm" aria-label="Requisitos da senha">
      {regras.map((r) => {
        const ok = r.ok(senha);
        return <li key={r.texto} className={ok ? "text-[#1E7047]" : "text-gray-600"}>{ok ? "● " : "○ "}{r.texto}<span className="sr-only">{ok ? " (cumprido)" : " (pendente)"}</span></li>;
      })}
    </ul>
  );
}
