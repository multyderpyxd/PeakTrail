import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase solo se inicializa si hay configuración (permite build y dev sin
// credenciales mientras el proyecto de Firebase no esté creado).
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase no está configurado. Copia .env.example a .env.local y rellena las claves del proyecto."
    );
  }
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

let dbSingleton: Firestore | null = null;

/**
 * initializeFirestore solo puede llamarse una vez por FirebaseApp: se
 * memoiza aquí (en vez de llamarlo fresco en cada uso, como antes con
 * getFirestore) para activar persistencia offline. Con esto, los onSnapshot
 * de realizados.ts/social.ts sirven el último snapshot en caché sin red y
 * las escrituras (setDoc/addDoc/deleteDoc) quedan en cola local hasta
 * reconectar, sin tocar esos ficheros.
 */
export function getDb(): Firestore {
  if (dbSingleton) return dbSingleton;
  dbSingleton = initializeFirestore(getFirebaseApp(), {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  return dbSingleton;
}
