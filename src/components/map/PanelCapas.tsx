import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { TipoElemento } from "@/types/catalogo";
import type { RedRuta } from "@/types/rutas";
import {
  IconoAmbiente,
  IconoCapas,
  IconoCollado,
  IconoIbon,
  IconoPico,
  IconoRefugio,
  IconoToponimo,
} from "@/components/icons";
import { COLOR_TIPO } from "./marcadores";
import { COLOR_RED, ETIQUETA_RED } from "./rutas";
import {
  type Ambiente,
  ETIQUETA_AMBIENTE,
  ORDEN_AMBIENTES,
} from "./mapStyle";

/**
 * Botón «Capas» con panel desplegable: agrupa los filtros del catálogo y de
 * las redes de senderos (que hacen de leyenda) y los ajustes de vista del
 * mapa (topónimos y ambiente), para dejar la superficie del mapa despejada.
 */

const FILTROS: {
  tipo: TipoElemento;
  etiqueta: string;
  Icono: typeof IconoPico;
}[] = [
  { tipo: "pico", etiqueta: "Picos", Icono: IconoPico },
  { tipo: "collado", etiqueta: "Collados", Icono: IconoCollado },
  { tipo: "ibon", etiqueta: "Ibones", Icono: IconoIbon },
  { tipo: "refugio", etiqueta: "Refugios", Icono: IconoRefugio },
];

function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-roca-300">
      {children}
    </p>
  );
}

function Fila({
  activo,
  onClick,
  icono,
  etiqueta,
  detalle,
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  etiqueta: string;
  detalle?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-roca-900 ${
        activo ? "text-nieve" : "text-roca-500"
      }`}
    >
      {icono}
      <span className="flex-1">{etiqueta}</span>
      {detalle !== undefined && (
        <span className={activo ? "text-hielo-300" : ""}>{detalle}</span>
      )}
    </button>
  );
}

export function PanelCapas({
  tiposActivos,
  onAlternarTipo,
  totalesTipos,
  altitudMinima,
  onAltitudMinima,
  alturasPicos,
  redesActivas,
  onAlternarRed,
  totalesRutas,
  toponimos,
  onAlternarToponimos,
  ambiente,
  onAmbiente,
}: {
  tiposActivos: TipoElemento[];
  onAlternarTipo: (tipo: TipoElemento) => void;
  totalesTipos: Record<TipoElemento, number> | null;
  altitudMinima: number;
  onAltitudMinima: (metros: number) => void;
  /** Cotas de todos los picos, ordenadas ascendentes (para el recuento). */
  alturasPicos: number[];
  redesActivas: RedRuta[];
  onAlternarRed: (red: RedRuta) => void;
  totalesRutas: Record<RedRuta, number> | null;
  toponimos: boolean;
  onAlternarToponimos: () => void;
  ambiente: Ambiente;
  onAmbiente: (ambiente: Ambiente) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);

  // Cuántos picos superan la cota elegida (las alturas vienen ordenadas)
  const picosVisibles = useMemo(() => {
    if (altitudMinima <= 0) return alturasPicos.length;
    let i = 0;
    while (i < alturasPicos.length && alturasPicos[i] < altitudMinima) i++;
    return alturasPicos.length - i;
  }, [alturasPicos, altitudMinima]);

  // Un clic fuera del panel (incluido el propio mapa) lo cierra
  useEffect(() => {
    if (!abierto) return;
    function alPulsarFuera(evento: MouseEvent) {
      if (!raizRef.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alPulsarFuera);
    return () => document.removeEventListener("mousedown", alPulsarFuera);
  }, [abierto]);

  const algoOculto =
    tiposActivos.length < FILTROS.length ||
    altitudMinima > 0 ||
    (totalesRutas !== null &&
      redesActivas.length < Object.keys(ETIQUETA_RED).length);

  return (
    <div ref={raizRef} className="relative">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
          abierto
            ? "border-roca-500 bg-roca-950/85 text-nieve"
            : "border-roca-700 bg-roca-950/85 text-hielo-200 hover:text-nieve"
        }`}
      >
        <IconoCapas width={15} height={15} />
        Capas y filtros
        {algoOculto && (
          <span
            aria-label="Hay capas ocultas"
            className="h-1.5 w-1.5 rounded-full bg-ocre-400"
          />
        )}
      </button>

      {abierto && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-roca-700 bg-roca-950/95 p-3 shadow-lg shadow-roca-950/60">
          <TituloSeccion>Catálogo</TituloSeccion>
          {FILTROS.map(({ tipo, etiqueta, Icono }) => {
            const activo = tiposActivos.includes(tipo);
            return (
              <Fragment key={tipo}>
                <Fila
                  activo={activo}
                  onClick={() => onAlternarTipo(tipo)}
                  etiqueta={etiqueta}
                  detalle={
                    totalesTipos ? String(totalesTipos[tipo]) : undefined
                  }
                  icono={
                    <span
                      style={activo ? { color: COLOR_TIPO[tipo] } : undefined}
                    >
                      <Icono width={15} height={15} />
                    </span>
                  }
                />
                {tipo === "pico" && (
                  <div className="mb-1 px-2 pb-1 pl-10">
                    <div className="flex items-baseline justify-between gap-2 text-[10px]">
                      <span className="uppercase tracking-[0.18em] text-roca-300">
                        Cota mínima
                      </span>
                      <span className="text-hielo-300">
                        {altitudMinima > 0
                          ? `desde ${altitudMinima.toLocaleString("es-ES")} m · ${picosVisibles}`
                          : "todos"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3000}
                      step={100}
                      value={altitudMinima}
                      disabled={!activo}
                      aria-label="Cota mínima de los picos mostrados"
                      onChange={(e) => onAltitudMinima(Number(e.target.value))}
                      className="mt-1 h-1 w-full accent-ocre-400 disabled:opacity-40"
                    />
                  </div>
                )}
              </Fragment>
            );
          })}

          {totalesRutas && (
            <>
              <div className="my-2 border-t border-roca-800" />
              <TituloSeccion>Senderos</TituloSeccion>
              {(Object.keys(ETIQUETA_RED) as RedRuta[]).map((red) => {
                const activa = redesActivas.includes(red);
                return (
                  <Fila
                    key={red}
                    activo={activa}
                    onClick={() => onAlternarRed(red)}
                    etiqueta={ETIQUETA_RED[red]}
                    detalle={String(totalesRutas[red])}
                    icono={
                      <span
                        aria-hidden="true"
                        className="h-1 w-4 rounded-full"
                        style={{
                          backgroundColor: activa ? COLOR_RED[red] : "#6e6353",
                        }}
                      />
                    }
                  />
                );
              })}
            </>
          )}

          <div className="my-2 border-t border-roca-800" />
          <TituloSeccion>Mapa</TituloSeccion>
          <Fila
            activo={toponimos}
            onClick={onAlternarToponimos}
            etiqueta="Topónimos"
            detalle={toponimos ? "Sí" : "No"}
            icono={<IconoToponimo width={15} height={15} />}
          />
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="text-hielo-200">
              <IconoAmbiente width={15} height={15} />
            </span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {ORDEN_AMBIENTES.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  aria-pressed={opcion === ambiente}
                  onClick={() => onAmbiente(opcion)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                    opcion === ambiente
                      ? "border-ocre-600 bg-ocre-600/20 text-ocre-200"
                      : "border-roca-700 text-roca-300 hover:text-nieve"
                  }`}
                >
                  {ETIQUETA_AMBIENTE[opcion]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
