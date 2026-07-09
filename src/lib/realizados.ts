import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * Registro de "lo he hecho": un documento por usuario, grupo y elemento/ruta,
 * con id determinista para que marcar/desmarcar sea idempotente. Cada grupo
 * ve y comparte solo lo suyo (reglas de firestore.rules vía miembroDeGrupo);
 * cada uno escribe solo lo suyo.
 */
export interface Realizado {
  id: string;
  usuario: string; // uid
  nombreUsuario: string;
  grupoId: string;
  tipo: "elemento" | "ruta" | "plan";
  refId: string;
  /** Nombre denormalizado para listados sin cruzar con el catálogo. */
  nombre: string;
  /** pico | ibon | refugio | collado para elementos; gr | pr | sl para rutas; plan. */
  categoria: string;
  /** Fecha de la actividad, YYYY-MM-DD. */
  fecha: string;
  notas?: string;
}

/**
 * El grupo entra en el id: el mismo usuario puede marcar el mismo elemento
 * en dos grupos distintos (cada uno con su propio ranking) sin que un
 * logro pise al otro.
 */
export function idRealizado(
  uid: string,
  grupoId: string,
  tipo: Realizado["tipo"],
  refId: string,
) {
  return `${uid}__${grupoId}__${tipo}__${refId}`;
}

export async function marcarRealizado(
  datos: Omit<Realizado, "id">,
): Promise<void> {
  const id = idRealizado(datos.usuario, datos.grupoId, datos.tipo, datos.refId);
  await setDoc(doc(getDb(), "realizados", id), {
    ...datos,
    notas: datos.notas ?? "",
    creadoEl: serverTimestamp(),
  });
}

export async function desmarcarRealizado(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "realizados", id));
}

/** Escucha en vivo los realizados del grupo activo; sin grupo, no se suscribe. */
export function escucharRealizados(
  grupoId: string | null,
  alCambiar: (realizados: Map<string, Realizado>) => void,
  alFallar?: () => void,
): Unsubscribe {
  if (!grupoId) {
    alCambiar(new Map());
    return () => {};
  }
  return onSnapshot(
    query(collection(getDb(), "realizados"), where("grupoId", "==", grupoId)),
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
