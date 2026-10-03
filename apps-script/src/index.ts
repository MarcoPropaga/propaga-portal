/* Ponto de entrada do bundle para o Apps Script: liga a Plataforma às APIs do Google. */
import { configurarProjeto, criarAdministrador, processarFila } from "./servidor";
import type { Plataforma } from "./plataforma";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const UrlFetchApp: any, ScriptApp: any, MailApp: any, PropertiesService: any, Logger: any;

function plataforma(): Plataforma {
  const props = PropertiesService.getScriptProperties();
  const projeto = props.getProperty("PROJETO_ID") || "propaga-portal";
  return {
    http(url, metodo, corpo) {
      const r = UrlFetchApp.fetch(url, {
        method: metodo,
        contentType: "application/json",
        payload: corpo === undefined ? undefined : JSON.stringify(corpo),
        headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}`, "x-goog-user-project": projeto },
        muteHttpExceptions: true,
      });
      return { status: r.getResponseCode(), corpo: r.getContentText() };
    },
    enviarEmail(m) {
      MailApp.sendEmail({ to: m.para, subject: m.assunto, body: m.texto, htmlBody: m.html, name: m.nomeRemetente });
    },
    propriedade: (k) => props.getProperty(k),
    agora: () => new Date(),
    log: (m) => Logger.log(m),
  };
}

export const api = {
  configurarProjeto: () => configurarProjeto(plataforma()),
  criarAdministrador: () => criarAdministrador(plataforma()),
  processarFila: () => processarFila(plataforma()),
};
