/**
 * Carga public/catalogo.json en la colección `elementos` de Firestore,
 * usando el id de cada elemento como id de documento (la carga es
 * idempotente: reimportar sobrescribe, no duplica).
 *
 * Requiere .env.local con las claves del proyecto de Firebase
 * (plantilla en .env.example) y las reglas de Firestore abiertas a
 * escritura durante la importación (modo de prueba).
 *
 * Uso: npm run catalogo:importar
 */

import { readFile } from "node:fs/promises";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, terminate, writeBatch } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!config.apiKey || !config.projectId) {
  console.error(
    "Faltan las claves de Firebase. Copia .env.example a .env.local, rellena los valores\n" +
      "de la consola de Firebase y vuelve a ejecutar: npm run catalogo:importar",
  );
  process.exit(1);
}

const { elementos } = JSON.parse(await readFile("public/catalogo.json", "utf8"));

const db = getFirestore(initializeApp(config));
const TAMANO_LOTE = 450; // margen bajo el límite de 500 escrituras por lote

for (let i = 0; i < elementos.length; i += TAMANO_LOTE) {
  const lote = writeBatch(db);
  for (const el of elementos.slice(i, i + TAMANO_LOTE)) {
    lote.set(doc(db, "elementos", el.id), el);
  }
  await lote.commit();
  console.log(`Importados ${Math.min(i + TAMANO_LOTE, elementos.length)}/${elementos.length}`);
}

await terminate(db);
console.log("Importación completada.");
