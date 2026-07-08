/** Punto marcado por el usuario al planificar (posición del clic/arrastre). */
export interface Waypoint {
  id: string;
  lngLat: [number, number];
}

/**
 * Ruta planificada por el usuario con el planificador del mapa.
 * Se guarda en la colección `planes` de Firestore (sin dueño hasta que
 * llegue la autenticación del Hito 7).
 */
export interface RutaPlaneada {
  id: string;
  nombre: string;
  /** Nombre visible de quien la creó; null en planes anteriores al Hito 7. */
  nombreUsuario?: string | null;
  /** ISO 8601; null si el servidor aún no asignó la marca de tiempo. */
  creadaEl: string | null;
  /** Puntos marcados por el usuario. */
  puntos: [number, number][];
  /** Trazado completo resultante (enganchado a senderos o libre). */
  linea: [number, number][];
  distanciaKm: number;
  desnivelPos: number;
  desnivelNeg: number;
  altMin: number;
  altMax: number;
  /** Pares [km acumulado, altitud]. */
  perfil: [number, number][];
}
