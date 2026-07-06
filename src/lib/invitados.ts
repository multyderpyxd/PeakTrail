import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * Gestión de la lista cerrada del grupo desde la propia app. Las reglas
 * de firestore.rules solo permiten estas operaciones a los admins
 * (campo admin: true en su propio documento de `invitados`).
 */

export interface Invitado {
  email: string;
  admin: boolean;
}

export async function listarInvitados(): Promise<Invitado[]> {
  const resultado = await getDocs(collection(getDb(), "invitados"));
  return resultado.docs
    .map((d) => ({ email: d.id, admin: d.data().admin === true }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function invitar(email: string): Promise<void> {
  await setDoc(
    doc(getDb(), "invitados", email.trim().toLowerCase()),
    { invitadoEl: serverTimestamp() },
    { merge: true },
  );
}

export async function expulsar(email: string): Promise<void> {
  await deleteDoc(doc(getDb(), "invitados", email));
}
