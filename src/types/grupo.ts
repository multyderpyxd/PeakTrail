/**
 * Grupo de amigos: nombre, miembros (emails en minúscula, array en el propio
 * documento — a la escala de PeakTrail no compensa una subcolección) y
 * fecha de creación. Ver src/lib/grupos.ts.
 */
export interface Grupo {
  id: string;
  nombre: string;
  miembros: string[];
  creadoEl: string | null;
}

/**
 * Forma reducida usada para el selector de grupo activo; incluye
 * `miembros` (emails) para poder armar el selector de participantes al
 * marcar "lo he hecho" sin una consulta aparte.
 */
export interface GrupoResumen {
  id: string;
  nombre: string;
  miembros: string[];
}
