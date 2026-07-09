/**
 * Grupo activo: qué grupo de amigos se está viendo/usando ahora mismo. Es
 * estado de cliente, no de sesión (no depende de quién ha entrado, solo de
 * qué eligió ver la última vez) — mismo patrón que preferencias.ts. Se lee
 * tras montar y se valida contra los grupos reales del usuario (puede haber
 * cambiado de dispositivo, o haber sido expulsado de ese grupo).
 */

const CLAVE = "peaktrail:grupoActivo:1";

export function leerGrupoActivo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function guardarGrupoActivo(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(CLAVE, id);
    else window.localStorage.removeItem(CLAVE);
  } catch {
    // Sin sitio o en modo privado: el grupo activo no se recuerda entre sesiones
  }
}
