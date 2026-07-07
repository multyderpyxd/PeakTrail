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
    const entradas: { clave: string; resultado: ResultadoBusqueda }[] = [];
    for (const elemento of elementosPorId.values()) {
      entradas.push({
        clave: normalizar(elemento.nombre),
        resultado: { clase: "elemento", elemento },
      });
    }
    for (const ruta of rutas?.values() ?? []) {
      entradas.push({
        clave: normalizar(`${ruta.ref ?? ""} ${ruta.nombre}`),
        resultado: { clase: "ruta", ruta },
      });
    }
    return entradas;
  }, [rutas]);

  const resultados = useMemo(() => {
    const buscada = normalizar(consulta.trim());
    if (buscada.length < 2) return [];
    return indice
      .filter((e) => e.clave.includes(buscada))
      .slice(0, MAX_RESULTADOS)
      .map((e) => e.resultado);
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
