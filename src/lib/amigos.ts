import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * Roster global de amigos (colección `amigos`, doc id = email en minúscula),
 * independiente de los grupos: un admin añade a alguien una vez aquí y
 * luego lo asigna a uno o varios grupos (src/lib/grupos.ts). Reemplaza a
 * `invitados.ts`, que se retira en el Hito de corte (ver notas-mejoras.md).
 * Las reglas de firestore.rules solo dejan tocar el campo `admin` al
 * propietario: ascenderAdmin/descenderAdmin fallarán con permiso denegado
 * para cualquier otro admin, aunque la UI ya oculte el botón.
 */
export interface Amigo {
  email: string;
  admin: boolean;
  anadidoEl: string | null;
}

export async function listarAmigos(): Promise<Amigo[]> {
  const resultado = await getDocs(collection(getDb(), "amigos"));
  return resultado.docs
    .map((d) => ({
      email: d.id,
      admin: d.data().admin === true,
      anadidoEl:
        d.data().anadidoEl instanceof Timestamp
          ? d.data().anadidoEl.toDate().toISOString()
          : null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

/** Crea (o resetea a no-admin) la ficha de un amigo; no se usa para re-añadir a un admin existente. */
export async function anadirAmigo(email: string): Promise<void> {
  await setDoc(doc(getDb(), "amigos", email.trim().toLowerCase()), {
    admin: false,
    anadidoEl: serverTimestamp(),
  });
}

export async function quitarAmigo(email: string): Promise<void> {
  await deleteDoc(doc(getDb(), "amigos", email));
}

export async function ascenderAdmin(email: string): Promise<void> {
  await updateDoc(doc(getDb(), "amigos", email), { admin: true });
}

export async function descenderAdmin(email: string): Promise<void> {
  await updateDoc(doc(getDb(), "amigos", email), { admin: false });
}
