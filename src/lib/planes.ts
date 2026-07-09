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
import { getDb, isFirebaseConfigured } from "./firebase";
import type { MetricasLinea } from "./elevacion";
import type { RutaPlaneada } from "@/types/plan";

export { isFirebaseConfigured };

const COLECCION = "planes";

/* Firestore no admite arrays anidados: las coordenadas y el perfil se
   guardan como arrays de mapas y se reconstruyen al leer. */
const aCoords = (arr: [number, number][]) => arr.map(([lng, lat]) => ({ lng, lat }));
const deCoords = (arr: { lng: number; lat: number }[]): [number, number][] =>
  arr.map((p) => [p.lng, p.lat]);
const aPerfil = (arr: [number, number][]) => arr.map(([km, m]) => ({ km, m }));
const dePerfil = (arr: { km: number; m: number }[]): [number, number][] =>
  arr.map((p) => [p.km, p.m]);

export async function guardarPlan(datos: {
  grupoId: string;
  nombre: string;
  puntos: [number, number][];
  linea: [number, number][];
  metricas: MetricasLinea;
  autor?: { uid: string; nombre: string } | null;
}): Promise<string> {
  const { perfil, ...resumen } = datos.metricas;
  const referencia = await addDoc(collection(getDb(), COLECCION), {
    grupoId: datos.grupoId,
    nombre: datos.nombre,
    usuario: datos.autor?.uid ?? null,
    nombreUsuario: datos.autor?.nombre ?? null,
    creadaEl: serverTimestamp(),
    puntos: aCoords(datos.puntos),
    linea: aCoords(datos.linea),
    perfil: aPerfil(perfil),
    ...resumen,
  });
  return referencia.id;
}

/**
 * Planes del grupo activo. Sin `orderBy` en el servidor a propósito: junto
 * con el `where("grupoId",...)` exigiría un índice compuesto (igualdad +
 * orden en campos distintos); se ordena en cliente, igual que ya hace
 * social.ts con comentarios/fotos.
 */
export async function listarPlanes(grupoId: string): Promise<RutaPlaneada[]> {
  const resultado = await getDocs(
    query(collection(getDb(), COLECCION), where("grupoId", "==", grupoId)),
  );
  return resultado.docs
    .map((d) => {
      const datos = d.data();
      return {
        id: d.id,
        nombre: datos.nombre,
        nombreUsuario: datos.nombreUsuario ?? null,
        creadaEl:
          datos.creadaEl instanceof Timestamp
            ? datos.creadaEl.toDate().toISOString()
            : null,
        puntos: deCoords(datos.puntos),
        linea: deCoords(datos.linea),
        perfil: dePerfil(datos.perfil),
        distanciaKm: datos.distanciaKm,
        desnivelPos: datos.desnivelPos,
        desnivelNeg: datos.desnivelNeg,
        altMin: datos.altMin,
        altMax: datos.altMax,
      };
    })
    .sort((a, b) => ((a.creadaEl ?? "") < (b.creadaEl ?? "") ? 1 : -1));
}

export async function borrarPlan(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLECCION, id));
}
