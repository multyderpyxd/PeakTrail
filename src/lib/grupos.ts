import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { Grupo, GrupoResumen } from "@/types/grupo";

const COLECCION = "grupos";

function aGrupo(d: { id: string; data: () => Record<string, unknown> }): Grupo {
  const datos = d.data();
  return {
    id: d.id,
    nombre: datos.nombre as string,
    miembros: (datos.miembros as string[]) ?? [],
    creadoEl:
      datos.creadoEl instanceof Timestamp
        ? datos.creadoEl.toDate().toISOString()
        : null,
  };
}

/** Todos los grupos (panel de administración: crear/gestionar cualquiera). */
export async function listarGrupos(): Promise<Grupo[]> {
  const resultado = await getDocs(collection(getDb(), COLECCION));
  return resultado.docs.map(aGrupo).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Escucha en vivo los grupos de los que `email` es miembro (para el
 * selector de grupo activo y los títulos de Progreso): si un admin renombra
 * el grupo o cambia sus miembros, se refleja solo, sin esperar a un nuevo
 * inicio de sesión.
 */
export function escucharGruposDe(
  email: string,
  alCambiar: (grupos: GrupoResumen[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(getDb(), COLECCION), where("miembros", "array-contains", email)),
    (captura) => {
      const grupos = captura.docs
        .map((d) => ({
          id: d.id,
          nombre: d.data().nombre as string,
          miembros: (d.data().miembros as string[]) ?? [],
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      alCambiar(grupos);
    },
  );
}

export async function crearGrupo(nombre: string, miembros: string[]): Promise<string> {
  const referencia = await addDoc(collection(getDb(), COLECCION), {
    nombre: nombre.trim(),
    miembros,
    creadoEl: serverTimestamp(),
  });
  return referencia.id;
}

export async function renombrarGrupo(id: string, nombre: string): Promise<void> {
  await updateDoc(doc(getDb(), COLECCION, id), { nombre: nombre.trim() });
}

export async function anadirMiembro(id: string, email: string): Promise<void> {
  await updateDoc(doc(getDb(), COLECCION, id), {
    miembros: arrayUnion(email.trim().toLowerCase()),
  });
}

export async function quitarMiembro(id: string, email: string): Promise<void> {
  await updateDoc(doc(getDb(), COLECCION, id), { miembros: arrayRemove(email) });
}

export async function borrarGrupo(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLECCION, id));
}
