"use client";
/* Formulário das ações do pedido (aceitar, entregar, faturar, pagamento, cancelar). Usado em Minhas tarefas. */
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ACOES_COM_MOTIVO, REGRAS, type Acao } from "@/lib/fluxo";
import { hojeSP, somarDiasUteis, PRAZO_PADRAO_DIAS_UTEIS } from "@/lib/datas";
import { acaoSchema } from "@/lib/schemas";
import { useFila } from "@/lib/usarFila";
import { Aviso, Botao } from "@/components/ui";
import { brData, type PedidoDoc } from "@/components/pedido";
import { useTxt } from "@/components/tema";

const AJUDA: Partial<Record<Acao, string>> = {
  aprovarProposta: "A solicitação segue para o Marcelo conferir, definir o cronograma e enviar ao criativo criar as peças.",
  ajustarProposta: "Escreva o que precisa mudar. A solicitação volta para o Marcelo ajustar e reenviar para sua aprovação.",
  devolverDuvida: "A solicitação volta para o {equipe} com a sua dúvida ou sugestão. Ele responde na aprovação (ou pede ajuste) e o pedido volta para você.",
  recusarProposta: "A solicitação é encerrada sem cobrança. Informe o motivo para o Marcelo.",
  trocarCriativo: "O pedido passa para o criativo escolhido, que recebe um e-mail. As peças já concluídas continuam no relatório de quem as concluiu.",
  aceitarPedido: "Confira a solicitação, o cronograma e o valor dos itens a cotar, conforme o contrato. O pedido entra em produção, o {equipe} é avisado e o criativo escolhido recebe o job para criar as peças.",
  entregar: "Todas as peças aprovadas estão com arquivo final em 04 Aprovados. Ao registrar o envio para veiculação ou impressão, o pedido fica como Realizado no relatório e o {equipe} e o Financeiro da Propaga são avisados.",
  faturar: "Registre o faturamento (ex.: número da nota fiscal).",
  registrarPagamento: "Registre o recebimento do pagamento.",
  cancelar: "",
};
const cx = "min-h-11 w-full rounded border border-[#C9D7DC] bg-white px-3";

export function FormAcao({ acao, pedido, onFechar, onOk }: { acao: Acao; pedido: PedidoDoc; onFechar: () => void; onOk?: (msg: string) => void }) {
  const t = useTxt();
  const enviar = useFila();
  const hoje = hojeSP();
  const primeiraPadrao = somarDiasUteis(hoje, PRAZO_PADRAO_DIAS_UTEIS);
  const finalPadrao = [pedido.prazo.desejada, somarDiasUteis(primeiraPadrao, 3)].sort()[1];
  const [nota, setNota] = useState("");
  const [cron, setCron] = useState({ inicio: hoje, primeira: primeiraPadrao, final: finalPadrao });
  const [valores, setValores] = useState<Record<number, string>>({});
  const [driveOk, setDriveOk] = useState(false);
  const [pasta, setPasta] = useState(pedido.drive.propaga ?? "");
  const [equipe, setEquipe] = useState<{ uid: string; nome: string }[]>([]);
  const [criativoUid, setCriativoUid] = useState("");
  const escolhe = acao === "aceitarPedido" || acao === "trocarCriativo";
  useEffect(() => {
    if (!escolhe) return;
    getDoc(doc(db(), "equipe", "criativos")).then((d) => {
      const doCliente = ((d.data()?.porCliente ?? {}) as Record<string, { uid: string; nome: string }[]>)[pedido.clienteId] ?? [];
      const l = doCliente.filter((x) => acao !== "trocarCriativo" || x.uid !== pedido.criativo?.uid);
      setEquipe(l); if (l.length === 1) setCriativoUid(l[0].uid);
    }).catch(() => {});
  }, [escolhe, acao, pedido.criativo?.uid]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const aCotar = pedido.itens.map((it, i) => ({ it, i })).filter((x) => x.it.sobOrcamento);
  const id = `fa-${acao}-${pedido.protocolo}`;

  async function confirmar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    if (ACOES_COM_MOTIVO.includes(acao) && nota.trim().length < 3) { setErro(acao === "ajustarProposta" ? "Escreva o que precisa ser ajustado." : acao === "devolverDuvida" ? "Escreva a dúvida ou a sugestão." : "Informe o motivo."); return; }
    const num = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));
    const dados: Record<string, unknown> = { protocolo: pedido.protocolo, acao };
    if (nota.trim()) dados.nota = nota.trim();
    if (acao === "aceitarPedido") {
      if (cron.inicio < hoje) { setErro("A data de início não pode estar no passado."); return; }
      const faltando = aCotar.filter(({ i }) => !(num(valores[i] ?? "") > 0));
      if (faltando.length) { setErro(`Informe o valor do item ${faltando.map((x) => x.i + 1).join(", ")} (a cotar).`); return; }
      if (!/^https:\/\/drive\.google\.com\//.test(pasta.trim())) { setErro("Cole o link da pasta do pedido no Drive compartilhado da Propaga."); return; }
      dados.cronograma = cron; dados.driveVerificado = driveOk; dados.pastaPropaga = pasta.trim();
      dados.valores = aCotar.map(({ i }) => ({ indice: i, valor: num(valores[i]) }));
    }
    if (escolhe) {
      if (!criativoUid && (equipe.length > 1 || acao === "trocarCriativo")) { setErro("Escolha o criativo."); return; }
      if (criativoUid) dados.criativoUid = criativoUid;
    }
    const r = acaoSchema.safeParse(dados);
    if (!r.success) { setErro(r.error.issues[0]?.message ?? "Confira os dados."); return; }
    setOcupado(true);
    const res = await enviar("acao", r.data);
    setOcupado(false);
    if (res.ok) { onOk?.(`${t(REGRAS[acao].rotulo)}: registrado.`); onFechar(); } else setErro(res.msg);
  }

  return (
    <form onSubmit={confirmar} noValidate className="grid gap-4 rounded border border-marca-500 bg-white p-4 md:p-5" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="form-acao-titulo text-base">{t(REGRAS[acao].rotulo)}</h3>
      {AJUDA[acao] && <p className="text-sm text-gray-600">{t(AJUDA[acao] ?? "")}</p>}
      {acao === "aceitarPedido" && <>
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">Cronograma</legend>
          {([["inicio", "Início"], ["primeira", "1ª apresentação"], ["final", "Entrega final"]] as const).map(([k, l]) => (
            <div key={k} className="grid gap-1.5"><label htmlFor={`${id}-${k}`} className="text-sm">{l}</label>
              <input id={`${id}-${k}`} type="date" min={hoje} value={cron[k]} onChange={(e) => setCron({ ...cron, [k]: e.target.value })} className={cx} /></div>
          ))}
        </fieldset>
        <p className="text-sm text-gray-600t(">{t("Data desejada pelo {equipe}: ")}<b>{brData(pedido.prazo.desejada)}</b>{pedido.prazo.urgente && ") · pedido urgente"}.</p>
        {aCotar.length > 0 && (
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold">Valor unitário dos itens a cotar (preço final ao cliente)</legend>
            {aCotar.map(({ it, i }) => (
              <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_180px]">
                <label htmlFor={`${id}-v-${i}`} className="text-sm">Item {i + 1}: {it.qtd}× {it.nome} <span className="text-gray-600">· {it.varianteRotulo}</span></label>
                <div className="flex items-center gap-2"><span className="text-sm text-gray-600">R$</span>
                  <input id={`${id}-v-${i}`} inputMode="decimal" placeholder="0,00" value={valores[i] ?? ""} onChange={(e) => setValores({ ...valores, [i]: e.target.value })} className={cx} /></div>
              </div>
            ))}
          </fieldset>
        )}
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-pasta`} className="text-sm font-semibold">Pasta do pedido no Drive da Propaga<span className="text-alerta-700" aria-hidden="true"> *</span></label>
          <input id={`${id}-pasta`} value={pasta} onChange={(e) => setPasta(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className={cx} aria-describedby={`${id}-pasta-a`} />
          <p id={`${id}-pasta-a`} className="text-sm text-gray-600">Drive compartilhado da Propaga, pasta {pedido.protocolo} com 01 Briefing, 02 Materiais, 03 Provas, 04 Aprovados e 05 Arquivos abertos. O criativo trabalha nela.</p>
        </div>
        <label className="flex items-start gap-2.5"><input type="checkbox" className="mt-1 size-4 accent-marca-700" checked={driveOk} onChange={(e) => setDriveOk(e.target.checked)} />
          <span>Conferi o acesso à pasta do Drive e os materiais.</span></label>
      </>}
      {escolhe && (equipe.length > 1 || acao === "trocarCriativo") && (
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-cri`} className="text-sm font-semibold">{acao === "trocarCriativo" ? `Passar para (hoje: ${pedido.criativo?.nome ?? "—"})` : "Criativo que vai criar as peças"}</label>
          <select id={`${id}-cri`} value={criativoUid} onChange={(e) => setCriativoUid(e.target.value)} className={cx}>
            <option value="">Selecione</option>
            {equipe.map((x) => <option key={x.uid} value={x.uid}>{x.nome}</option>)}
          </select>
          {!equipe.length && <p className="text-sm text-alerta-700">Nenhum outro criativo cadastrado.</p>}
        </div>
      )}
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-nota`} className="text-sm font-semibold">{acao === "ajustarProposta" ? "O que ajustar" : acao === "devolverDuvida" ? t("Dúvida ou sugestão para o {equipe}") : ACOES_COM_MOTIVO.includes(acao) ? "Motivo" : acao === "entregar" ? "Onde foi veiculado ou impresso (opcional)" : "Observação (opcional)"}{ACOES_COM_MOTIVO.includes(acao) && <span className="text-alerta-700" aria-hidden="true"> *</span>}</label>
        <textarea id={`${id}-nota`} rows={3} maxLength={3000} value={nota} onChange={(e) => setNota(e.target.value)} className="w-full rounded border border-[#C9D7DC] bg-white p-3" />
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {ocupado && <Aviso>Registrando… costuma levar poucos segundos.</Aviso>}
      <div className="flex flex-wrap gap-3">
        <Botao type="submit" carregando={ocupado}>{t(REGRAS[acao].rotulo)}</Botao>
        <Botao type="button" variante="discreto" onClick={onFechar} disabled={ocupado}>Voltar</Botao>
      </div>
    </form>
  );
}
