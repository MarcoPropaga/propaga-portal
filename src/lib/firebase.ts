"use client";
/* Inicialização do Firebase no navegador (portal estático, plano Spark). */
import { initializeApp, getApps } from "firebase/app";
import { initializeAuth, getAuth, connectAuthEmulator, indexedDBLocalPersistence, browserLocalPersistence, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _auth: Auth | null = null;
let _db: Firestore | null = null;
const emulador = process.env.NEXT_PUBLIC_USAR_EMULADOR === "true";

function app() {
  return getApps()[0] ?? initializeApp(config);
}

export function auth(): Auth {
  if (!_auth) {
    // Sessão guardada no aparelho: a pessoa continua conectada até tocar em "Sair".
    try { _auth = initializeAuth(app(), { persistence: [indexedDBLocalPersistence, browserLocalPersistence] }); }
    catch { _auth = getAuth(app()); }
    _auth.languageCode = "pt-BR";
    if (emulador) connectAuthEmulator(_auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return _auth;
}

export function db(): Firestore {
  if (!_db) {
    _db = getFirestore(app());
    if (emulador) connectFirestoreEmulator(_db, "127.0.0.1", 8080);
  }
  return _db;
}

/** Avisa o servidor (Apps Script) que há item novo na fila. Sem dados; se falhar, o gatilho de 1 min processa. */
export function avisarServidor() {
  const url = process.env.NEXT_PUBLIC_SERVIDOR_URL;
  if (!url) return;
  fetch(url, { method: "POST", mode: "no-cors" }).catch(() => {});
}
