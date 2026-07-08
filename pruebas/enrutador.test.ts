import { afterEach, describe, expect, it, vi } from "vitest";
import {
  componerSegmento,
  distanciaMetros,
  enrutarSegmento,
  UMBRAL_SNAP_M,
} from "@/lib/enrutador";

// Punto base en el Pirineo y desplazamientos en metros aproximados
const BASE: [number, number] = [0.015, 42.6633];
function desplazado(m: number, rumbo: "N" | "E" = "N"): [number, number] {
  const dLat = m / 111320;
  const dLng = m / (111320 * Math.cos((BASE[1] * Math.PI) / 180));
  return rumbo === "N" ? [BASE[0], BASE[1] + dLat] : [BASE[0] + dLng, BASE[1]];
}

function respuestaBRouter(coords: number[][]) {
  return new Response(
    JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "LineString", coordinates: coords } },
      ],
    }),
    { status: 200 },
  );
}

function respuestaOsrm(coords: [number, number][]) {
  return new Response(
    JSON.stringify({ code: "Ok", routes: [{ geometry: { coordinates: coords } }] }),
    { status: 200 },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("distanciaMetros", () => {
  it("mide con precisión razonable", () => {
    expect(distanciaMetros(BASE, desplazado(1000))).toBeCloseTo(1000, -1);
    expect(distanciaMetros(BASE, BASE)).toBe(0);
  });
});

describe("componerSegmento (snap y conectores)", () => {
  const b = desplazado(2000);

  it("clic pegado al camino: el punto se adhiere (snap) y no hay conector", () => {
    const engancheA = desplazado(10, "E");
    const engancheB: [number, number] = [b[0] + 0.0001, b[1]];
    const red: [number, number][] = [engancheA, desplazado(1000), engancheB];
    const s = componerSegmento(BASE, b, red);
    expect(s.inicio).toEqual(engancheA);
    expect(s.fin).toEqual(engancheB);
    expect(s.coords).toEqual(red);
    expect(s.porSenderos).toBe(true);
  });

  it("clic lejos del camino: el punto se queda EXACTO donde se clicó, con conector recto", () => {
    const engancheA = desplazado(300, "E"); // a 300 m del clic (> umbral)
    const red: [number, number][] = [engancheA, desplazado(1000), b];
    const s = componerSegmento(BASE, b, red);
    expect(s.inicio).toEqual(BASE); // el clic, no el enganche
    expect(s.coords[0]).toEqual(BASE); // conector: la línea nace en el clic
    expect(s.coords[1]).toEqual(engancheA);
    expect(s.fin).toEqual(b);
  });

  it("umbral en el límite: por debajo pega, por encima conserva el clic", () => {
    const casi = desplazado(UMBRAL_SNAP_M - 5, "E");
    const pasado = desplazado(UMBRAL_SNAP_M + 5, "E");
    const red1: [number, number][] = [casi, b];
    const red2: [number, number][] = [pasado, b];
    expect(componerSegmento(BASE, b, red1).inicio).toEqual(casi);
    expect(componerSegmento(BASE, b, red2).inicio).toEqual(BASE);
  });

  it("la geometría siempre empieza en inicio y termina en fin (la línea llega al marcador)", () => {
    for (const distA of [5, 100]) {
      for (const distB of [5, 100]) {
        const red: [number, number][] = [
          desplazado(distA, "E"),
          desplazado(1000),
          [b[0], b[1] + distB / 111320],
        ];
        const s = componerSegmento(BASE, b, red);
        expect(s.coords[0]).toEqual(s.inicio);
        expect(s.coords[s.coords.length - 1]).toEqual(s.fin);
      }
    }
  });
});

describe("enrutarSegmento (cascada de motores)", () => {
  const a = BASE;
  const b = desplazado(2000);

  it("modo línea recta no llama a ningún servicio", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const s = await enrutarSegmento(a, b, false);
    expect(s).toEqual({ coords: [a, b], porSenderos: false, inicio: a, fin: b });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("BRouter responde: se usa su geometría (con elevación descartada)", async () => {
    const red = [
      [a[0], a[1], 2190.5],
      [0.02, 42.65, 2210],
      [b[0], b[1], 2230],
    ];
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("brouter.de");
      return respuestaBRouter(red);
    });
    vi.stubGlobal("fetch", fetchMock);
    const s = await enrutarSegmento(a, b, true);
    expect(s.porSenderos).toBe(true);
    expect(s.coords).toEqual(red.map((c) => [c[0], c[1]]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("BRouter falla: cae a OSRM", async () => {
    const redOsrm: [number, number][] = [a, [0.02, 42.65], b];
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("brouter.de")) {
        return new Response("operation killed", { status: 400 });
      }
      return respuestaOsrm(redOsrm);
    });
    vi.stubGlobal("fetch", fetchMock);
    const s = await enrutarSegmento(a, b, true);
    expect(s.porSenderos).toBe(true);
    expect(s.coords).toEqual(redOsrm);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("BRouter malformado (sin features) también cae a OSRM", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("brouter.de")) {
        return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
          status: 200,
        });
      }
      return respuestaOsrm([a, b]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const s = await enrutarSegmento(a, b, true);
    expect(s.porSenderos).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ambos motores caídos: degrada a línea recta conservando los clics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 503 })),
    );
    const s = await enrutarSegmento(a, b, true);
    expect(s).toEqual({ coords: [a, b], porSenderos: false, inicio: a, fin: b });
  });

  it("red que rechaza (sin conexión): degrada a recta sin lanzar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const s = await enrutarSegmento(a, b, true);
    expect(s.porSenderos).toBe(false);
    expect(s.coords).toEqual([a, b]);
  });
});
