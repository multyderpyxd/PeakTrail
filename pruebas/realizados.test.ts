import { describe, expect, it } from "vitest";
import { historialDe, vecesRealizado, type Realizado } from "@/lib/realizados";

function realizado(extra: Partial<Realizado> = {}): Realizado {
  return {
    id: "u1__g1__elemento__pico1",
    usuario: "u1",
    nombreUsuario: "Ana",
    grupoId: "g1",
    tipo: "elemento",
    refId: "pico1",
    nombre: "Pico de prueba",
    categoria: "pico",
    fecha: "2026-07-01",
    notas: "",
    ...extra,
  };
}

describe("historialDe", () => {
  it("documento antiguo sin historial: cae a una única entrada con fecha/notas de nivel superior", () => {
    const r = realizado({ fecha: "2026-03-10", notas: "primera vez" });
    expect(historialDe(r)).toEqual([{ fecha: "2026-03-10", notas: "primera vez" }]);
  });

  it("documento antiguo sin notas: la entrada usa cadena vacía", () => {
    const r = realizado({ notas: undefined });
    expect(historialDe(r)).toEqual([{ fecha: "2026-07-01", notas: "" }]);
  });

  it("usa el campo historial cuando existe, sin recalcularlo", () => {
    const r = realizado({
      fecha: "2026-06-01",
      historial: [
        { fecha: "2024-08-14", notas: "primera" },
        { fecha: "2026-06-01", notas: "repetida" },
      ],
    });
    expect(historialDe(r)).toEqual([
      { fecha: "2024-08-14", notas: "primera" },
      { fecha: "2026-06-01", notas: "repetida" },
    ]);
  });
});

describe("vecesRealizado", () => {
  it("1 para un documento sin historial", () => {
    expect(vecesRealizado(realizado())).toBe(1);
  });

  it("cuenta las entradas del historial", () => {
    const r = realizado({
      historial: [
        { fecha: "2024-08-14", notas: "" },
        { fecha: "2025-06-01", notas: "" },
        { fecha: "2026-06-01", notas: "" },
      ],
    });
    expect(vecesRealizado(r)).toBe(3);
  });
});
