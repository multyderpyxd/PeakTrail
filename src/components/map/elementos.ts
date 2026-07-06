import type { FeatureCollection, Point } from "geojson";
import catalogo from "../../../data/catalogo.json";
import type { Catalogo, ElementoGeografico } from "@/types/catalogo";

/**
 * El catálogo se lee del snapshot versionado en data/catalogo.json (mismo
 * contenido que la colección `elementos` de Firestore, que queda como base
 * para los datos de usuario de hitos posteriores).
 */
const datos = catalogo as unknown as Catalogo;

export const TOTALES = datos.totales;

export const elementosPorId: ReadonlyMap<string, ElementoGeografico> = new Map(
  datos.elementos.map((el) => [el.id, el]),
);

/** Propiedades planas: lo que la capa de símbolos necesita para pintar y filtrar. */
export function coleccionElementos(): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: datos.elementos.map((el) => ({
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
