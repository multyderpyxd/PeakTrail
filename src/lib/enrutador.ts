/**
 * Enrutamiento a pie entre dos puntos siguiendo caminos y sendas de OSM,
 * con el OSRM público de FOSSGIS (el mismo que usa openstreetmap.org).
 *
 * Devuelve la geometría de OSRM tal cual (sin conectores rectos al clic, que
 * era lo que ensuciaba el trazado) junto con los extremos «enganchados» al
 * sendero para poder colocar ahí el marcador. Si el servicio falla, no
 * encuentra ruta, o el enganche queda demasiado lejos del clic (zona sin
 * sendas), se degrada a línea recta conservando el punto marcado.
 */

const OSRM_A_PIE = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

/** Si el sendero más próximo queda más lejos que esto, no se engancha. */
const MAX_ENGANCHE_M = 400;

export interface SegmentoRuta {
  /** Trazado del segmento, de `inicio` a `fin`. */
  coords: [number, number][];
  /** false cuando se degradó a línea recta. */
  porSenderos: boolean;
  /** Extremo inicial ya enganchado al sendero (o el clic si fue recto). */
  inicio: [number, number];
  /** Extremo final ya enganchado al sendero (o el clic si fue recto). */
  fin: [number, number];
}

const R_TIERRA = 6371000;
function metros(
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

export async function enrutarSegmento(
  a: [number, number],
  b: [number, number],
  porSenderos: boolean,
): Promise<SegmentoRuta> {
  if (!porSenderos) {
    return { coords: [a, b], porSenderos: false, inicio: a, fin: b };
  }
  try {
    const url =
      `${OSRM_A_PIE}/${a[0]},${a[1]};${b[0]},${b[1]}` +
      `?overview=full&geometries=geojson&steps=false`;
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error(`OSRM ${respuesta.status}`);
    const datos = await respuesta.json();
    const coords: [number, number][] | undefined =
      datos.code === "Ok" ? datos.routes?.[0]?.geometry?.coordinates : undefined;
    if (!coords || coords.length < 2) throw new Error("sin ruta");

    const wps = datos.waypoints as { location?: [number, number] }[] | undefined;
    const inicio = wps?.[0]?.location ?? coords[0];
    const fin = wps?.[1]?.location ?? coords[coords.length - 1];
    // Si el enganche desvía demasiado el punto marcado, mejor recta
    if (metros(a, inicio) > MAX_ENGANCHE_M || metros(b, fin) > MAX_ENGANCHE_M) {
      return { coords: [a, b], porSenderos: false, inicio: a, fin: b };
    }
    return { coords, porSenderos: true, inicio, fin };
  } catch {
    return { coords: [a, b], porSenderos: false, inicio: a, fin: b };
  }
}
