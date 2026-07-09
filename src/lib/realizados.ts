import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";

/** Una repetición del historial de un "realizado": fecha y notas de esa vez. */
export interface RepeticionHistorial {
  fecha: string;
  notas: string;
}

/**
 * Registro de "lo he hecho": un documento por usuario, grupo (o individual,
 * sin grupo) y elemento/ruta, con id determinista para que marcar/desmarcar
 * sea idempotente. Con grupo, todo el grupo lo ve (reglas de firestore.rules
 * vía miembroDeGrupo); sin grupo (individual, `grupoId: null`) es solo tuyo.
 * Cada uno escribe/borra solo lo suyo, tenga grupo o no; para uno de grupo,
 * cualquier miembro puede añadirle una repetición (ver `anadirRepeticion`).
 * `fecha`/`notas` a nivel superior siempre reflejan la repetición más
 * reciente (para no tener que tocar el código que ya los lee así).
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
  /** Fecha de la repetición más reciente, YYYY-MM-DD. */
  fecha: string;
  notas?: string;
  /**
   * Todas las veces que se ha hecho, más antigua primero. Opcional: los
   * documentos de antes de este campo no lo tienen (usar `historialDe`).
   */
  historial?: RepeticionHistorial[];
}

/** Historial completo de un realizado, con respaldo para documentos antiguos sin el campo. */
export function historialDe(r: Realizado): RepeticionHistorial[] {
  return r.historial ?? [{ fecha: r.fecha, notas: r.notas ?? "" }];
}

/** Cuántas veces se ha hecho (1 si no hay repeticiones). */
export function vecesRealizado(r: Realizado): number {
  return historialDe(r).length;
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
  const notas = datos.notas ?? "";
  await setDoc(doc(getDb(), "realizados", id), {
    ...datos,
    notas,
    historial: [{ fecha: datos.fecha, notas }],
    creadoEl: serverTimestamp(),
  });
}

export async function desmarcarRealizado(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "realizados", id));
}

/**
 * Añade una repetición a un realizado que ya existe (de uno mismo o, si es
 * de grupo, de otro miembro: firestore.rules lo permite igual que ya
 * permite crearlo en su nombre). `fecha`/`notas` de nivel superior pasan a
 * reflejar esta nueva repetición, la más reciente.
 */
export async function anadirRepeticion(
  id: string,
  fecha: string,
  notas: string,
): Promise<void> {
  const entrada: RepeticionHistorial = { fecha, notas: notas ?? "" };
  await updateDoc(doc(getDb(), "realizados", id), {
    historial: arrayUnion(entrada),
    fecha: entrada.fecha,
    notas: entrada.notas,
  });
}

/**
 * Quita solo la repetición más reciente; si era la única, borra el
 * documento entero (mismo efecto que desmarcarRealizado hoy).
 */
export async function quitarUltimaRepeticion(r: Realizado): Promise<void> {
  const historial = historialDe(r);
  if (historial.length <= 1) {
    await desmarcarRealizado(r.id);
    return;
  }
  const restante = historial.slice(0, -1);
  const ultimo = restante[restante.length - 1];
  await updateDoc(doc(getDb(), "realizados", r.id), {
    historial: restante,
    fecha: ultimo.fecha,
    notas: ultimo.notas,
  });
}

/**
 * Marca lo mismo (grupoId/tipo/refId/fecha/notas) para varios destinatarios
 * a la vez: uno mismo y, si se etiquetan, otros miembros del grupo. Cada
 * destinatario obtiene su propio documento independiente (id determinista
 * por uid), así que desmarcarlo luego no afecta a los demás. `allSettled`
 * para que un destinatario fallido (p. ej. ya lo tenía marcado él mismo, lo
 * que convierte el alta en una actualización que las reglas rechazan) no
 * tumbe el resto.
 */
export async function marcarRealizadoGrupo(
  base: Omit<Realizado, "id" | "usuario" | "nombreUsuario">,
  destinatarios: { uid: string; nombre: string }[],
): Promise<PromiseSettledResult<void>[]> {
  return Promise.allSettled(
    destinatarios.map((d) =>
      marcarRealizado({ ...base, usuario: d.uid, nombreUsuario: d.nombre }),
    ),
  );
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
