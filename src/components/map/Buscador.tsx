import { useMemo, useRef, useState } from "react";
import type { ElementoGeografico } from "@/types/catalogo";
import type { Ruta } from "@/types/rutas";
import { elementosPorId } from "./elementos";
import { COLOR_TIPO } from "./marcadores";
import { COLOR_RED } from "./rutas";
import { IconoBuscar } from "@/components/icons";

export type ResultadoBusqueda =
  | { clase: "elemento"; elemento: ElementoGeografico }
  | { clase: "ruta"; ruta: Ruta };

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const MAX_RESULTADOS = 8;

/** Distancia de edici\u00f3n (Levenshtein) con corte: para en cuanto supera `max`. */
function distancia(a: string, b: string, max: number): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > max) return max + 1;
  let previa = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const fila = [i];
    let mejor = i;
    for (let j = 1; j <= n; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + coste);
      if (fila[j] < mejor) mejor = fila[j];
    }
    if (mejor > max) return max + 1;
    previa = fila;
  }
  return previa[n];
}

/**
 * Punt\u00faa una entrada frente a la consulta: prioriza el prefijo del nombre,
 * luego el prefijo de cualquier palabra, luego \u00abcontiene\u00bb, y por \u00faltimo
 * tolera erratas por distancia de edici\u00f3n contra el arranque de cada palabra.
 * Devuelve -1 si no hay coincidencia razonable.
 */
function puntuar(clave: string, palabras: string[], q: string): number {
  if (clave.startsWith(q)) return 100;
  if (palabras.some((p) => p.startsWith(q))) return 80;
  const dentro = clave.indexOf(q);
  if (dentro >= 0) return 60 - Math.min(dentro, 20) * 0.5;
  // Tolerancia a erratas solo con consultas de cierta longitud
  const maxDist = q.length >= 5 ? 2 : q.length >= 3 ? 1 : 0;
  if (maxDist === 0) return -1;
  let mejor = maxDist + 1;
  for (const p of palabras) {
    const prefijo = p.slice(0, Math.min(p.length, q.length + 1));
    const d = Math.min(
      distancia(q, prefijo, maxDist),
      distancia(q, p, maxDist),
    );
    if (d < mejor) mejor = d;
  }
  return mejor <= maxDist ? 40 - mejor * 8 : -1;
}

function palabrasDe(clave: string): string[] {
  return clave.split(/[^a-z0-9]+/).filter(Boolean);
}

/** Búsqueda por nombre sobre el catálogo y las rutas, con lista desplegable. */
export function Buscador({
  rutas,
  onElegir,
}: {
  rutas: Map<string, Ruta> | null;
  onElegir: (resultado: ResultadoBusqueda) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const indice = useMemo(() => {
    const entradas: {
      clave: string;
      palabras: string[];
      nombre: string;
      resultado: ResultadoBusqueda;
    }[] = [];
    for (const elemento of elementosPorId.values()) {
      const clave = normalizar(elemento.nombre);
      entradas.push({
        clave,
        palabras: palabrasDe(clave),
        nombre: elemento.nombre,
        resultado: { clase: "elemento", elemento },
      });
    }
    for (const ruta of rutas?.values() ?? []) {
      const clave = normalizar(`${ruta.ref ?? ""} ${ruta.nombre}`);
      entradas.push({
        clave,
        palabras: palabrasDe(clave),
        nombre: ruta.nombre,
        resultado: { clase: "ruta", ruta },
      });
    }
    return entradas;
  }, [rutas]);

  const resultados = useMemo(() => {
    const buscada = normalizar(consulta.trim());
    if (buscada.length < 2) return [];
    const puntuados: { puntos: number; nombre: string; resultado: ResultadoBusqueda }[] =
      [];
    for (const e of indice) {
      const puntos = puntuar(e.clave, e.palabras, buscada);
      if (puntos >= 0) puntuados.push({ puntos, nombre: e.nombre, resultado: e.resultado });
    }
    // Mayor puntuación primero; a igualdad, el nombre más corto (más ajustado)
    puntuados.sort(
      (a, b) => b.puntos - a.puntos || a.nombre.length - b.nombre.length,
    );
    return puntuados.slice(0, MAX_RESULTADOS).map((p) => p.resultado);
  }, [consulta, indice]);

  function elegir(resultado: ResultadoBusqueda) {
    onElegir(resultado);
    setConsulta("");
    setAbierto(false);
  }

  return (
    <div ref={contenedorRef} className="relative">
      <div className="flex items-center gap-2 rounded-full border border-roca-700 bg-roca-950/85 px-3 py-1.5">
        <span className="text-roca-300">
          <IconoBuscar width={14} height={14} />
        </span>
        <input
          type="search"
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && resultados[0]) elegir(resultados[0]);
            if (e.key === "Escape") setAbierto(false);
          }}
          placeholder="Buscar cima, ibón, ruta…"
          aria-label="Buscar en el catálogo"
          className="w-36 bg-transparent text-xs text-nieve placeholder:text-roca-500 focus:w-52 focus:outline-none transition-all [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
      {abierto && resultados.length > 0 && (
        <ul className="absolute left-0 top-full z-10 mt-1 w-72 overflow-hidden rounded-lg border border-roca-700 bg-roca-950/95 py-1 shadow-lg shadow-roca-950/60">
          {resultados.map((resultado) => {
            const esElemento = resultado.clase === "elemento";
            const nombre = esElemento
              ? resultado.elemento.nombre
              : resultado.ruta.nombre;
            const detalle = esElemento
              ? resultado.elemento.altitud !== null
                ? `${resultado.elemento.altitud.toLocaleString("es-ES")} m`
                : ""
              : `${(resultado.ruta.ref ?? resultado.ruta.red.toUpperCase())} · ${resultado.ruta.distanciaKm.toLocaleString("es-ES")} km`;
            const color = esElemento
              ? COLOR_TIPO[resultado.elemento.tipo as keyof typeof COLOR_TIPO]
              : COLOR_RED[resultado.ruta.red];
            return (
              <li key={esElemento ? resultado.elemento.id : resultado.ruta.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegir(resultado)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-roca-900"
                >
                  <span
                    aria-hidden="true"
                    className={
                      esElemento
                        ? "h-2.5 w-2.5 shrink-0 rounded-full border-2"
                        : "h-1 w-4 shrink-0 rounded-full"
                    }
                    style={
                      esElemento
                        ? { borderColor: color }
                        : { backgroundColor: color }
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-hielo-100">
                    {nombre}
                  </span>
                  <span className="shrink-0 text-[11px] text-roca-300">
                    {detalle}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
