/**
 * Conexión con Strava desde el navegador. Los tokens se guardan por
 * dispositivo en localStorage; el intercambio y la renovación pasan por
 * los route handlers de /api/strava (el secreto no sale del servidor).
 */

export interface ConexionStrava {
  accessToken: string;
  refreshToken: string;
  /** Época Unix (segundos) en que caduca el token de acceso. */
  expiraEn: number;
  atleta: string;
}

export interface ActividadStrava {
  id: number;
  nombre: string;
  /** YYYY-MM-DD, en hora local del atleta. */
  fecha: string;
  /** Época Unix (segundos) del inicio en UTC; para pedir solo lo nuevo. */
  epoca: number;
  deporte: string;
  distanciaKm: number;
  /** Tiempo en movimiento, en segundos. */
  tiempoMovS: number;
  /** Desnivel positivo acumulado según Strava, en metros. */
  desnivelM: number;
  /** summary_polyline codificada; null si la actividad no tiene mapa. */
  polilinea: string | null;
}

const CLAVE = "peaktrail.strava";

/** Deportes a pie o de travesía que cuentan para el emparejado. */
export const DEPORTES_MONTANA = new Set([
  "Hike",
  "Walk",
  "Run",
  "TrailRun",
  "Snowshoe",
  "BackcountrySki",
  "NordicSki",
  "RockClimbing",
]);

export const stravaConfigurado = Boolean(
  process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
);

export function conectarStrava(): void {
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID!);
  url.searchParams.set(
    "redirect_uri",
    `${window.location.origin}/api/strava/callback`,
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "read,activity:read_all");
  url.searchParams.set("approval_prompt", "auto");
  window.location.href = url.toString();
}

/** Recoge los tokens del fragmento #strava=... al volver del OAuth. */
export function procesarRetornoStrava(): ConexionStrava | null {
  const fragmento = window.location.hash;
  if (!fragmento.startsWith("#strava=")) return null;
  try {
    const conexion: ConexionStrava = JSON.parse(
      decodeURIComponent(fragmento.slice("#strava=".length)),
    );
    localStorage.setItem(CLAVE, JSON.stringify(conexion));
    history.replaceState(null, "", window.location.pathname);
    return conexion;
  } catch {
    return null;
  }
}

export function conexionStrava(): ConexionStrava | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as ConexionStrava) : null;
  } catch {
    return null;
  }
}

export function desconectarStrava(): void {
  localStorage.removeItem(CLAVE);
}

async function conexionValida(): Promise<ConexionStrava> {
  const conexion = conexionStrava();
  if (!conexion) throw new Error("Sin conexión con Strava");
  if (conexion.expiraEn * 1000 > Date.now() + 60_000) return conexion;

  const respuesta = await fetch("/api/strava/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: conexion.refreshToken }),
  });
  if (!respuesta.ok) {
    desconectarStrava();
    throw new Error("La sesión de Strava ha caducado; vuelve a conectar");
  }
  const nuevos = await respuesta.json();
  const renovada = { ...conexion, ...nuevos };
  localStorage.setItem(CLAVE, JSON.stringify(renovada));
  return renovada;
}

/**
 * Descarga actividades (hasta maxPaginas × 200). Con `despuesDe` (época Unix)
 * pide a Strava solo las posteriores a ese instante: importación incremental.
 */
export async function obtenerActividades(
  maxPaginas = 5,
  despuesDe?: number,
): Promise<ActividadStrava[]> {
  const conexion = await conexionValida();
  const actividades: ActividadStrava[] = [];
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const parametros = new URLSearchParams({ page: String(pagina) });
    if (despuesDe) parametros.set("after", String(despuesDe));
    const respuesta = await fetch(
      `/api/strava/actividades?${parametros.toString()}`,
      { headers: { Authorization: `Bearer ${conexion.accessToken}` } },
    );
    if (!respuesta.ok) throw new Error("No se pudieron leer las actividades");
    const lote: Array<{
      id: number;
      name: string;
      start_date: string;
      start_date_local: string;
      sport_type: string;
      distance: number;
      moving_time: number;
      total_elevation_gain: number;
      map?: { summary_polyline?: string | null };
    }> = await respuesta.json();
    for (const a of lote) {
      actividades.push({
        id: a.id,
        nombre: a.name,
        fecha: a.start_date_local.slice(0, 10),
        epoca: Math.floor(Date.parse(a.start_date) / 1000),
        deporte: a.sport_type,
        distanciaKm: +(a.distance / 1000).toFixed(1),
        tiempoMovS: a.moving_time ?? 0,
        desnivelM: Math.round(a.total_elevation_gain ?? 0),
        polilinea: a.map?.summary_polyline || null,
      });
    }
    if (lote.length < 200) break;
  }
  return actividades;
}
