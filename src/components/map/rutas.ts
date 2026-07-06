import type { FeatureCollection, MultiLineString } from "geojson";
import type { LngLatBoundsLike } from "maplibre-gl";
import type { ArchivoRutas, RedRuta, Ruta } from "@/types/rutas";

/**
 * Colores de las redes de senderos, inspirados en sus marcas reales
 * (GR rojo, PR amarillo, SL verde) y ajustados a la banda de contraste
 * del tema oscuro (validados frente a la superficie del panel).
 */
export const COLOR_RED: Record<RedRuta, string> = {
  gr: "#c26a3f",
  pr: "#c98500",
  sl: "#55a05e",
};

export const ETIQUETA_RED: Record<RedRuta, string> = {
  gr: "GR",
  pr: "PR",
  sl: "SL",
};

let cache: Map<string, Ruta> | null = null;

/** Descarga public/rutas.json una sola vez y lo indexa por id. */
export async function cargarRutas(): Promise<Map<string, Ruta>> {
  if (!cache) {
    const r = await fetch("/rutas.json");
    if (!r.ok) throw new Error(`No se pudo cargar rutas.json (${r.status})`);
    const datos: ArchivoRutas = await r.json();
    cache = new Map(datos.rutas.map((ruta) => [ruta.id, ruta]));
  }
  return cache;
}

export function coleccionRutas(
  rutas: Iterable<Ruta>,
): FeatureCollection<MultiLineString> {
  return {
    type: "FeatureCollection",
    features: [...rutas].map((ruta) => ({
      type: "Feature",
      geometry: { type: "MultiLineString", coordinates: ruta.partes },
      properties: { id: ruta.id, red: ruta.red },
    })),
  };
}

export function limitesRuta(ruta: Ruta): LngLatBoundsLike {
  let [oeste, sur, este, norte] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const parte of ruta.partes) {
    for (const [lng, lat] of parte) {
      oeste = Math.min(oeste, lng);
      este = Math.max(este, lng);
      sur = Math.min(sur, lat);
      norte = Math.max(norte, lat);
    }
  }
  return [oeste, sur, este, norte];
}
