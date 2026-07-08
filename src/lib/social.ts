import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * Fotos y comentarios del grupo por elemento o ruta. Las fotos se comprimen
 * en el navegador y se guardan como data-URL JPEG dentro del documento
 * (Firebase Storage exige plan de pago en proyectos nuevos; con ~10 usuarios
 * y fotos de ~200 KB, Firestore da de sobra — anotado en notas-mejoras.md).
 * Comentarios y fotos llegan en vivo (onSnapshot): se ven aparecer sin
 * reabrir la ficha, tanto los propios como los del resto del grupo.
 */

export type RefTipo = "elemento" | "ruta";

export interface Comentario {
  id: string;
  refTipo: RefTipo;
  refId: string;
  usuario: string;
  nombreUsuario: string;
  texto: string;
  creadoEl: string | null;
}

export interface Foto {
  id: string;
  refTipo: RefTipo;
  refId: string;
  usuario: string;
  nombreUsuario: string;
  /** data-URL JPEG comprimida (<900 KB). */
  datos: string;
  /**
   * data-URL JPEG en miniatura (<30 KB) para la rejilla de la galería, sin
   * descargar el original. Ausente en fotos subidas antes del Hito 21.
   */
  miniatura?: string;
  creadoEl: string | null;
}

function fecha(valor: unknown): string | null {
  return valor instanceof Timestamp ? valor.toDate().toISOString() : null;
}

export interface DatosSocial {
  comentarios: Comentario[];
  fotos: Foto[];
  /** true solo cuando ambas colecciones ya entregaron su primer snapshot. */
  listo: boolean;
}

/**
 * Escucha en vivo los comentarios y fotos de un elemento o ruta. Dos
 * queries (una por colección), cada una ya filtrada en el servidor por
 * refTipo+refId (dos igualdades: no requiere índice compuesto). `listo`
 * espera a que ambas hayan entregado su primer snapshot, para no pintar
 * «sin fotos todavía» solo porque esa colección tardó un instante más que
 * la de comentarios en resolver.
 */
export function escucharSocial(
  refTipo: RefTipo,
  refId: string,
  alCambiar: (datos: DatosSocial) => void,
): Unsubscribe {
  const db = getDb();
  let comentarios: Comentario[] = [];
  let fotos: Foto[] = [];
  let comentariosListos = false;
  let fotosListos = false;
  const emitir = () =>
    alCambiar({
      comentarios: [...comentarios],
      fotos: [...fotos],
      listo: comentariosListos && fotosListos,
    });

  const dejarComentarios = onSnapshot(
    query(
      collection(db, "comentarios"),
      where("refTipo", "==", refTipo),
      where("refId", "==", refId),
    ),
    (captura) => {
      comentarios = captura.docs
        .map((d) => ({
          ...(d.data() as Omit<Comentario, "id" | "creadoEl">),
          id: d.id,
          creadoEl: fecha(d.data().creadoEl),
        }))
        .sort((a, b) => ((a.creadoEl ?? "") < (b.creadoEl ?? "") ? -1 : 1));
      comentariosListos = true;
      emitir();
    },
  );
  const dejarFotos = onSnapshot(
    query(
      collection(db, "fotos"),
      where("refTipo", "==", refTipo),
      where("refId", "==", refId),
    ),
    (captura) => {
      fotos = captura.docs
        .map((d) => ({
          ...(d.data() as Omit<Foto, "id" | "creadoEl">),
          id: d.id,
          creadoEl: fecha(d.data().creadoEl),
        }))
        .sort((a, b) => ((a.creadoEl ?? "") > (b.creadoEl ?? "") ? -1 : 1));
      fotosListos = true;
      emitir();
    },
  );
  return () => {
    dejarComentarios();
    dejarFotos();
  };
}

export async function comentar(
  datos: Omit<Comentario, "id" | "creadoEl">,
): Promise<void> {
  await addDoc(collection(getDb(), "comentarios"), {
    ...datos,
    creadoEl: serverTimestamp(),
  });
}

export async function borrarComentario(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "comentarios", id));
}

const LADO_MAXIMO = 1280;
const TAMANO_MAXIMO = 900_000;
const LADO_MINIATURA = 320;
const TAMANO_MINIATURA_MAXIMO = 30_000;

function redimensionar(
  imagen: ImageBitmap,
  ladoMaximo: number,
): HTMLCanvasElement {
  const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return lienzo;
}

/** Baja la calidad hasta caber en `tamanoMaximo`; sin garantía, lanza si no cabe. */
function comprimirEstricto(
  lienzo: HTMLCanvasElement,
  tamanoMaximo: number,
): string {
  for (let calidad = 0.8; calidad >= 0.35; calidad -= 0.15) {
    const datos = lienzo.toDataURL("image/jpeg", calidad);
    if (datos.length <= tamanoMaximo) return datos;
  }
  throw new Error("La foto es demasiado grande incluso comprimida");
}

/**
 * Igual, pero de mejor esfuerzo: si ni la calidad mínima cabe en el tamaño
 * objetivo, se queda con esa (nunca bloquea la subida por culpa solo de la
 * miniatura, que es contenido secundario de la galería).
 */
function comprimirMejorEsfuerzo(
  lienzo: HTMLCanvasElement,
  tamanoMaximo: number,
): string {
  let mejor: string | null = null;
  for (let calidad = 0.7; calidad >= 0.3; calidad -= 0.1) {
    const datos = lienzo.toDataURL("image/jpeg", calidad);
    mejor = datos;
    if (datos.length <= tamanoMaximo) return datos;
  }
  return mejor!;
}

async function procesarImagen(
  archivo: File,
): Promise<{ datos: string; miniatura: string }> {
  const imagen = await createImageBitmap(archivo);
  return {
    datos: comprimirEstricto(redimensionar(imagen, LADO_MAXIMO), TAMANO_MAXIMO),
    miniatura: comprimirMejorEsfuerzo(
      redimensionar(imagen, LADO_MINIATURA),
      TAMANO_MINIATURA_MAXIMO,
    ),
  };
}

export async function subirFoto(
  datos: Omit<Foto, "id" | "creadoEl" | "datos" | "miniatura"> & {
    archivo: File;
  },
): Promise<void> {
  const { archivo, ...resto } = datos;
  const { datos: imagen, miniatura } = await procesarImagen(archivo);
  await addDoc(collection(getDb(), "fotos"), {
    ...resto,
    datos: imagen,
    miniatura,
    creadoEl: serverTimestamp(),
  });
}

export async function borrarFoto(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "fotos", id));
}
