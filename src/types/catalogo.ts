/**
 * Modelo de datos del catálogo de elementos geográficos.
 * En Firestore se guarda en la colección `elementos`, con `id` como
 * identificador de documento. El mismo tipo sirve para leer el snapshot
 * versionado en `public/catalogo.json`.
 */

export type TipoElemento = "pico" | "ibon" | "refugio" | "collado";

export interface FuenteDatos {
  origen: "osm" | "manual";
  /** Referencia OSM para trazabilidad y refrescos posteriores. */
  osmTipo?: "node" | "way" | "relation";
  osmId?: number;
}

export interface ElementoGeografico {
  /** Slug estable derivado del nombre, ej. "pico-aneto". */
  id: string;
  tipo: TipoElemento;
  nombre: string;
  /** Altitud en metros; null si la fuente no la aporta. */
  altitud: number | null;
  coordenadas: { lng: number; lat: number };
  descripcion?: string;
  fotos?: string[];
  fuente: FuenteDatos;
}

export interface Catalogo {
  generadoEl: string;
  totales: Record<TipoElemento, number>;
  elementos: ElementoGeografico[];
}
