import type { FeatureCollection, MultiLineString, Point } from "geojson";
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

const R_TIERRA = 6371000;
function haversine([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(a));
}

/**
 * Vista de la ruta en sentido contrario: trazado recorrido al revés, perfil
 * volteado horizontalmente y desniveles intercambiados. El id se conserva
 * (es la misma ruta, solo cambia el sentido de la lectura).
 */
export function invertirRuta(ruta: Ruta): Ruta {
  const kmMax = ruta.perfil[ruta.perfil.length - 1][0];
  return {
    ...ruta,
    desnivelPos: ruta.desnivelNeg,
    desnivelNeg: ruta.desnivelPos,
    perfil: [...ruta.perfil]
      .reverse()
      .map(([km, ele]) => [+(kmMax - km).toFixed(2), ele]),
    partes: [...ruta.partes].reverse().map((parte) => [...parte].reverse()),
  };
}

/** Salida y llegada de la ruta (primer y último punto del trazado). */
export function extremosRuta(ruta: Ruta): FeatureCollection<Point> {
  const primera = ruta.partes[0];
  const ultima = ruta.partes[ruta.partes.length - 1];
  return {
    type: "FeatureCollection",
    features: [
      { rol: "ruta-inicio", coords: primera[0] },
      { rol: "ruta-fin", coords: ultima[ultima.length - 1] },
    ].map(({ rol, coords }) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: coords },
      properties: { rol },
    })),
  };
}

/**
 * Punto del trazado a `km` del inicio. El perfil se midió sobre la geometría
 * completa y aquí caminamos la simplificada, así que se normaliza por la
 * longitud de cada una para que el punto no derive al final de la ruta.
 */
export function puntoEnRuta(ruta: Ruta, km: number): [number, number] {
  const segmentos: { a: [number, number]; b: [number, number]; d: number }[] = [];
  let total = 0;
  for (const parte of ruta.partes) {
    for (let i = 1; i < parte.length; i++) {
      const d = haversine(parte[i - 1], parte[i]);
      segmentos.push({ a: parte[i - 1], b: parte[i], d });
      total += d;
    }
  }
  let objetivo = Math.min(1, Math.max(0, km / ruta.distanciaKm)) * total;
  for (const { a, b, d } of segmentos) {
    if (objetivo <= d) {
      const f = d === 0 ? 0 : objetivo / d;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    objetivo -= d;
  }
  const ultima = ruta.partes[ruta.partes.length - 1];
  return ultima[ultima.length - 1];
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
