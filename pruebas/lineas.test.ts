import { describe, expect, it } from "vitest";
import {
  extremosLinea,
  limitesLinea,
  puntoEnLinea,
} from "@/components/map/rutas";

// Línea recta hacia el norte de ~2,2 km (0.02° de latitud)
const LINEA: [number, number][] = [
  [0.01, 42.6],
  [0.01, 42.61],
  [0.01, 42.62],
];

describe("puntoEnLinea (cursor del perfil de planes y actividades)", () => {
  it("km 0 devuelve el inicio", () => {
    expect(puntoEnLinea(LINEA, 0)).toEqual([0.01, 42.6]);
  });

  it("recorre la línea proporcionalmente", () => {
    const [lng, lat] = puntoEnLinea(LINEA, 1.1); // mitad de ~2,2 km
    expect(lng).toBeCloseTo(0.01, 6);
    expect(lat).toBeGreaterThan(42.6045);
    expect(lat).toBeLessThan(42.6155);
  });

  it("más allá del final devuelve el último punto", () => {
    expect(puntoEnLinea(LINEA, 99)).toEqual([0.01, 42.62]);
  });

  it("km negativo no revienta: devuelve el inicio", () => {
    expect(puntoEnLinea(LINEA, -5)).toEqual([0.01, 42.6]);
  });
});

describe("extremosLinea (salida y llegada de planes y actividades)", () => {
  it("marca inicio y fin con los roles de icono", () => {
    const fc = extremosLinea(LINEA);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].properties?.rol).toBe("ruta-inicio");
    expect(fc.features[0].geometry.coordinates).toEqual([0.01, 42.6]);
    expect(fc.features[1].properties?.rol).toBe("ruta-fin");
    expect(fc.features[1].geometry.coordinates).toEqual([0.01, 42.62]);
  });

  it("línea degenerada: colección vacía", () => {
    expect(extremosLinea([[0.01, 42.6]]).features).toHaveLength(0);
    expect(extremosLinea([]).features).toHaveLength(0);
  });
});

describe("limitesLinea", () => {
  it("caja envolvente correcta", () => {
    expect(limitesLinea(LINEA)).toEqual([0.01, 42.6, 0.01, 42.62]);
  });
});
