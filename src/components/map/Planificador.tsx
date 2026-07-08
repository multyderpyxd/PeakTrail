import { useRef, useState } from "react";
import type { MetricasLinea } from "@/lib/elevacion";
import { descargarGpx, planAGpx } from "@/lib/gpx";
import { formatearHoras, tiempoEstimadoHoras } from "@/lib/metricas-ruta";
import type { RutaPlaneada, Waypoint } from "@/types/plan";
import {
  IconoCerrar,
  IconoDescargar,
  IconoDeshacer,
  IconoImportar,
  IconoPapelera,
} from "@/components/icons";
import { PerfilElevacion } from "./PerfilElevacion";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
        {etiqueta}
      </dt>
      <dd className="font-display text-lg text-nieve">{valor}</dd>
    </div>
  );
}

function BotonSecundario({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-full border border-roca-700 px-2.5 py-1 text-[11px] text-hielo-300 transition-colors hover:text-nieve disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Chevron({ arriba }: { arriba: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {arriba ? <path d="M4 10l4-4 4 4" /> : <path d="M4 6l4 4 4 4" />}
    </svg>
  );
}

/** Fila de un punto de la ruta: orden, etiqueta salida/llegada y controles. */
function FilaPunto({
  indice,
  total,
  onSubir,
  onBajar,
  onEliminar,
}: {
  indice: number;
  total: number;
  onSubir: () => void;
  onBajar: () => void;
  onEliminar: () => void;
}) {
  const esInicio = indice === 0;
  const esFin = total > 1 && indice === total - 1;
  const fondo = esInicio ? "#7ba488" : esFin ? "#c99655" : "#16130f";
  const borde = esInicio ? "#7ba488" : "#c99655";
  const color = esInicio || esFin ? "#16130f" : "#f6f4ee";
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{ background: fondo, border: `2px solid ${borde}`, color }}
      >
        {indice + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-hielo-200">
        {esInicio ? "Salida" : esFin ? "Llegada" : `Punto ${indice + 1}`}
      </span>
      <button
        type="button"
        aria-label={`Subir punto ${indice + 1}`}
        onClick={onSubir}
        disabled={esInicio}
        className="p-0.5 text-roca-400 transition-colors hover:text-nieve disabled:opacity-25"
      >
        <Chevron arriba />
      </button>
      <button
        type="button"
        aria-label={`Bajar punto ${indice + 1}`}
        onClick={onBajar}
        disabled={indice === total - 1}
        className="p-0.5 text-roca-400 transition-colors hover:text-nieve disabled:opacity-25"
      >
        <Chevron arriba={false} />
      </button>
      <button
        type="button"
        aria-label={`Quitar punto ${indice + 1}`}
        onClick={onEliminar}
        className="p-0.5 text-roca-400 transition-colors hover:text-nieve"
      >
        <IconoPapelera width={13} height={13} />
      </button>
    </li>
  );
}

export function Planificador({
  waypoints,
  metricas,
  midiendo,
  enrutando,
  modoSenderos,
  onModoSenderos,
  onDeshacer,
  onLimpiar,
  onEliminar,
  onMover,
  onImportarGpx,
  onDescargarBorrador,
  onGuardar,
  guardando,
  firebaseListo,
  planes,
  planVisible,
  onVerPlan,
  onBorrarPlan,
  onCerrar,
}: {
  waypoints: Waypoint[];
  metricas: MetricasLinea | null;
  midiendo: boolean;
  enrutando: boolean;
  modoSenderos: boolean;
  onModoSenderos: (v: boolean) => void;
  onDeshacer: () => void;
  onLimpiar: () => void;
  onEliminar: (id: string) => void;
  onMover: (indice: number, direccion: -1 | 1) => void;
  onImportarGpx: (archivo: File) => void;
  onDescargarBorrador: (() => void) | null;
  onGuardar: (nombre: string) => void;
  guardando: boolean;
  firebaseListo: boolean;
  planes: RutaPlaneada[] | null;
  planVisible: RutaPlaneada | null;
  onVerPlan: (plan: RutaPlaneada | null) => void;
  onBorrarPlan: (id: string) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const inputGpx = useRef<HTMLInputElement>(null);
  const numPuntos = waypoints.length;
  const mostrada = planVisible
    ? {
        distanciaKm: planVisible.distanciaKm,
        desnivelPos: planVisible.desnivelPos,
        desnivelNeg: planVisible.desnivelNeg,
        altMin: planVisible.altMin,
        altMax: planVisible.altMax,
        perfil: planVisible.perfil,
      }
    : metricas;

  return (
    <section
      aria-label="Planificador de rutas"
      className="absolute left-4 top-33 max-h-[calc(100dvh-10rem)] w-88 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-roca-700 bg-roca-950/90 shadow-lg shadow-roca-950/60"
    >
      <header className="flex items-center gap-3 border-b border-roca-800 p-4">
        <h2 className="min-w-0 flex-1 font-display text-lg leading-tight text-nieve">
          {planVisible ? planVisible.nombre : "Planificar ruta"}
        </h2>
        {planVisible && (
          <BotonSecundario onClick={() => onVerPlan(null)}>
            Volver al borrador
          </BotonSecundario>
        )}
        <button
          type="button"
          aria-label="Cerrar planificador"
          onClick={onCerrar}
          className="-m-1 p-1 text-hielo-300 transition-colors hover:text-nieve"
        >
          <IconoCerrar width={18} height={18} />
        </button>
      </header>

      <div className="space-y-4 p-4">
        {!planVisible && (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-hielo-300">
                {numPuntos === 0
                  ? "Pulsa en el mapa para marcar la salida"
                  : `${numPuntos} ${numPuntos === 1 ? "punto" : "puntos"}${
                      enrutando ? " · buscando sendero…" : ""
                    }`}
              </p>
              <div
                className="flex overflow-hidden rounded-full border border-roca-700 text-[11px]"
                role="group"
                aria-label="Modo de trazado"
              >
                {(
                  [
                    [true, "Por senderos"],
                    [false, "Línea recta"],
                  ] as const
                ).map(([valor, etiqueta]) => (
                  <button
                    key={etiqueta}
                    type="button"
                    aria-pressed={modoSenderos === valor}
                    onClick={() => onModoSenderos(valor)}
                    className={`px-2.5 py-1 transition-colors ${
                      modoSenderos === valor
                        ? "bg-ocre-600 text-roca-950"
                        : "text-hielo-300 hover:text-nieve"
                    }`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={inputGpx}
                type="file"
                accept=".gpx,application/gpx+xml"
                className="hidden"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  if (archivo) onImportarGpx(archivo);
                  e.target.value = "";
                }}
              />
              <BotonSecundario onClick={() => inputGpx.current?.click()}>
                <IconoImportar width={13} height={13} />
                Importar GPX
              </BotonSecundario>
              {onDescargarBorrador && (
                <BotonSecundario onClick={onDescargarBorrador}>
                  <IconoDescargar width={13} height={13} />
                  Descargar GPX
                </BotonSecundario>
              )}
            </div>

            {numPuntos > 0 && (
              <>
                <ul className="space-y-1.5">
                  {waypoints.map((wp, i) => (
                    <FilaPunto
                      key={wp.id}
                      indice={i}
                      total={numPuntos}
                      onSubir={() => onMover(i, -1)}
                      onBajar={() => onMover(i, 1)}
                      onEliminar={() => onEliminar(wp.id)}
                    />
                  ))}
                </ul>
                <div className="flex gap-2">
                  <BotonSecundario onClick={onDeshacer}>
                    <IconoDeshacer width={13} height={13} />
                    Deshacer
                  </BotonSecundario>
                  <BotonSecundario onClick={onLimpiar}>
                    <IconoPapelera width={13} height={13} />
                    Limpiar
                  </BotonSecundario>
                </div>
                <p className="text-[11px] text-roca-400">
                  Arrastra los puntos sobre el mapa para reubicarlos; usa las
                  flechas para reordenarlos.
                </p>
              </>
            )}
          </>
        )}

        {mostrada && (
          <>
            <dl className="grid grid-cols-4 gap-2">
              <Dato
                etiqueta="Distancia"
                valor={`${mostrada.distanciaKm.toLocaleString("es-ES")} km`}
              />
              <Dato
                etiqueta="Subida"
                valor={`${mostrada.desnivelPos.toLocaleString("es-ES")} m`}
              />
              <Dato
                etiqueta="Bajada"
                valor={`${mostrada.desnivelNeg.toLocaleString("es-ES")} m`}
              />
              <Dato
                etiqueta="Tiempo est."
                valor={formatearHoras(tiempoEstimadoHoras(mostrada.perfil))}
              />
            </dl>
            <PerfilElevacion perfil={mostrada.perfil} />
          </>
        )}
        {planVisible && (
          <BotonSecundario
            onClick={() =>
              descargarGpx(planVisible.nombre, planAGpx(planVisible))
            }
          >
            <IconoDescargar width={13} height={13} />
            Descargar GPX
          </BotonSecundario>
        )}
        {midiendo && !planVisible && (
          <p className="text-xs text-roca-300">Midiendo el terreno…</p>
        )}

        {!planVisible && numPuntos >= 2 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre de la ruta"
              className="min-w-0 flex-1 rounded border border-roca-700 bg-roca-900/70 px-2.5 py-1.5 text-sm text-nieve placeholder:text-roca-500 focus:border-ocre-600 focus:outline-none"
            />
            <button
              type="button"
              disabled={!firebaseListo || guardando || !metricas}
              onClick={() => onGuardar(nombre.trim() || "Ruta propia")}
              className="rounded bg-ocre-600 px-3 py-1.5 text-sm text-roca-950 transition-colors hover:bg-ocre-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}
        {!firebaseListo && (
          <p className="text-xs text-roca-300">
            Configura Firebase (.env.local) para poder guardar rutas.
          </p>
        )}

        <div className="border-t border-roca-800 pt-3">
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
            Mis rutas guardadas
          </h3>
          {!planes && (
            <p className="mt-2 text-xs text-roca-300">
              {firebaseListo ? "Cargando…" : "Sin conexión con Firebase."}
            </p>
          )}
          {planes && planes.length === 0 && (
            <p className="mt-2 text-xs text-roca-300">Todavía no hay ninguna.</p>
          )}
          <ul className="mt-2 space-y-1">
            {planes?.map((plan) => (
              <li key={plan.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onVerPlan(planVisible?.id === plan.id ? null : plan)
                  }
                  aria-pressed={planVisible?.id === plan.id}
                  className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-sm transition-colors ${
                    planVisible?.id === plan.id
                      ? "bg-roca-800 text-nieve"
                      : "text-hielo-200 hover:bg-roca-900"
                  }`}
                >
                  {plan.nombre}
                  <span className="ml-2 text-xs text-roca-300">
                    {plan.distanciaKm.toLocaleString("es-ES")} km
                    {plan.nombreUsuario ? ` · ${plan.nombreUsuario}` : ""}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Borrar ${plan.nombre}`}
                  onClick={() => onBorrarPlan(plan.id)}
                  className="p-1 text-roca-400 transition-colors hover:text-nieve"
                >
                  <IconoPapelera width={14} height={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
