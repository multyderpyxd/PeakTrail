/**
 * Caché local de las actividades de montaña de Strava (por dispositivo, en
 * localStorage, igual que los tokens): alimenta la capa «Mis actividades»
 * del mapa sin repetir descargas, y hace la importación incremental — al
 * sincronizar solo se piden a Strava las actividades posteriores a la última
 * época vista (`after=`).
 */

import {
  DEPORTES_MONTANA,
  obtenerActividades,
  type ActividadStrava,
} from "./strava";

const CLAVE = "peaktrail.strava.actividades";

interface CacheActividades {
  /** Solo deportes de montaña con traza; ordenadas de más nueva a más vieja. */
  actividades: ActividadStrava[];
  /** Época Unix (s) de la actividad más reciente vista (de cualquier deporte). */
  ultimaEpoca: number;
}

export function leerActividades(): CacheActividades | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as CacheActividades;
    if (!Array.isArray(datos.actividades)) return null;
    return datos;
  } catch {
    return null;
  }
}

export function borrarActividades(): void {
  localStorage.removeItem(CLAVE);
}

function guardar(cache: CacheActividades): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(cache));
  } catch {
    // Sin sitio (modo privado o demasiadas trazas): la capa funciona igual
    // en esta sesión, solo que la próxima vez habrá que volver a descargar
  }
}

export interface Sincronizacion {
  /** Todas las actividades de montaña con traza tras sincronizar. */
  todas: ActividadStrava[];
  /** Solo las que no estaban en la caché (para emparejar únicamente lo nuevo). */
  nuevas: ActividadStrava[];
}

/**
 * Sincroniza con Strava: la primera vez descarga el histórico reciente
 * (~1000 actividades); después pide solo lo posterior a la última época
 * conocida. Devuelve el total y las novedades.
 */
export async function sincronizarActividades(): Promise<Sincronizacion> {
  const previa = leerActividades();
  const descargadas = previa
    ? await obtenerActividades(5, previa.ultimaEpoca)
    : await obtenerActividades(5);

  const montana = descargadas.filter(
    (a) => a.polilinea && DEPORTES_MONTANA.has(a.deporte),
  );

  const conocidas = new Set(previa?.actividades.map((a) => a.id) ?? []);
  const nuevas = montana.filter((a) => !conocidas.has(a.id));

  const todas = [...nuevas, ...(previa?.actividades ?? [])].sort(
    (a, b) => b.epoca - a.epoca,
  );
  const ultimaEpoca = Math.max(
    previa?.ultimaEpoca ?? 0,
    ...descargadas.map((a) => a.epoca),
  );

  guardar({ actividades: todas, ultimaEpoca });
  return { todas, nuevas };
}
