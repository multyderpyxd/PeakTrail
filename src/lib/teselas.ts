/**
 * Calcula las URLs de teselas de mapa (ortofoto, topónimos, terreno) que
 * cubren el corredor de una línea (ruta, plan o traza de Strava), para
 * descargarlas por adelantado y consultarlas sin cobertura (src/lib/descargas.ts).
 *
 * En vez de un buffer poligonal real (que exigiría añadir @turf/buffer),
 * se remuestrea la línea cada PASO_CORREDOR_M y se añade, por cada punto,
 * su vecindario de teselas 3×3: a z16 una tesela mide ~450 m de lado a
 * latitud pirenaica, así que ese vecindario cubre de sobra un corredor de
 * 300-400 m a ambos lados sin necesitar geometría de buffer.
 */

import { remuestrear, teselaFraccional } from "./geo";
import { TESELAS_ELEVACION, TESELAS_PNOA, TESELAS_TOPONIMOS } from "@/components/map/mapStyle";

const PASO_CORREDOR_M = 150;
const VECINDARIO = 1; // ±1 tesela alrededor del punto muestreado (rejilla 3×3)

export const ZOOM_ORTOFOTO_MIN = 12;
export const ZOOM_ORTOFOTO_MAX = 16;
export const ZOOM_TERRENO = 13; // maxzoom real de la fuente terrarium en mapStyle.ts

interface Tesela {
  z: number;
  x: number;
  y: number;
}

function rellenarUrl(plantilla: string, t: Tesela): string {
  return plantilla
    .replace("{z}", String(t.z))
    .replace("{y}", String(t.y))
    .replace("{x}", String(t.x));
}

/** Teselas (deduplicadas) que cubren el corredor de la línea en los zooms dados. */
export function teselasDeCorredor(
  linea: [number, number][],
  zooms: number[],
): Tesela[] {
  if (linea.length === 0) return [];
  const puntos = remuestrear(linea, PASO_CORREDOR_M);
  const vistas = new Set<string>();
  const resultado: Tesela[] = [];
  for (const z of zooms) {
    for (const punto of puntos) {
      const { x: xf, y: yf } = teselaFraccional(punto, z);
      const xc = Math.floor(xf);
      const yc = Math.floor(yf);
      for (let dx = -VECINDARIO; dx <= VECINDARIO; dx++) {
        for (let dy = -VECINDARIO; dy <= VECINDARIO; dy++) {
          const clave = `${z}/${xc + dx}/${yc + dy}`;
          if (!vistas.has(clave)) {
            vistas.add(clave);
            resultado.push({ z, x: xc + dx, y: yc + dy });
          }
        }
      }
    }
  }
  return resultado;
}

function rango(min: number, max: number): number[] {
  const zs: number[] = [];
  for (let z = min; z <= max; z++) zs.push(z);
  return zs;
}

/** URLs a descargar para poder ver esta línea (y su entorno inmediato) sin cobertura. */
export function urlsParaDescarga(linea: [number, number][]): string[] {
  const teselasOrtofoto = teselasDeCorredor(linea, rango(ZOOM_ORTOFOTO_MIN, ZOOM_ORTOFOTO_MAX));
  const teselasTerreno = teselasDeCorredor(linea, [ZOOM_TERRENO]);

  const urls: string[] = [];
  for (const t of teselasOrtofoto) {
    urls.push(rellenarUrl(TESELAS_PNOA, t));
    urls.push(rellenarUrl(TESELAS_TOPONIMOS, t));
  }
  for (const t of teselasTerreno) {
    urls.push(rellenarUrl(TESELAS_ELEVACION, t));
  }
  return urls;
}
