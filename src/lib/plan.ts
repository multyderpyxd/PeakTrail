/**
 * Lógica pura del planificador de rutas propias: posiciones visibles de los
 * puntos, cosido del trazado e inserción de puntos intermedios sobre la
 * línea. Sin dependencias del mapa ni de React para poder probarla aislada.
 */

import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import type { SegmentoRuta } from "./enrutador";
import type { Waypoint } from "@/types/plan";

/** Clave de caché de un segmento: modo + par de coordenadas redondeadas. */
export function claveSegmento(
  porSenderos: boolean,
  a: [number, number],
  b: [number, number],
): string {
  const p = (c: [number, number]) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
  return `${porSenderos ? "s" : "r"}|${p(a)}|${p(b)}`;
}

/**
 * Posición visible de cada waypoint: el extremo del segmento que sale de él
 * (que ya resolvió snap o conector), el del que entra si es el último, o el
 * propio clic si aún no hay segmentos. El marcador siempre cae sobre la línea.
 */
export function nodosDelPlan(
  waypoints: Waypoint[],
  segmentos: SegmentoRuta[],
): [number, number][] {
  return waypoints.map(
    (wp, i) => segmentos[i]?.inicio ?? segmentos[i - 1]?.fin ?? wp.lngLat,
  );
}

/**
 * Cose los segmentos en una única línea, deduplicando el punto de unión
 * cuando coincide. Si los extremos de dos segmentos consecutivos difieren
 * (snaps a caminos distintos en un cruce), la concatenación misma hace de
 * mini-conector y la línea queda continua.
 */
export function coserTrazado(segmentos: SegmentoRuta[]): [number, number][] {
  const linea: [number, number][] = [];
  for (const seg of segmentos) {
    for (const c of seg.coords) {
      const ultimo = linea[linea.length - 1];
      if (ultimo && ultimo[0] === c[0] && ultimo[1] === c[1]) continue;
      linea.push(c);
    }
  }
  return linea;
}

/**
 * Índice donde insertar un nuevo waypoint cuando se pulsa sobre la línea:
 * el segmento más cercano al clic determina entre qué dos puntos va.
 * Devuelve null si no hay segmentos.
 */
export function indiceDeInsercion(
  segmentos: SegmentoRuta[],
  clic: [number, number],
): number | null {
  let mejor: { indice: number; dist: number } | null = null;
  for (let i = 0; i < segmentos.length; i++) {
    const coords = segmentos[i].coords;
    if (coords.length < 2) continue;
    const cercano = nearestPointOnLine(lineString(coords), point(clic));
    const dist = cercano.properties.dist ?? Infinity;
    if (!mejor || dist < mejor.dist) mejor = { indice: i + 1, dist };
  }
  return mejor?.indice ?? null;
}
