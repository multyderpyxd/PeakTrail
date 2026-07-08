import type { Comunidad, FuenteDatos } from "./catalogo";

/** Red de senderos: GR (gran recorrido), PR (pequeño recorrido), SL (local). */
export type RedRuta = "gr" | "pr" | "sl";

export interface Ruta {
  id: string;
  /** Matrícula del sendero, ej. "GR 11" o "PR-HU 27"; null si no tiene. */
  ref: string | null;
  nombre: string;
  red: RedRuta;
  distanciaKm: number;
  desnivelPos: number;
  desnivelNeg: number;
  altMin: number;
  altMax: number;
  /** Perfil de elevación compacto: pares [km acumulado, altitud en m]. */
  perfil: [number, number][];
  /** Trazado simplificado para el mapa, en partes [ [lng,lat], ... ]. */
  partes: [number, number][][];
  /** Primera comunidad en la que se encontró la ruta (ver nota en Comunidad). */
  comunidad?: Comunidad;
  fuente: FuenteDatos;
}

export interface ArchivoRutas {
  generadoEl: string;
  rutas: Ruta[];
}
