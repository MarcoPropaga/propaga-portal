// ===== Funções que aparecem no editor do Apps Script e nos gatilhos =====
// Gerado por apps-script/build.mjs a partir de apps-script/src (não edite o bundle à mão).

/** 1) Execute uma vez: liga TOTP, política de senha e cadastra clientes/catálogos. */
function configurarProjeto() { return PortalServidor.api.configurarProjeto(); }

/** 2) Execute uma vez: convida o administrador definido em ADMIN_EMAIL. */
function criarAdministrador() { return PortalServidor.api.criarAdministrador(); }

/** Processa a fila. Chamado pelo gatilho de 1 minuto e pelo aviso do portal (doPost). */
function processarFila() {
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(5000)) return { ocupado: true };
  try { return PortalServidor.api.processarFila(); } finally { trava.releaseLock(); }
}

/** Aviso do portal: "há item novo na fila". Não recebe dados; só dispara o processamento. */
function doPost() {
  var r = processarFila();
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

/** 3) Execute uma vez: cria o gatilho de 1 minuto (sem duplicar). */
function instalarGatilho() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "processarFila") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("processarFila").timeBased().everyMinutes(1).create();
}
