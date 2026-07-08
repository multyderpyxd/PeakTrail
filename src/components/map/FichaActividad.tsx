import { useEffect, useMemo, useState } from "react";
import type { ActividadStrava } from "@/lib/strava";
import { decodificarPolilinea } from "@/lib/emparejar";
import { medirLinea, type MetricasLinea } from "@/lib/elevacion";
import { construirGpx, descargarGpx } from "@/lib/gpx";
import {
  IconoActividad,
  IconoCerrar,
  IconoDescargar,
} from "@/components/icons";
import { PerfilElevacion } from "./PerfilElevacion";
import { COLOR_ACTIVIDAD } from "./actividades-capa";
import { BotonDescargaOffline } from "./BotonDescargaOffline";

const ETIQUETA_DEPORTE: Record<string, string> = {
  Hike: "Senderismo",
  Walk: "Caminata",
  Run: "Carrera",
  TrailRun: "Trail",
  Snowshoe: "Raquetas",
  BackcountrySki: "Esquí de travesía",
  NordicSki: "Esquí nórdico",
  RockClimbing: "Escalada",
};

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

function formatearTiempo(segundos: number): string {
  const totalMin = Math.round(segundos / 60);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (!h) return `${min} min`;
  return min ? `${h} h ${min} min` : `${h} h`;
}

function formatearFecha(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Ficha de una actividad propia de Strava: datos del recorrido según el API
 * (distancia, tiempo en movimiento, desnivel, ritmo) y perfil de elevación
 * muestreado con nuestro modelo del terreno sobre la traza.
 */
export function FichaActividad({
  actividad,
  onCerrar,
  onCursorPerfil,
}: {
  actividad: ActividadStrava;
  onCerrar: () => void;
  /** Sincroniza el punto azul sobre la traza al recorrer el perfil. */
  onCursorPerfil?: (km: number | null) => void;
}) {
  const traza = useMemo(
    () =>
      actividad.polilinea ? decodificarPolilinea(actividad.polilinea) : [],
    [actividad],
  );
  const [metricas, setMetricas] = useState<MetricasLinea | null>(null);

  useEffect(() => {
    let cancelado = false;
    setMetricas(null);
    if (traza.length < 2) return;
    medirLinea(traza)
      .then((m) => {
        if (!cancelado) setMetricas(m);
      })
      .catch(() => {
        if (!cancelado) setMetricas(null);
      });
    return () => {
      cancelado = true;
    };
  }, [traza]);

  const ritmo =
    actividad.distanciaKm > 0 && actividad.tiempoMovS > 0
      ? formatearTiempo(actividad.tiempoMovS / actividad.distanciaKm) + "/km"
      : null;

  return (
    <section
      aria-label={`Ficha de la actividad ${actividad.nombre}`}
      className="absolute left-4 top-33 max-h-[calc(100dvh-10rem)] w-88 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-roca-700 bg-roca-950/90 shadow-lg shadow-roca-950/60"
    >
      <header className="flex items-start gap-3 border-b border-roca-800 p-4">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-nieve"
          style={{ borderColor: COLOR_ACTIVIDAD }}
        >
          <IconoActividad width={18} height={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: COLOR_ACTIVIDAD }}
          >
            Mi actividad
          </p>
          <h2 className="font-display text-lg leading-tight text-nieve">
            {actividad.nombre}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Cerrar ficha"
          onClick={onCerrar}
          className="-m-1 p-1 text-hielo-300 transition-colors hover:text-nieve"
        >
          <IconoCerrar width={18} height={18} />
        </button>
      </header>

      <div className="space-y-3 p-4">
        <p className="text-xs text-hielo-300">
          {formatearFecha(actividad.fecha)}
          {" · "}
          {ETIQUETA_DEPORTE[actividad.deporte] ?? actividad.deporte}
        </p>

        <dl className="grid grid-cols-4 gap-2">
          <Dato
            etiqueta="Distancia"
            valor={`${actividad.distanciaKm.toLocaleString("es-ES")} km`}
          />
          <Dato
            etiqueta="Tiempo mov."
            valor={formatearTiempo(actividad.tiempoMovS)}
          />
          <Dato
            etiqueta="Desnivel +"
            valor={`${actividad.desnivelM.toLocaleString("es-ES")} m`}
          />
          <Dato etiqueta="Ritmo" valor={ritmo ?? "—"} />
        </dl>

        {metricas ? (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-roca-300">
              Perfil de elevación
            </p>
            <PerfilElevacion perfil={metricas.perfil} onPunto={onCursorPerfil} />
          </div>
        ) : (
          traza.length >= 2 && (
            <p className="text-xs text-roca-300">Midiendo el terreno…</p>
          )
        )}

        <div className="flex flex-wrap items-center gap-2">
          {traza.length >= 2 && (
            <button
              type="button"
              onClick={() =>
                descargarGpx(
                  actividad.nombre,
                  construirGpx({
                    nombre: actividad.nombre,
                    coords: traza,
                    perfil: metricas?.perfil,
                  }),
                )
              }
              className="flex items-center gap-1.5 rounded-full border border-roca-700 px-2.5 py-1 text-[11px] text-hielo-300 transition-colors hover:text-nieve"
            >
              <IconoDescargar width={13} height={13} />
              Descargar GPX
            </button>
          )}
          {traza.length >= 2 && (
            <BotonDescargaOffline
              id={`actividad:${actividad.id}`}
              nombre={actividad.nombre}
              tipo="actividad"
              linea={traza}
            />
          )}
          <a
            href={`https://www.strava.com/activities/${actividad.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-hielo-300 underline decoration-roca-500 underline-offset-2 hover:text-nieve"
          >
            Ver en Strava
          </a>
        </div>

        <p className="text-xs text-roca-300">
          Distancia, tiempo y desnivel según Strava; el perfil se muestrea del
          modelo del terreno sobre la traza resumida.
        </p>
      </div>
    </section>
  );
}
