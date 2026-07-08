/**
 * Gestión de "packs" descargados para consultar una ruta, plan o actividad
 * sin cobertura: calcula las teselas del corredor (src/lib/teselas.ts), las
 * descarga a la caché que sirve public/sw.js (peaktrail-teselas-packs) y
 * guarda el listado en localStorage (mismo patrón que actividades.ts /
 * preferencias.ts), no en IndexedDB. Borrar un pack respeta las teselas que
 * todavía use algún otro pack superviviente, en vez de borrarlas a ciegas.
 */

import { urlsParaDescarga } from "./teselas";

const CLAVE = "peaktrail:descargas:1";
const CACHE_PACKS = "peaktrail-teselas-packs";
const CONCURRENCIA = 6;

export interface PackDescarga {
  id: string;
  nombre: string;
  tipo: "ruta" | "actividad" | "plan";
  creadoEl: string;
  urls: string[];
  bytesAprox: number;
}

function leerPacks(): PackDescarga[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const datos = JSON.parse(crudo);
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

function guardarPacks(packs: PackDescarga[]): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(packs));
  } catch {
    // Sin sitio: la descarga ya quedó en Cache Storage, solo se pierde el
    // listado (el pack seguirá sirviéndose offline, solo no aparecerá en el panel).
  }
}

export function listarPacks(): PackDescarga[] {
  return leerPacks().sort((a, b) => (a.creadoEl < b.creadoEl ? 1 : -1));
}

export function tamanoTotalAprox(): number {
  return leerPacks().reduce((acc, p) => acc + p.bytesAprox, 0);
}

export interface ProgresoDescarga {
  hechas: number;
  total: number;
}

/** Descarga y cachea las teselas del corredor de `linea`; guarda el pack al terminar. */
export async function descargarPack(
  datos: {
    id: string;
    nombre: string;
    tipo: PackDescarga["tipo"];
    linea: [number, number][];
  },
  onProgreso?: (p: ProgresoDescarga) => void,
  señal?: AbortSignal,
): Promise<void> {
  const urls = urlsParaDescarga(datos.linea);
  const cache = await caches.open(CACHE_PACKS);
  const cola = [...urls];
  let hechas = 0;
  let bytesAprox = 0;

  async function trabajador() {
    while (cola.length > 0) {
      if (señal?.aborted) return;
      const url = cola.pop();
      if (!url) return;
      const yaEsta = await cache.match(url);
      if (!yaEsta) {
        try {
          const respuesta = await fetch(url, { signal: señal });
          if (respuesta.ok) {
            bytesAprox += Number(respuesta.headers.get("content-length") ?? 0);
            await cache.put(url, respuesta);
          }
        } catch {
          // Tesela puntual fallida (o abortada): se sigue con el resto,
          // no bloquea el resto del pack.
        }
      }
      hechas++;
      onProgreso?.({ hechas, total: urls.length });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
  if (señal?.aborted) return;

  guardarPacks([
    ...leerPacks().filter((p) => p.id !== datos.id),
    {
      id: datos.id,
      nombre: datos.nombre,
      tipo: datos.tipo,
      creadoEl: new Date().toISOString(),
      urls,
      bytesAprox,
    },
  ]);
}

/** Borra un pack sin tocar las teselas que aún use algún otro pack superviviente. */
export async function borrarPack(id: string): Promise<void> {
  const packs = leerPacks();
  const pack = packs.find((p) => p.id === id);
  if (!pack) return;
  const restantes = packs.filter((p) => p.id !== id);
  const protegidas = new Set(restantes.flatMap((p) => p.urls));

  const cache = await caches.open(CACHE_PACKS);
  await Promise.all(
    pack.urls.filter((u) => !protegidas.has(u)).map((u) => cache.delete(u)),
  );
  guardarPacks(restantes);
}
