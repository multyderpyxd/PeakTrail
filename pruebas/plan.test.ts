import { describe, expect, it } from "vitest";
import type { SegmentoRuta } from "@/lib/enrutador";
import {
  claveSegmento,
  coserTrazado,
  indiceDeInsercion,
  nodosDelPlan,
} from "@/lib/plan";
import type { Waypoint } from "@/types/plan";

const wp = (lng: number, lat: number, id = `${lng},${lat}`): Waypoint => ({
  id,
  lngLat: [lng, lat],
});

const seg = (
  coords: [number, number][],
  porSenderos = true,
): SegmentoRuta => ({
  coords,
  porSenderos,
  inicio: coords[0],
  fin: coords[coords.length - 1],
});

describe("claveSegmento", () => {
  it("distingue modo y sentido", () => {
    const a: [number, number] = [0.1, 42.5];
    const b: [number, number] = [0.2, 42.6];
    expect(claveSegmento(true, a, b)).not.toBe(claveSegmento(false, a, b));
    expect(claveSegmento(true, a, b)).not.toBe(claveSegmento(true, b, a));
    expect(claveSegmento(true, a, b)).toBe(claveSegmento(true, [...a], [...b]));
  });

  it("redondea a 6 decimales (~10 cm) para que el arrastre fino no reviente la caché", () => {
    expect(claveSegmento(true, [0.1000000004, 42.5], [0.2, 42.6])).toBe(
      claveSegmento(true, [0.1, 42.5], [0.2, 42.6]),
    );
  });
});

describe("nodosDelPlan", () => {
  it("sin segmentos, cada punto queda donde se clicó", () => {
    const puntos = [wp(0.1, 42.5), wp(0.2, 42.6)];
    expect(nodosDelPlan(puntos, [])).toEqual([
      [0.1, 42.5],
      [0.2, 42.6],
    ]);
  });

  it("usa el extremo resuelto del segmento saliente, y el del entrante para el último", () => {
    const puntos = [wp(0.1, 42.5), wp(0.2, 42.6), wp(0.3, 42.7)];
    const segmentos = [
      seg([
        [0.1001, 42.5001], // inicio con snap (difiere del clic)
        [0.15, 42.55],
        [0.2001, 42.6001],
      ]),
      seg([
        [0.2001, 42.6001],
        [0.25, 42.65],
        [0.3, 42.7], // fin exacto en el clic (conector o coincidencia)
      ]),
    ];
    expect(nodosDelPlan(puntos, segmentos)).toEqual([
      [0.1001, 42.5001],
      [0.2001, 42.6001],
      [0.3, 42.7],
    ]);
  });

  it("mientras se recalcula (menos segmentos que huecos) no revienta", () => {
    const puntos = [wp(0.1, 42.5), wp(0.2, 42.6), wp(0.3, 42.7)];
    const segmentos = [
      seg([
        [0.1, 42.5],
        [0.2, 42.6],
      ]),
    ];
    const nodos = nodosDelPlan(puntos, segmentos);
    expect(nodos).toHaveLength(3);
    expect(nodos[2]).toEqual([0.3, 42.7]); // aún sin segmento: el clic
  });
});

describe("coserTrazado", () => {
  it("vacío sin segmentos", () => {
    expect(coserTrazado([])).toEqual([]);
  });

  it("concatena deduplicando el punto de unión compartido", () => {
    const linea = coserTrazado([
      seg([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
      seg([
        [2, 2],
        [3, 3],
      ]),
    ]);
    expect(linea).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it("si los extremos difieren (snap a caminos distintos) la línea sigue continua", () => {
    const linea = coserTrazado([
      seg([
        [0, 0],
        [2, 2.0001],
      ]),
      seg([
        [2, 2.0002],
        [3, 3],
      ]),
    ]);
    // ambos extremos presentes, sin huecos ni duplicados
    expect(linea).toEqual([
      [0, 0],
      [2, 2.0001],
      [2, 2.0002],
      [3, 3],
    ]);
  });

  it("el trazado siempre empieza y termina en los extremos visibles (los marcadores)", () => {
    const s1 = seg([
      [0.09, 42.49], // clic sin snap: conector ya incluido
      [0.1, 42.5],
      [0.2, 42.6],
    ]);
    const s2 = seg([
      [0.2, 42.6],
      [0.31, 42.71],
    ]);
    const linea = coserTrazado([s1, s2]);
    expect(linea[0]).toEqual(s1.inicio);
    expect(linea[linea.length - 1]).toEqual(s2.fin);
  });
});

describe("indiceDeInsercion", () => {
  const segmentos = [
    seg([
      [0, 42],
      [0.1, 42],
    ]),
    seg([
      [0.1, 42],
      [0.2, 42],
    ]),
    seg([
      [0.2, 42],
      [0.3, 42],
    ]),
  ];

  it("null sin segmentos", () => {
    expect(indiceDeInsercion([], [0, 42])).toBeNull();
  });

  it("clic cerca del primer tramo inserta entre los puntos 1 y 2", () => {
    expect(indiceDeInsercion(segmentos, [0.05, 42.001])).toBe(1);
  });

  it("clic cerca del tramo central inserta entre los puntos 2 y 3", () => {
    expect(indiceDeInsercion(segmentos, [0.15, 41.999])).toBe(2);
  });

  it("clic cerca del último tramo inserta antes del último punto", () => {
    expect(indiceDeInsercion(segmentos, [0.25, 42.001])).toBe(3);
  });
});
