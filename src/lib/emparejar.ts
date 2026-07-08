import type { ElementoGeografico } from "@/types/catalogo";
import type { Ruta } from "@/types/rutas";
import type { RutaPlaneada } from "@/types/plan";

/**
 * Emparejado geográfico de una traza de Strava con el catálogo:
 *  - un elemento coincide si la traza pasa a menos de RADIO_ELEMENTO_M
 *  - una ruta (o un plan propio) coincide si al menos COBERTURA_MINIMA de
 *    sus puntos quedan a menos de RADIO_RUTA_M de la traza
 * Los puntos de la traza se indexan en una rejilla para que la búsqueda
 * de vecinos sea barata.
 */

const RADIO_ELEMENTO_M = 150;
const RADIO_RUTA_M = 250;
const COBERTURA_MINIMA = 0.7;
const CELDA_GRADOS = 0.003; // ~330 m de lado en esta latitud

/** Decodifica una polilinea de Google/Strava a pares [lng, lat]. */
export function decodificarPolilinea(cadena: string): [number, number][] {
  const puntos: [number, number][] = [];
  let indice = 0;
  let lat = 0;
  let lng = 0;
  while (indice < cadena.length) {
    for (const eje of [0, 1] as const) {
      let resultado = 0;
      let desplazamiento = 0;
      let byte;
      do {
        byte = cadena.charCodeAt(indice++) - 63;
        resultado |= (byte & 0x1f) << desplazamiento;
        desplazamiento += 5;
      } while (byte >= 0x20);
      const delta = resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
      if (eje === 0) lat += delta;
      else lng += delta;
    }
    puntos.push([lng / 1e5, lat / 1e5]);
  }
  return puntos;
}

class IndiceTraza {
  private celdas = new Map<string, [number, number][]>();
  private escalaLng: number;

  constructor(traza: [number, number][]) {
    this.escalaLng = Math.cos(((traza[0]?.[1] ?? 42.6) * Math.PI) / 180);
    for (const punto of traza) {
      const clave = this.clave(punto);
      const celda = this.celdas.get(clave);
      if (celda) celda.push(punto);
      else this.celdas.set(clave, [punto]);
    }
  }

  private clave([lng, lat]: [number, number]): string {
    return `${Math.floor(lng / CELDA_GRADOS)},${Math.floor(lat / CELDA_GRADOS)}`;
  }

  /** ¿Hay algún punto de la traza a menos de `radioM` metros? */
  cerca([lng, lat]: [number, number], radioM: number): boolean {
    const cx = Math.floor(lng / CELDA_GRADOS);
    const cy = Math.floor(lat / CELDA_GRADOS);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const celda = this.celdas.get(`${cx + dx},${cy + dy}`);
        if (!celda) continue;
        for (const [plng, plat] of celda) {
          const dxM = (plng - lng) * 111320 * this.escalaLng;
          const dyM = (plat - lat) * 110540;
          if (dxM * dxM + dyM * dyM <= radioM * radioM) return true;
        }
      }
    }
    return false;
  }
}

export interface Coincidencias {
  elementos: ElementoGeografico[];
  rutas: Ruta[];
  planes: RutaPlaneada[];
}

/** Fracción de los puntos de una línea a menos de RADIO_RUTA_M de la traza. */
function cobertura(
  indice: IndiceTraza,
  partes: [number, number][][],
  caja: [number, number, number, number],
): number {
  const [oeste, sur, este, norte] = caja;
  const margen = 0.005;
  let total = 0;
  let cubiertos = 0;
  for (const parte of partes) {
    for (const punto of parte) {
      total += 1;
      const [lng, lat] = punto;
      // Fuera de la caja de la traza no puede estar cubierto: se evita
      // la consulta a la rejilla pero el punto sí cuenta en el total
      if (
        lng < oeste - margen ||
        lng > este + margen ||
        lat < sur - margen ||
        lat > norte + margen
      )
        continue;
      if (indice.cerca(punto, RADIO_RUTA_M)) cubiertos += 1;
    }
  }
  return total > 0 ? cubiertos / total : 0;
}

export function emparejarTraza(
  traza: [number, number][],
  elementos: Iterable<ElementoGeografico>,
  rutas: Iterable<Ruta>,
  planes: Iterable<RutaPlaneada> = [],
): Coincidencias {
  if (traza.length < 2) return { elementos: [], rutas: [], planes: [] };
  const indice = new IndiceTraza(traza);

  let [oeste, sur, este, norte] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lng, lat] of traza) {
    oeste = Math.min(oeste, lng);
    este = Math.max(este, lng);
    sur = Math.min(sur, lat);
    norte = Math.max(norte, lat);
  }
  const margen = 0.005;
  const caja: [number, number, number, number] = [oeste, sur, este, norte];

  const coincidencias: Coincidencias = { elementos: [], rutas: [], planes: [] };

  for (const elemento of elementos) {
    const { lng, lat } = elemento.coordenadas;
    if (lng < oeste - margen || lng > este + margen || lat < sur - margen || lat > norte + margen)
      continue;
    if (indice.cerca([lng, lat], RADIO_ELEMENTO_M)) {
      coincidencias.elementos.push(elemento);
    }
  }

  for (const ruta of rutas) {
    if (cobertura(indice, ruta.partes, caja) >= COBERTURA_MINIMA) {
      coincidencias.rutas.push(ruta);
    }
  }

  for (const plan of planes) {
    if (cobertura(indice, [plan.linea], caja) >= COBERTURA_MINIMA) {
      coincidencias.planes.push(plan);
    }
  }

  return coincidencias;
}
