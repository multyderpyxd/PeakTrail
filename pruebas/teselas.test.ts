import { describe, expect, it } from "vitest";
import { teselasDeCorredor, urlsParaDescarga } from "@/lib/teselas";

// Línea recta corta hacia el norte, en pleno Pirineo (~1,1 km).
const LINEA_RECTA: [number, number][] = [
  [0.03, 42.62],
  [0.03, 42.63],
];

// "Herradura" grande: sube, gira y baja, dejando un hueco interior amplio.
// El bbox que envuelve esta línea es mucho más grande que el corredor real
// (banda estrecha) que sigue el trazado.
const HERRADURA: [number, number][] = [
  [0.0, 42.0],
  [0.0, 42.5],
  [0.5, 42.5],
  [0.5, 42.0],
];

describe("teselasDeCorredor", () => {
  it("una línea recta produce un conjunto de teselas sin duplicados", () => {
    const teselas = teselasDeCorredor(LINEA_RECTA, [14]);
    expect(teselas.length).toBeGreaterThan(0);
    const claves = teselas.map((t) => `${t.z}/${t.x}/${t.y}`);
    expect(new Set(claves).size).toBe(claves.length);
    expect(teselas.every((t) => t.z === 14)).toBe(true);
  });

  it("varios zooms acumulan teselas de cada uno, no solo el último", () => {
    const unZoom = teselasDeCorredor(LINEA_RECTA, [14]);
    const dosZooms = teselasDeCorredor(LINEA_RECTA, [14, 15]);
    expect(dosZooms.length).toBeGreaterThan(unZoom.length);
    expect(dosZooms.some((t) => t.z === 14)).toBe(true);
    expect(dosZooms.some((t) => t.z === 15)).toBe(true);
  });

  it("una herradura no descarga el rectángulo completo que la envuelve", () => {
    const teselas = teselasDeCorredor(HERRADURA, [14]);
    const xs = teselas.map((t) => t.x);
    const ys = teselas.map((t) => t.y);
    const anchoBbox = (Math.max(...xs) - Math.min(...xs) + 1) *
      (Math.max(...ys) - Math.min(...ys) + 1);
    // El corredor real (banda estrecha siguiendo la herradura) debe pesar
    // muchísimo menos que el rectángulo que la circunscribe.
    expect(teselas.length).toBeLessThan(anchoBbox * 0.6);
  });

  it("línea vacía no lanza y no produce teselas", () => {
    expect(teselasDeCorredor([], [14])).toEqual([]);
  });
});

describe("urlsParaDescarga", () => {
  it("genera URLs de las tres fuentes (pnoa, topónimos, terreno)", () => {
    const urls = urlsParaDescarga(LINEA_RECTA);
    expect(urls.some((u) => u.includes("pnoa-ma"))).toBe(true);
    expect(urls.some((u) => u.includes("ign-base"))).toBe(true);
    expect(urls.some((u) => u.includes("elevation-tiles-prod"))).toBe(true);
    // Ni {z}/{x}/{y} sin rellenar, ni URLs repetidas.
    expect(urls.some((u) => u.includes("{z}"))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
