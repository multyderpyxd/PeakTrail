/**
 * Exportar e importar rutas en GPX 1.1 (el formato estándar de GPS y apps de
 * montaña). La exportación interpola la elevación del perfil por distancia
 * acumulada para que la traza salga con cota; la importación lee la primera
 * traza (o ruta) del archivo.
 */

import type { Ruta } from "@/types/rutas";
import type { RutaPlaneada } from "@/types/plan";

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const R_TIERRA = 6371000;
function metros(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(a));
}

/** Elevación interpolada del perfil ([km, m]) en cada coordenada del trazado. */
function elevaciones(
  coords: [number, number][],
  perfil?: [number, number][],
): (number | null)[] {
  if (!perfil || perfil.length === 0) return coords.map(() => null);
  let acumulado = 0;
  return coords.map((c, i) => {
    if (i > 0) acumulado += metros(coords[i - 1], c) / 1000;
    // Búsqueda lineal del tramo del perfil que contiene la distancia
    for (let j = 1; j < perfil.length; j++) {
      if (perfil[j][0] >= acumulado) {
        const [km0, e0] = perfil[j - 1];
        const [km1, e1] = perfil[j];
        const t = km1 === km0 ? 0 : (acumulado - km0) / (km1 - km0);
        return Math.round(e0 + (e1 - e0) * t);
      }
    }
    return perfil[perfil.length - 1][1];
  });
}

export function construirGpx({
  nombre,
  coords,
  perfil,
  puntos,
}: {
  nombre: string;
  coords: [number, number][];
  perfil?: [number, number][];
  /** Puntos con nombre (salida, llegada, paradas) como waypoints. */
  puntos?: { coord: [number, number]; nombre: string }[];
}): string {
  const eles = elevaciones(coords, perfil);
  const trkpts = coords
    .map(([lng, lat], i) => {
      const ele = eles[i];
      return (
        `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}">` +
        (ele !== null ? `<ele>${ele}</ele>` : "") +
        `</trkpt>`
      );
    })
    .join("\n");
  const wpts = (puntos ?? [])
    .map(
      ({ coord: [lng, lat], nombre: n }) =>
        `  <wpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"><name>${escapar(
          n,
        )}</name></wpt>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="PeakTrail" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata><name>${escapar(nombre)}</name></metadata>\n` +
    (wpts ? wpts + "\n" : "") +
    `  <trk>\n    <name>${escapar(nombre)}</name>\n    <trkseg>\n` +
    trkpts +
    `\n    </trkseg>\n  </trk>\n</gpx>\n`
  );
}

export function rutaCatalogoAGpx(ruta: Ruta): string {
  const coords = ruta.partes.flat();
  const puntos =
    coords.length > 1
      ? [
          { coord: coords[0], nombre: "Salida" },
          { coord: coords[coords.length - 1], nombre: "Llegada" },
        ]
      : [];
  return construirGpx({
    nombre: ruta.ref ? `${ruta.ref} · ${ruta.nombre}` : ruta.nombre,
    coords,
    perfil: ruta.perfil,
    puntos,
  });
}

export function planAGpx(plan: RutaPlaneada): string {
  const puntos = plan.puntos.map((coord, i) => ({
    coord,
    nombre:
      i === 0
        ? "Salida"
        : i === plan.puntos.length - 1
          ? "Llegada"
          : `Punto ${i + 1}`,
  }));
  return construirGpx({
    nombre: plan.nombre,
    coords: plan.linea,
    perfil: plan.perfil,
    puntos,
  });
}

/** Descarga un GPX como archivo (nombre saneado, extensión .gpx). */
export function descargarGpx(nombre: string, gpx: string): void {
  const limpio =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "ruta";
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${limpio}.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface GpxImportado {
  nombre: string;
  coords: [number, number][];
}

/** Lee la primera traza (o ruta) del GPX; null si no hay geometría válida. */
export function leerGpx(texto: string): GpxImportado | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(texto, "application/xml");
  } catch {
    return null;
  }
  if (doc.querySelector("parsererror")) return null;

  const leer = (selector: string): [number, number][] =>
    Array.from(doc.querySelectorAll(selector))
      .map((p) => {
        const lat = parseFloat(p.getAttribute("lat") ?? "");
        const lon = parseFloat(p.getAttribute("lon") ?? "");
        return [lon, lat] as [number, number];
      })
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

  // Preferimos la traza; si no hay, la ruta; si no, los waypoints sueltos
  let coords = leer("trkpt");
  if (coords.length < 2) coords = leer("rtept");
  if (coords.length < 2) coords = leer("wpt");
  if (coords.length < 2) return null;

  const nombre =
    doc.querySelector("trk > name")?.textContent?.trim() ||
    doc.querySelector("metadata > name")?.textContent?.trim() ||
    "Ruta importada";
  return { nombre, coords };
}
