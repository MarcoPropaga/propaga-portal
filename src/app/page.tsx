/* Tela temporária de entrada. As telas da prévia são portadas nos próximos PRs (ver docs/PLANO.md). */
export default function Home() {
  return (
    <main className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col gap-6 bg-ink-900 p-8 text-paper md:p-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-horizontal-cor.svg" alt="Propaga" width={190} height={25} />
        <h1 className="max-w-[16ch] text-4xl">Solicitações, valores e entregas no mesmo lugar.</h1>
        <p className="max-w-[46ch] text-[#A8A29C]">Área exclusiva para clientes da Propaga pedirem serviços, acompanharem cada etapa e consultarem o contrato vigente.</p>
      </section>
      <section className="grid place-items-center p-8">
        <div className="grid max-w-sm gap-4">
          <h2 className="text-2xl">Portal em implantação</h2>
          <p className="text-gray-600">O acesso é feito pelo convite enviado por e-mail.</p>
        </div>
      </section>
    </main>
  );
}
