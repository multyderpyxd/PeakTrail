import type { FeatureCollection, Point } from "geojson";
import type {
  Catalogo,
  ElementoGeografico,
  TipoElemento,
} from "@/types/catalogo";

/**
 * El catálogo se descarga de public/catalogo.json (generado por
 * `npm run catalogo:generar`); con miles de elementos ya no viaja dentro
 * del bundle JS. Se carga en el `load` del mapa y, como el velo de carga
 * bloquea la interfaz hasta entonces, el resto de componentes (buscador,
 * progreso, Strava) pueden leer los índices de este módulo con seguridad.
 */

/** Índice por id; vacío hasta que cargarCatalogo() termina. */
export const elementosPorId = new Map<string, ElementoGeografico>();

/** Totales por tipo; a cero hasta que cargarCatalogo() termina. */
export const TOTALES: Record<TipoElemento, number> = {
  pico: 0,
  ibon: 0,
  refugio: 0,
  collado: 0,
};

let promesa: Promise<Catalogo> | null = null;

export function cargarCatalogo(): Promise<Catalogo> {
  promesa ??= fetch("/catalogo.json")
    .then((r) => {
      if (!r.ok) throw new Error(`catalogo.json devolvió ${r.status}`);
      return r.json() as Promise<Catalogo>;
    })
    .then((catalogo) => {
      for (const el of catalogo.elementos) elementosPorId.set(el.id, el);
      Object.assign(TOTALES, catalogo.totales);
      return catalogo;
    })
    .catch((error) => {
      promesa = null; // permitir reintento si falló la red
      throw error;
    });
  return promesa;
}

/** Propiedades planas: lo que la capa de símbolos necesita para pintar y filtrar. */
export function coleccionElementos(
  elementos: ElementoGeografico[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: elementos.map((el) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [el.coordenadas.lng, el.coordenadas.lat],
      },
      properties: {
        id: el.id,
        tipo: el.tipo,
        altitud: el.altitud,
      },
    })),
  };
}
