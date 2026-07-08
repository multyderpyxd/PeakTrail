/**
 * Modelo de datos del catálogo de elementos geográficos.
 * En Firestore se guarda en la colección `elementos`, con `id` como
 * identificador de documento. El mismo tipo sirve para leer el snapshot
 * versionado en `public/catalogo.json`.
 */

export type TipoElemento = "pico" | "ibon" | "refugio" | "collado";

/**
 * Comunidad autónoma de origen (Overpass consulta una por una). En rutas
 * transfronterizas entre comunidades se guarda la primera en la que se
 * encontró la relación; el reparto por comarcas (más fino) queda pendiente.
 */
export type Comunidad = "aragon" | "navarra" | "cataluna";

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
  /** Ausente en los extras manuales de data/curados.json. */
  comunidad?: Comunidad;
  descripcion?: string;
  fotos?: string[];
  fuente: FuenteDatos;
}

export interface Catalogo {
  generadoEl: string;
  totales: Record<TipoElemento, number>;
  elementos: ElementoGeografico[];
}
