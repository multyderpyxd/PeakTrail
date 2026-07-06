import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * Registro de "lo he hecho": un documento por usuario y elemento/ruta,
 * con id determinista para que marcar/desmarcar sea idempotente.
 * Todos los del grupo leen todo; cada uno escribe solo lo suyo
 * (garantizado por las reglas de firestore.rules).
 */
export interface Realizado {
  id: string;
  usuario: string; // uid
  nombreUsuario: string;
  tipo: "elemento" | "ruta";
  refId: string;
  /** Nombre denormalizado para listados sin cruzar con el catálogo. */
  nombre: string;
  /** pico | ibon | refugio para elementos; gr | pr | sl para rutas. */
  categoria: string;
  /** Fecha de la actividad, YYYY-MM-DD. */
  fecha: string;
  notas?: string;
}

export function idRealizado(uid: string, tipo: Realizado["tipo"], refId: string) {
  return `${uid}__${tipo}__${refId}`;
}

export async function marcarRealizado(
  datos: Omit<Realizado, "id">,
): Promise<void> {
  const id = idRealizado(datos.usuario, datos.tipo, datos.refId);
  await setDoc(doc(getDb(), "realizados", id), {
    ...datos,
    notas: datos.notas ?? "",
    creadoEl: serverTimestamp(),
  });
}

export async function desmarcarRealizado(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "realizados", id));
}

/** Escucha en vivo todos los realizados del grupo. */
export function escucharRealizados(
  alCambiar: (realizados: Map<string, Realizado>) => void,
  alFallar?: () => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "realizados"),
    (captura) => {
      const mapa = new Map<string, Realizado>();
      captura.forEach((d) => {
        const datos = d.data() as Omit<Realizado, "id">;
        mapa.set(d.id, { ...datos, id: d.id });
      });
      alCambiar(mapa);
    },
    () => alFallar?.(),
  );
}
