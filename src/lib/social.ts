import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * Fotos y comentarios del grupo por elemento o ruta. Las fotos se comprimen
 * en el navegador y se guardan como data-URL JPEG dentro del documento
 * (Firebase Storage exige plan de pago en proyectos nuevos; con ~10 usuarios
 * y fotos de ~200 KB, Firestore da de sobra — anotado en notas-mejoras.md).
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
  creadoEl: string | null;
}

function fecha(valor: unknown): string | null {
  return valor instanceof Timestamp ? valor.toDate().toISOString() : null;
}

export async function cargarSocial(
  refTipo: RefTipo,
  refId: string,
): Promise<{ comentarios: Comentario[]; fotos: Foto[] }> {
  const db = getDb();
  const [comentarios, fotos] = await Promise.all([
    getDocs(query(collection(db, "comentarios"), where("refId", "==", refId))),
    getDocs(query(collection(db, "fotos"), where("refId", "==", refId))),
  ]);
  const aplanar = <T,>(docs: typeof comentarios.docs) =>
    docs
      .map((d) => ({ ...d.data(), id: d.id, creadoEl: fecha(d.data().creadoEl) }))
      .filter((d) => (d as { refTipo?: string }).refTipo === refTipo) as T[];
  return {
    comentarios: aplanar<Comentario>(comentarios.docs).sort((a, b) =>
      (a.creadoEl ?? "") < (b.creadoEl ?? "") ? -1 : 1,
    ),
    fotos: aplanar<Foto>(fotos.docs).sort((a, b) =>
      (a.creadoEl ?? "") > (b.creadoEl ?? "") ? -1 : 1,
    ),
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

async function comprimirImagen(archivo: File): Promise<string> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  for (let calidad = 0.8; calidad >= 0.35; calidad -= 0.15) {
    const datos = lienzo.toDataURL("image/jpeg", calidad);
    if (datos.length <= TAMANO_MAXIMO) return datos;
  }
  throw new Error("La foto es demasiado grande incluso comprimida");
}

export async function subirFoto(
  datos: Omit<Foto, "id" | "creadoEl" | "datos"> & { archivo: File },
): Promise<void> {
  const { archivo, ...resto } = datos;
  await addDoc(collection(getDb(), "fotos"), {
    ...resto,
    datos: await comprimirImagen(archivo),
    creadoEl: serverTimestamp(),
  });
}

export async function borrarFoto(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "fotos", id));
}
