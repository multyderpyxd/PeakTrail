/**
 * Añade correos a la lista cerrada de invitados (colección `invitados`,
 * doc id = email). Funciona mientras las reglas de Firestore permitan
 * escribir (modo de prueba); con las reglas de firestore.rules aplicadas,
 * gestiona los invitados desde la consola de Firebase.
 *
 * Uso: npm run invitados:anadir -- amigo@gmail.com [otro@gmail.com ...]
 */

import { initializeApp } from "firebase/app";
import { doc, getFirestore, serverTimestamp, setDoc, terminate } from "firebase/firestore";

const correos = process.argv.slice(2).filter((c) => c.includes("@"));
if (!correos.length) {
  console.error("Uso: npm run invitados:anadir -- email1 [email2 ...]");
  process.exit(1);
}

const db = getFirestore(
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }),
);

for (const correo of correos) {
  await setDoc(doc(db, "invitados", correo.toLowerCase()), {
    invitadoEl: serverTimestamp(),
  });
  console.log("Invitado:", correo.toLowerCase());
}
await terminate(db);
