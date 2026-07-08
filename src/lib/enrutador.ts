/**
 * Enrutamiento a pie entre dos puntos siguiendo caminos y sendas de OSM.
 *
 * Motor principal: BRouter (brouter.de, perfil hiking-mountain), que navega
 * sendas de montaña reales (pondera sac_scale en vez de excluirlo). El OSRM a
 * pie de FOSSGIS queda como respaldo, pero su perfil foot EXCLUYE del grafo
 * los caminos con sac_scale mayor que hiking: en alta montaña (Góriz, por
 * ejemplo) enganchaba los clics a caminos «fáciles» a más de un kilómetro y
 * el trazado salía por otro lado — ese era el bug de los puntos mal colocados.
 * Si ambos motores fallan, el segmento degrada a línea recta.
 *
 * Comportamiento de los extremos (predecible, estilo Komoot):
 * - Clic a ≤ UMBRAL_SNAP_M del camino: el punto se adhiere al camino (snap).
 * - Clic más lejos: el punto se queda EXACTAMENTE donde se clicó y el tramo
 *   se une al camino con un conector recto explícito.
 * En ambos casos la geometría devuelta empieza en `inicio` y termina en `fin`,
 * de modo que la línea siempre llega al marcador.
 */

const BROUTER = "https://brouter.de/brouter";
const PERFIL_BROUTER = "hiking-mountain";
const OSRM_A_PIE = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

/** Distancia clic-camino por debajo de la cual el punto se pega al camino. */
export const UMBRAL_SNAP_M = 45;

const TIMEOUT_BROUTER_MS = 10000;
const TIMEOUT_OSRM_MS = 6000;

export interface SegmentoRuta {
  /** Trazado completo del segmento; empieza en `inicio` y termina en `fin`. */
  coords: [number, number][];
  /** false cuando se degradó a línea recta pura. */
  porSenderos: boolean;
  /** Posición visible del extremo inicial (clic o enganche, según snap). */
  inicio: [number, number];
  /** Posición visible del extremo final (clic o enganche, según snap). */
  fin: [number, number];
}

const R_TIERRA = 6371000;
export function distanciaMetros(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(a));
}

async function pedirJson(url: string, timeoutMs: number): Promise<unknown> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), timeoutMs);
  try {
    const respuesta = await fetch(url, { signal: control.signal });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return await respuesta.json();
  } finally {
    clearTimeout(temporizador);
  }
}

/** Geometría por la red de senderos con BRouter (con elevación, se descarta). */
async function nucleoBRouter(
  a: [number, number],
  b: [number, number],
): Promise<[number, number][]> {
  const url =
    `${BROUTER}?lonlats=${a[0]},${a[1]}%7C${b[0]},${b[1]}` +
    `&profile=${PERFIL_BROUTER}&alternativeidx=0&format=geojson`;
  const datos = (await pedirJson(url, TIMEOUT_BROUTER_MS)) as {
    features?: { geometry?: { coordinates?: number[][] } }[];
  };
  const coords = datos.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) throw new Error("BRouter sin ruta");
  return coords.map((c) => [c[0], c[1]]);
}

/** Geometría por la red peatonal con OSRM (respaldo). */
async function nucleoOsrm(
  a: [number, number],
  b: [number, number],
): Promise<[number, number][]> {
  const url =
    `${OSRM_A_PIE}/${a[0]},${a[1]};${b[0]},${b[1]}` +
    `?overview=full&geometries=geojson&steps=false`;
  const datos = (await pedirJson(url, TIMEOUT_OSRM_MS)) as {
    code?: string;
    routes?: { geometry?: { coordinates?: [number, number][] } }[];
  };
  const coords =
    datos.code === "Ok" ? datos.routes?.[0]?.geometry?.coordinates : undefined;
  if (!coords || coords.length < 2) throw new Error("OSRM sin ruta");
  return coords;
}

/**
 * Compone el segmento final a partir de la geometría de red: decide por cada
 * extremo entre snap (el punto visible se mueve al enganche) o conector recto
 * (el punto visible se queda en el clic y se une con una recta al enganche).
 * Exportada para poder probarla sin red.
 */
export function componerSegmento(
  a: [number, number],
  b: [number, number],
  red: [number, number][],
  umbralSnapM: number = UMBRAL_SNAP_M,
): SegmentoRuta {
  const engancheA = red[0];
  const engancheB = red[red.length - 1];
  const snapA = distanciaMetros(a, engancheA) <= umbralSnapM;
  const snapB = distanciaMetros(b, engancheB) <= umbralSnapM;
  const inicio = snapA ? engancheA : a;
  const fin = snapB ? engancheB : b;
  const coords: [number, number][] = [
    ...(snapA ? [] : [a]),
    ...red,
    ...(snapB ? [] : [b]),
  ];
  return { coords, porSenderos: true, inicio, fin };
}

function segmentoRecto(
  a: [number, number],
  b: [number, number],
): SegmentoRuta {
  return { coords: [a, b], porSenderos: false, inicio: a, fin: b };
}

export async function enrutarSegmento(
  a: [number, number],
  b: [number, number],
  porSenderos: boolean,
): Promise<SegmentoRuta> {
  if (!porSenderos) return segmentoRecto(a, b);
  let red: [number, number][];
  try {
    red = await nucleoBRouter(a, b);
  } catch {
    try {
      red = await nucleoOsrm(a, b);
    } catch {
      return segmentoRecto(a, b);
    }
  }
  return componerSegmento(a, b, red);
}
