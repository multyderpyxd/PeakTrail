import { describe, expect, it } from "vitest";
import {
  distanciaMetros,
  enrutarSegmento,
  FACTOR_RODEO_MAX,
  UMBRAL_SNAP_M,
} from "@/lib/enrutador";

/**
 * Pruebas contra los servicios reales (BRouter/OSRM). Se corren con
 * `npm run test:red`; en `npm test` se omiten para que la batería normal no
 * dependa de la red. Los casos reproducen los fallos reportados en el Hito 17:
 * puntos mal colocados alrededor del refugio de Góriz y clics fuera de senda
 * recolocados en otro lado.
 */

// Coordenadas reales del catálogo (public/catalogo.json)
const REFUGIO_GORIZ: [number, number] = [0.015003, 42.663278];
const PASO_GORIZ: [number, number] = [0.025654, 42.643048];
const COLLADO_SUP_GORIZ: [number, number] = [0.032364, 42.654327];
// Dos vértices del GR-11 (senda pirenaica) en Bustitza, de public/rutas.json
const GR11_A: [number, number] = [-1.71921, 43.13145];
const GR11_B: [number, number] = [-1.72543, 43.12932];

function longitudMetros(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += distanciaMetros(coords[i - 1], coords[i]);
  }
  return total;
}

function saltoMaximo(coords: [number, number][]): number {
  let max = 0;
  for (let i = 1; i < coords.length; i++) {
    max = Math.max(max, distanciaMetros(coords[i - 1], coords[i]));
  }
  return max;
}

describe.skipIf(!process.env.PROBAR_RED)("enrutado real (Pirineo)", () => {
  it("Góriz → Paso de Góriz: sigue la senda de montaña, no un camino remoto", async () => {
    const s = await enrutarSegmento(REFUGIO_GORIZ, PASO_GORIZ, true);
    expect(s.porSenderos).toBe(true);
    // El refugio está sobre la senda: snap fino, no a 1,5 km como hacía OSRM
    expect(distanciaMetros(REFUGIO_GORIZ, s.inicio)).toBeLessThan(UMBRAL_SNAP_M);
    // La ruta real por la senda ronda los 2,5 km (la recta son 2,4)
    const longitud = longitudMetros(s.coords);
    expect(longitud).toBeGreaterThan(2000);
    expect(longitud).toBeLessThan(5000);
    // La línea llega exactamente a los extremos visibles
    expect(s.coords[0]).toEqual(s.inicio);
    expect(s.coords[s.coords.length - 1]).toEqual(s.fin);
  });

  it("clic apartado de la senda: el punto se queda donde se clicó, con conector", async () => {
    // El Paso de Góriz está a ~350 m de la senda mapeada: caso conector
    const s = await enrutarSegmento(REFUGIO_GORIZ, PASO_GORIZ, true);
    const engancheFinal = s.coords[s.coords.length - 2];
    const distanciaEnganche = distanciaMetros(PASO_GORIZ, engancheFinal);
    if (distanciaEnganche > UMBRAL_SNAP_M) {
      // sin snap: el marcador debe quedarse EXACTAMENTE en el clic
      expect(s.fin).toEqual(PASO_GORIZ);
    } else {
      expect(distanciaMetros(PASO_GORIZ, s.fin)).toBeLessThanOrEqual(
        UMBRAL_SNAP_M,
      );
    }
  });

  it("clic claramente fuera de toda senda (300 m al este): queda exacto", async () => {
    const fuera: [number, number] = [
      PASO_GORIZ[0] + 300 / (111320 * Math.cos((PASO_GORIZ[1] * Math.PI) / 180)),
      PASO_GORIZ[1],
    ];
    const s = await enrutarSegmento(REFUGIO_GORIZ, fuera, true);
    if (s.porSenderos) {
      const enganche = s.coords[s.coords.length - 2];
      if (distanciaMetros(fuera, enganche) > UMBRAL_SNAP_M) {
        expect(s.fin).toEqual(fuera);
        expect(s.coords[s.coords.length - 1]).toEqual(fuera);
      }
    } else {
      expect(s.fin).toEqual(fuera);
    }
  });

  it("dos puntos sobre el GR-11: la ruta sigue la senda con enganches finos", async () => {
    const s = await enrutarSegmento(GR11_A, GR11_B, true);
    expect(s.porSenderos).toBe(true);
    expect(distanciaMetros(GR11_A, s.inicio)).toBeLessThan(UMBRAL_SNAP_M);
    expect(distanciaMetros(GR11_B, s.fin)).toBeLessThan(UMBRAL_SNAP_M);
    const recta = distanciaMetros(GR11_A, GR11_B);
    const longitud = longitudMetros(s.coords);
    // por senda: al menos la recta y sin desvíos disparatados
    expect(longitud).toBeGreaterThanOrEqual(recta * 0.95);
    expect(longitud).toBeLessThan(recta * 4);
  });

  it("Góriz → Collado Superior: continuidad sin saltos mayores que un conector", async () => {
    const s = await enrutarSegmento(REFUGIO_GORIZ, COLLADO_SUP_GORIZ, true);
    expect(s.porSenderos).toBe(true);
    // los vértices consecutivos de la senda están a decenas de metros; solo
    // un conector de extremo puede ser mayor, y nunca kilométrico
    expect(saltoMaximo(s.coords)).toBeLessThan(600);
  });

  it("segmento corto entre clics consecutivos (~300 m) responde y es coherente", async () => {
    const cerca: [number, number] = [0.018, 42.66];
    const s = await enrutarSegmento(REFUGIO_GORIZ, cerca, true);
    expect(s.coords.length).toBeGreaterThanOrEqual(2);
    expect(longitudMetros(s.coords)).toBeLessThan(3000);
  });

  it("puntos campo a través en la ladera de Góriz: nunca un rodeo absurdo (patrón peine)", async () => {
    // Caso real medido: dos sendas próximas que no conectan en el grafo OSM
    // hacían que 367 m directos se enrutasen con 4,6 km por el valle (12,6x)
    const A: [number, number] = [0.006, 42.6685];
    const B: [number, number] = [0.01, 42.67];
    const s = await enrutarSegmento(A, B, true);
    const directa = distanciaMetros(A, B);
    const total = longitudMetros(s.coords);
    if (s.porSenderos) {
      // si mantiene la senda, el rodeo debe ser razonable
      expect(total).toBeLessThanOrEqual(FACTOR_RODEO_MAX * directa * 1.05);
    } else {
      // degradado a recta: los puntos quedan exactamente donde se clicó
      expect(s.coords).toEqual([A, B]);
    }
  });
});
