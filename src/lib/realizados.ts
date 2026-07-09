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
 * Registro de "lo he hecho": un documento por usuario, grupo (o individual,
 * sin grupo) y elemento/ruta, con id determinista para que marcar/desmarcar
 * sea idempotente. Con grupo, todo el grupo lo ve (reglas de firestore.rules
 * vía miembroDeGrupo); sin grupo (individual, `grupoId: null`) es solo tuyo.
 * Cada uno escribe/borra solo lo suyo, tenga grupo o no.
 */
export interface Realizado {
  id: string;
  usuario: string; // uid
  nombreUsuario: string;
  /** null = logro individual, no compartido con ningún grupo. */
  grupoId: string | null;
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
 * El grupo (o "individual" si no hay) entra en el id: el mismo usuario puede
 * marcar el mismo elemento en dos grupos distintos, o individualmente y
 * también en un grupo, sin que un logro pise al otro.
 */
export function idRealizado(
  uid: string,
  grupoId: string | null,
  tipo: Realizado["tipo"],
  refId: string,
) {
  return `${uid}__${grupoId ?? "individual"}__${tipo}__${refId}`;
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

/**
 * Escucha en vivo TODOS los realizados propios (individuales y de
 * cualquier grupo al que pertenezcas): es el histórico personal, no
 * depende de cuál sea el grupo activo. Sin sesión, no se suscribe.
 */
export function escucharRealizadosPropios(
  uid: string | null,
  alCambiar: (realizados: Map<string, Realizado>) => void,
  alFallar?: () => void,
): Unsubscribe {
  if (!uid) {
    alCambiar(new Map());
    return () => {};
  }
  return onSnapshot(
    query(collection(getDb(), "realizados"), where("usuario", "==", uid)),
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
