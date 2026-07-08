import { useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { ElementoGeografico, TipoElemento } from "@/types/catalogo";
import type { Comunidad } from "@/types/catalogo";
import type { RedRuta, Ruta } from "@/types/rutas";
import { idRealizado, type Realizado } from "@/lib/realizados";
import type { ActividadStrava } from "@/lib/strava";
import { elementosPorId } from "./elementos";
import { COLOR_TIPO } from "./marcadores";
import { COLOR_RED } from "./rutas";
import { COLOR_ACTIVIDAD } from "./actividades-capa";
import type { ResultadoBusqueda } from "./Buscador";
import {
  IconoActividad,
  IconoCerrar,
  IconoCollado,
  IconoHecho,
  IconoIbon,
  IconoPico,
  IconoRefugio,
} from "@/components/icons";

/**
 * Explorador del catálogo: lista ordenable complementaria al mapa, por tipo
 * (más las rutas y las salidas de Strava), con filtro de texto, comunidad y
 * estado hecho/pendiente. Una fila lleva al elemento en el mapa y abre su
 * ficha.
 */

type Pestana = TipoElemento | "ruta" | "actividad";
type CampoOrden = "nombre" | "medida" | "hecho" | "fecha";

const PESTANAS: { clave: Pestana; etiqueta: string }[] = [
  { clave: "pico", etiqueta: "Picos" },
  { clave: "collado", etiqueta: "Collados" },
  { clave: "ibon", etiqueta: "Ibones" },
  { clave: "refugio", etiqueta: "Refugios" },
  { clave: "ruta", etiqueta: "Rutas" },
  { clave: "actividad", etiqueta: "Salidas" },
];

const ICONO_TIPO = {
  pico: IconoPico,
  ibon: IconoIbon,
  refugio: IconoRefugio,
  collado: IconoCollado,
} as const;

const COMUNIDADES: { clave: Comunidad | "todas"; etiqueta: string }[] = [
  { clave: "todas", etiqueta: "Todo el Pirineo" },
  { clave: "aragon", etiqueta: "Aragón" },
  { clave: "navarra", etiqueta: "Navarra" },
  { clave: "cataluna", etiqueta: "Cataluña" },
];

const PASO_LISTA = 150;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

interface FilaDatos {
  id: string;
  nombre: string;
  clave: string;
  /** Altitud (elementos) o distancia en km (rutas/salidas); null si no tiene. */
  medida: number | null;
  comunidad?: Comunidad;
  hecho: boolean;
  /** Catálogo y rutas navegan con onIr; las salidas con onVerActividad. */
  resultado?: ResultadoBusqueda;
  actividad?: ActividadStrava;
  red?: RedRuta;
  ref?: string | null;
  /** YYYY-MM-DD, solo en salidas de Strava. */
  fecha?: string;
}

export function Explorador({
  rutas,
  actividades,
  realizados,
  usuario,
  onIr,
  onVerActividad,
  onCerrar,
}: {
  rutas: Map<string, Ruta> | null;
  /** Salidas de Strava en caché; null si nunca se importaron. */
  actividades: ActividadStrava[] | null;
  realizados: Map<string, Realizado>;
  usuario: User | null;
  onIr: (resultado: ResultadoBusqueda) => void;
  onVerActividad: (actividad: ActividadStrava) => void;
  onCerrar: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>("pico");
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"todos" | "hechos" | "pendientes">(
    "todos",
  );
  const [comunidad, setComunidad] = useState<Comunidad | "todas">("todas");
  const [orden, setOrden] = useState<{ campo: CampoOrden; asc: boolean }>({
    campo: "medida",
    asc: false,
  });
  const [limite, setLimite] = useState(PASO_LISTA);

  const hechoPorMi = (tipo: Realizado["tipo"], refId: string) =>
    usuario ? realizados.has(idRealizado(usuario.uid, tipo, refId)) : false;

  // Filas de la pestaña activa, con todo lo necesario para filtrar y ordenar
  const filas = useMemo<FilaDatos[]>(() => {
    if (pestana === "actividad") {
      return (actividades ?? []).map((actividad) => ({
        id: String(actividad.id),
        nombre: actividad.nombre,
        clave: normalizar(actividad.nombre),
        medida: actividad.distanciaKm,
        hecho: true,
        actividad,
        fecha: actividad.fecha,
      }));
    }
    if (pestana === "ruta") {
      return Array.from(rutas?.values() ?? []).map((ruta) => ({
        id: ruta.id,
        nombre: ruta.nombre,
        clave: normalizar(`${ruta.ref ?? ""} ${ruta.nombre}`),
        medida: ruta.distanciaKm,
        comunidad: ruta.comunidad,
        hecho: hechoPorMi("ruta", ruta.id),
        resultado: { clase: "ruta", ruta },
        red: ruta.red,
        ref: ruta.ref,
      }));
    }
    const lista: FilaDatos[] = [];
    for (const el of elementosPorId.values()) {
      if (el.tipo !== pestana) continue;
      lista.push({
        id: el.id,
        nombre: el.nombre,
        clave: normalizar(el.nombre),
        medida: el.altitud,
        comunidad: el.comunidad,
        hecho: hechoPorMi("elemento", el.id),
        resultado: { clase: "elemento", elemento: el as ElementoGeografico },
      });
    }
    return lista;
    // realizados/usuario cambian el campo hecho; elementosPorId es estable tras cargar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestana, rutas, actividades, realizados, usuario]);

  const visibles = useMemo(() => {
    const buscado = normalizar(texto.trim());
    let resultado = filas;
    if (buscado.length > 0) {
      resultado = resultado.filter((f) => f.clave.includes(buscado));
    }
    if (comunidad !== "todas") {
      resultado = resultado.filter((f) => f.comunidad === comunidad);
    }
    if (estado !== "todos") {
      const quiereHecho = estado === "hechos";
      resultado = resultado.filter((f) => f.hecho === quiereHecho);
    }
    const factor = orden.asc ? 1 : -1;
    return [...resultado].sort((a, b) => {
      if (orden.campo === "nombre") {
        return factor * a.nombre.localeCompare(b.nombre, "es");
      }
      if (orden.campo === "fecha") {
        // YYYY-MM-DD ordena bien como texto
        return factor * (a.fecha ?? "").localeCompare(b.fecha ?? "");
      }
      if (orden.campo === "hecho") {
        if (a.hecho !== b.hecho) return factor * (a.hecho ? -1 : 1);
        return a.nombre.localeCompare(b.nombre, "es");
      }
      // medida: los que no tienen cota van al final en ambos sentidos
      if (a.medida === null && b.medida === null)
        return a.nombre.localeCompare(b.nombre, "es");
      if (a.medida === null) return 1;
      if (b.medida === null) return -1;
      return factor * (a.medida - b.medida);
    });
  }, [filas, texto, comunidad, estado, orden]);

  function elegirPestana(nueva: Pestana) {
    setPestana(nueva);
    setLimite(PASO_LISTA);
    // Orden natural de cada pestaña: cota descendente para el catálogo con
    // altitud, alfabético para rutas y más recientes primero para salidas
    setOrden(
      nueva === "ruta"
        ? { campo: "nombre", asc: true }
        : nueva === "actividad"
          ? { campo: "fecha", asc: false }
          : { campo: "medida", asc: false },
    );
  }

  function alternarOrden(campo: CampoOrden) {
    setOrden((previo) =>
      previo.campo === campo
        ? { campo, asc: !previo.asc }
        : { campo, asc: campo === "nombre" },
    );
  }

  function CabeceraOrden({
    campo,
    children,
    className = "",
  }: {
    campo: CampoOrden;
    children: React.ReactNode;
    className?: string;
  }) {
    const activa = orden.campo === campo;
    return (
      <button
        type="button"
        onClick={() => alternarOrden(campo)}
        className={`text-left text-[10px] uppercase tracking-[0.18em] transition-colors ${
          activa ? "text-ocre-200" : "text-roca-300 hover:text-hielo-300"
        } ${className}`}
      >
        {children}
        {activa && <span aria-hidden="true"> {orden.asc ? "↑" : "↓"}</span>}
      </button>
    );
  }

  const Icono =
    pestana !== "ruta" && pestana !== "actividad" ? ICONO_TIPO[pestana] : null;
  const esSalidas = pestana === "actividad";
  // La pestaña de salidas solo aparece con actividades importadas en caché
  const pestanasVisibles = PESTANAS.filter(
    ({ clave }) => clave !== "actividad" || actividades !== null,
  );

  return (
    <section
      aria-label="Explorador del catálogo"
      className="absolute left-4 top-33 flex max-h-[calc(100dvh-10rem)] w-104 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-roca-700 bg-roca-950/90 shadow-lg shadow-roca-950/60"
    >
      <header className="flex items-center gap-3 border-b border-roca-800 p-4 pb-3">
        <h2 className="min-w-0 flex-1 font-display text-lg leading-tight text-nieve">
          Explorador
        </h2>
        <button
          type="button"
          aria-label="Cerrar explorador"
          onClick={onCerrar}
          className="-m-1 p-1 text-hielo-300 transition-colors hover:text-nieve"
        >
          <IconoCerrar width={18} height={18} />
        </button>
      </header>

      <div className="space-y-2.5 border-b border-roca-800 p-4 py-3">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {pestanasVisibles.map(({ clave, etiqueta }) => (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={pestana === clave}
              onClick={() => elegirPestana(clave)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                pestana === clave
                  ? "border-ocre-600 bg-ocre-600/20 text-ocre-200"
                  : "border-roca-700 text-hielo-300 hover:text-nieve"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="search"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setLimite(PASO_LISTA);
            }}
            placeholder="Filtrar por nombre…"
            aria-label="Filtrar por nombre"
            className="min-w-0 flex-1 rounded border border-roca-700 bg-roca-900/70 px-2.5 py-1 text-xs text-nieve placeholder:text-roca-500 focus:border-ocre-600 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {!esSalidas && (
            <select
              value={comunidad}
              onChange={(e) => {
                setComunidad(e.target.value as Comunidad | "todas");
                setLimite(PASO_LISTA);
              }}
              aria-label="Filtrar por comunidad"
              className="rounded border border-roca-700 bg-roca-900/70 px-1.5 py-1 text-xs text-hielo-200 focus:border-ocre-600 focus:outline-none"
            >
              {COMUNIDADES.map(({ clave, etiqueta }) => (
                <option key={clave} value={clave}>
                  {etiqueta}
                </option>
              ))}
            </select>
          )}
        </div>

        {usuario && !esSalidas && (
          <div className="flex gap-1.5" role="group" aria-label="Filtrar por estado">
            {(
              [
                ["todos", "Todos"],
                ["hechos", "Hechos"],
                ["pendientes", "Pendientes"],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={estado === valor}
                onClick={() => {
                  setEstado(valor);
                  setLimite(PASO_LISTA);
                }}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                  estado === valor
                    ? "border-roca-500 bg-roca-800 text-nieve"
                    : "border-roca-700 text-roca-300 hover:text-nieve"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-roca-800 px-4 py-1.5">
        <CabeceraOrden campo="nombre" className="min-w-0 flex-1">
          Nombre
        </CabeceraOrden>
        <CabeceraOrden campo="medida" className="w-20 text-right">
          {pestana === "ruta" || esSalidas ? "Km" : "Altitud"}
        </CabeceraOrden>
        {esSalidas ? (
          <CabeceraOrden campo="fecha" className="w-20 text-right">
            Fecha
          </CabeceraOrden>
        ) : (
          usuario && (
            <CabeceraOrden campo="hecho" className="w-9 text-right">
              Hecho
            </CabeceraOrden>
          )
        )}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {visibles.slice(0, limite).map((fila) => (
          <li key={fila.id}>
            <button
              type="button"
              onClick={() => {
                if (fila.actividad) onVerActividad(fila.actividad);
                else if (fila.resultado) onIr(fila.resultado);
              }}
              className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-roca-900"
            >
              {fila.red ? (
                <span
                  className="w-12 shrink-0 rounded px-1 py-0.5 text-center font-display text-[10px] leading-none text-roca-950"
                  style={{ backgroundColor: COLOR_RED[fila.red] }}
                >
                  {fila.ref ?? fila.red.toUpperCase()}
                </span>
              ) : fila.actividad ? (
                <span className="shrink-0" style={{ color: COLOR_ACTIVIDAD }}>
                  <IconoActividad width={14} height={14} />
                </span>
              ) : (
                Icono && (
                  <span
                    className="shrink-0"
                    style={{ color: COLOR_TIPO[pestana as TipoElemento] }}
                  >
                    <Icono width={14} height={14} />
                  </span>
                )
              )}
              <span className="min-w-0 flex-1 truncate text-xs text-hielo-100">
                {fila.nombre}
              </span>
              <span className="w-20 shrink-0 text-right text-xs tabular-nums text-hielo-300">
                {fila.medida !== null
                  ? pestana === "ruta" || esSalidas
                    ? `${fila.medida.toLocaleString("es-ES")} km`
                    : `${fila.medida.toLocaleString("es-ES")} m`
                  : "—"}
              </span>
              {esSalidas ? (
                <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-roca-300">
                  {fila.fecha
                    ? new Date(`${fila.fecha}T12:00:00`).toLocaleDateString(
                        "es-ES",
                        { day: "2-digit", month: "2-digit", year: "2-digit" },
                      )
                    : "—"}
                </span>
              ) : (
                usuario && (
                  <span className="w-9 shrink-0 text-right">
                    {fila.hecho && (
                      <span className="inline-block text-pino-300">
                        <IconoHecho width={14} height={14} />
                      </span>
                    )}
                  </span>
                )
              )}
            </button>
          </li>
        ))}
        {visibles.length === 0 && (
          <li className="px-4 py-3 text-xs text-roca-300">
            Nada que mostrar con estos filtros.
          </li>
        )}
        {visibles.length > limite && (
          <li className="px-4 py-2">
            <button
              type="button"
              onClick={() => setLimite((v) => v + PASO_LISTA * 2)}
              className="w-full rounded border border-roca-700 px-2.5 py-1.5 text-xs text-hielo-300 transition-colors hover:text-nieve"
            >
              Mostrar más ({(visibles.length - limite).toLocaleString("es-ES")}{" "}
              restantes)
            </button>
          </li>
        )}
      </ul>

      <p className="border-t border-roca-800 px-4 py-2 text-[11px] text-roca-400">
        {visibles.length.toLocaleString("es-ES")}{" "}
        {visibles.length === 1 ? "resultado" : "resultados"}
      </p>
    </section>
  );
}
