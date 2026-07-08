import type { FeatureCollection, LineString } from "geojson";
import type { ActividadStrava } from "@/lib/strava";
import { decodificarPolilinea } from "@/lib/emparejar";

/**
 * Capa «Mis actividades»: las trazas de Strava del usuario como una red de
 * líneas más del mapa. Azul de la serie de elevación (#3f92c9), validado en
 * CVD contra GR/PR/SL con el validador del skill de dataviz (ΔE mínimo 24,6
 * en el conjunto, muy por encima del umbral 12; frente al marcador de ibones
 * la codificación secundaria es el propio tipo de marca: línea vs insignia).
 */
export const COLOR_ACTIVIDAD = "#3f92c9";

export function coleccionActividades(
  actividades: ActividadStrava[],
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: actividades
      .filter((a) => a.polilinea)
      .map((a) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: decodificarPolilinea(a.polilinea!),
        },
        properties: { id: a.id },
      })),
  };
}
