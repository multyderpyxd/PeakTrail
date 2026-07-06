/**
 * Enrutamiento a pie entre dos puntos siguiendo caminos y sendas de OSM,
 * con el OSRM público de FOSSGIS (el mismo que usa openstreetmap.org).
 * Si el servicio falla o no encuentra ruta, se degrada a línea recta.
 */

const OSRM_A_PIE = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

export interface SegmentoPlan {
  coords: [number, number][];
  /** false cuando se degradó a línea recta. */
  porSenderos: boolean;
}

export async function segmentoAPie(
  a: [number, number],
  b: [number, number],
): Promise<SegmentoPlan> {
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
    // OSRM engancha al camino más próximo; unimos los clics reales con
    // conectores rectos para que el trazado no quede cortado
    return { coords: [a, ...coords, b], porSenderos: true };
  } catch {
    return { coords: [a, b], porSenderos: false };
  }
}
