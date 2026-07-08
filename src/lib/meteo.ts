/**
 * Previsión meteorológica de 7 días por punto, con Open-Meteo (gratuito y sin
 * clave). Se pide la temperatura ajustada a la cota del elemento (parámetro
 * `elevation`), viento, precipitación y nevada diarios, y el nivel de
 * congelación horario del que se deriva la cota de nieve del día.
 *
 * Los códigos meteo son WMO; se agrupan en un puñado de estados con icono
 * propio (ver `IconoMeteo`). Respuesta cacheada en memoria por punto.
 */

const BASE = "https://api.open-meteo.com/v1/forecast";

export type EstadoCielo =
  | "despejado"
  | "poco-nuboso"
  | "nuboso"
  | "niebla"
  | "lluvia"
  | "chubascos"
  | "nieve"
  | "tormenta";

export interface DiaMeteo {
  /** ISO YYYY-MM-DD. */
  fecha: string;
  estado: EstadoCielo;
  tempMax: number;
  tempMin: number;
  /** Precipitación acumulada en mm. */
  precipitacion: number;
  /** Probabilidad de precipitación máxima del día (%), si la da el servicio. */
  probLluvia: number | null;
  /** Nevada acumulada en cm. */
  nevada: number;
  /** Racha/viento máximo en km/h. */
  viento: number;
  /** Cota de nieve estimada (m), mínima del día; null si no aplica. */
  cotaNieve: number | null;
}

function estadoDesdeCodigo(codigo: number): EstadoCielo {
  if (codigo === 0) return "despejado";
  if (codigo <= 2) return "poco-nuboso";
  if (codigo === 3) return "nuboso";
  if (codigo === 45 || codigo === 48) return "niebla";
  if (codigo >= 71 && codigo <= 77) return "nieve";
  if (codigo === 85 || codigo === 86) return "nieve";
  if (codigo >= 95) return "tormenta";
  if (codigo >= 80 && codigo <= 82) return "chubascos";
  return "lluvia";
}

export const ETIQUETA_CIELO: Record<EstadoCielo, string> = {
  despejado: "Despejado",
  "poco-nuboso": "Poco nuboso",
  nuboso: "Nuboso",
  niebla: "Niebla",
  lluvia: "Lluvia",
  chubascos: "Chubascos",
  nieve: "Nieve",
  tormenta: "Tormenta",
};

const cache = new Map<string, Promise<DiaMeteo[]>>();

export function pronostico(
  lat: number,
  lng: number,
  altitud: number | null,
): Promise<DiaMeteo[]> {
  // Cache por punto redondeado (~1 km) y cota; la previsión no cambia con el
  // decimal fino y así compartimos peticiones entre elementos cercanos
  const clave = `${lat.toFixed(2)},${lng.toFixed(2)},${altitud ?? "-"}`;
  let promesa = cache.get(clave);
  if (!promesa) {
    promesa = pedir(lat, lng, altitud);
    cache.set(clave, promesa);
    promesa.catch(() => cache.delete(clave));
  }
  return promesa;
}

async function pedir(
  lat: number,
  lng: number,
  altitud: number | null,
): Promise<DiaMeteo[]> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,snowfall_sum,wind_speed_10m_max",
    hourly: "freezing_level_height",
    timezone: "Europe/Madrid",
    forecast_days: "7",
    wind_speed_unit: "kmh",
  });
  if (altitud !== null) params.set("elevation", String(Math.round(altitud)));

  const respuesta = await fetch(`${BASE}?${params.toString()}`);
  if (!respuesta.ok) throw new Error(`Open-Meteo ${respuesta.status}`);
  const datos = await respuesta.json();

  const d = datos.daily;
  const cotaPorDia = cotasNievePorDia(datos.hourly);

  return d.time.map((fecha: string, i: number): DiaMeteo => ({
    fecha,
    estado: estadoDesdeCodigo(d.weather_code[i]),
    tempMax: Math.round(d.temperature_2m_max[i]),
    tempMin: Math.round(d.temperature_2m_min[i]),
    precipitacion: Math.round((d.precipitation_sum[i] ?? 0) * 10) / 10,
    probLluvia: d.precipitation_probability_max?.[i] ?? null,
    nevada: Math.round((d.snowfall_sum[i] ?? 0) * 10) / 10,
    viento: Math.round(d.wind_speed_10m_max[i] ?? 0),
    cotaNieve: cotaPorDia.get(fecha) ?? null,
  }));
}

/**
 * Cota de nieve mínima de cada día a partir del nivel de congelación horario
 * (redondeada a 50 m). La mínima del día es la línea de nieve más baja que se
 * alcanza, que es lo relevante para saber si nevará en cotas de montaña.
 */
function cotasNievePorDia(hourly: {
  time?: string[];
  freezing_level_height?: number[];
}): Map<string, number> {
  const minimos = new Map<string, number>();
  const tiempos = hourly?.time ?? [];
  const alturas = hourly?.freezing_level_height ?? [];
  for (let i = 0; i < tiempos.length; i++) {
    const dia = tiempos[i].slice(0, 10);
    const h = alturas[i];
    if (h == null) continue;
    const previo = minimos.get(dia);
    if (previo === undefined || h < previo) minimos.set(dia, h);
  }
  for (const [dia, h] of minimos) minimos.set(dia, Math.round(h / 50) * 50);
  return minimos;
}
