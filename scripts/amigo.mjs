/**
 * Añade correos al roster global de amigos (colección `amigos`, doc id =
 * email). Funciona mientras las reglas de Firestore permitan escribir (modo
 * de prueba); con las reglas de firestore.rules aplicadas, el `--admin` ya
 * no sirve desde aquí (solo el propietario puede ascender a alguien, desde
 * la propia app) — para añadir amigos normales sigue funcionando si tienes
 * el modo de prueba abierto, o hazlo desde la app como propietario/admin.
 *
 * Uso: npm run amigos:anadir -- amigo@gmail.com [otro@gmail.com ...]
 *      npm run amigos:anadir -- --admin yo@gmail.com   (solo en modo de
 *      prueba, antes de aplicar las reglas nuevas)
 */

import { initializeApp } from "firebase/app";
import { doc, getFirestore, serverTimestamp, setDoc, terminate } from "firebase/firestore";

const argumentos = process.argv.slice(2);
const comoAdmin = argumentos.includes("--admin");
const correos = argumentos.filter((c) => c.includes("@"));
if (!correos.length) {
  console.error("Uso: npm run amigos:anadir -- [--admin] email1 [email2 ...]");
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
  await setDoc(
    doc(db, "amigos", correo.toLowerCase()),
    { anadidoEl: serverTimestamp(), admin: comoAdmin },
    { merge: true },
  );
  console.log(comoAdmin ? "Amigo (admin):" : "Amigo:", correo.toLowerCase());
}
await terminate(db);
