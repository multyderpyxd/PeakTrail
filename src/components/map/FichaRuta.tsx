import { useMemo } from "react";
import type { Ruta } from "@/types/rutas";
import {
  APARTADOS_MIDE,
  formatearHoras,
  midePorRuta,
  tiempoEstimadoHoras,
} from "@/lib/metricas-ruta";
import type { Realizado } from "@/lib/realizados";
import { COLOR_RED, ETIQUETA_RED } from "./rutas";
import { IconoCerrar, IconoDescargar, IconoInvertir } from "@/components/icons";
import { descargarGpx, rutaCatalogoAGpx } from "@/lib/gpx";
import type { User } from "firebase/auth";
import { BotonCompartir } from "./BotonCompartir";
import { BotonDescargaOffline } from "./BotonDescargaOffline";
import { MarcarRealizado } from "./MarcarRealizado";
import { Meteo } from "./Meteo";
import { PerfilElevacion } from "./PerfilElevacion";
import { SeccionSocial } from "./SeccionSocial";

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

export function FichaRuta({
  ruta,
  invertida,
  onInvertir,
  onCerrar,
  onCursorPerfil,
  realizado,
  puedeMarcar,
  nombreGrupoActivo,
  onMarcar,
  onDesmarcar,
  usuario,
  grupoId,
}: {
  ruta: Ruta;
  invertida: boolean;
  onInvertir: () => void;
  onCerrar: () => void;
  onCursorPerfil?: (km: number | null) => void;
  realizado: Realizado | null;
  puedeMarcar: boolean;
  nombreGrupoActivo?: string | null;
  onMarcar: (fecha: string, notas: string, individual: boolean) => Promise<void>;
  onDesmarcar: () => Promise<void>;
  usuario: User | null;
  grupoId: string | null;
}) {
  const color = COLOR_RED[ruta.red];
  const enlaceOsm = `https://www.openstreetmap.org/relation/${ruta.fuente.osmId}`;
  const horas = useMemo(() => tiempoEstimadoHoras(ruta.perfil), [ruta]);
  const mide = useMemo(() => midePorRuta(ruta, horas), [ruta, horas]);
  // Punto medio del trazado para la previsión meteo, con la cota del perfil
  const medio = useMemo(() => {
    const puntos = ruta.partes.flat();
    const p = puntos[Math.floor(puntos.length / 2)];
    const perfilMedio = ruta.perfil[Math.floor(ruta.perfil.length / 2)];
    return p
      ? { lng: p[0], lat: p[1], altitud: perfilMedio?.[1] ?? null }
      : null;
  }, [ruta]);

  return (
    <section
      aria-label={`Ficha de la ruta ${ruta.nombre}`}
      className="absolute left-4 top-33 max-h-[calc(100dvh-10rem)] w-88 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-roca-700 bg-roca-950/90 shadow-lg shadow-roca-950/60"
    >
      <header className="flex items-start gap-3 border-b border-roca-800 p-4">
        <span
          className="mt-0.5 rounded px-2 py-1 font-display text-sm leading-none text-roca-950"
          style={{ backgroundColor: color }}
        >
          {ruta.ref ?? ETIQUETA_RED[ruta.red]}
        </span>
        <h2 className="min-w-0 flex-1 font-display text-lg leading-tight text-nieve">
          {ruta.nombre}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <BotonCompartir query={`ruta=${ruta.id}`} />
          <button
            type="button"
            aria-label="Cerrar ficha"
            onClick={onCerrar}
            className="-m-1 p-1 text-hielo-300 transition-colors hover:text-nieve"
          >
            <IconoCerrar width={18} height={18} />
          </button>
        </div>
      </header>

      <div className="p-4">
        <dl className="grid grid-cols-4 gap-2">
          <Dato
            etiqueta="Distancia"
            valor={`${ruta.distanciaKm.toLocaleString("es-ES")} km`}
          />
          <Dato
            etiqueta="Subida"
            valor={`${ruta.desnivelPos.toLocaleString("es-ES")} m`}
          />
          <Dato
            etiqueta="Bajada"
            valor={`${ruta.desnivelNeg.toLocaleString("es-ES")} m`}
          />
          <Dato
            etiqueta="Altitud"
            valor={`${ruta.altMin.toLocaleString("es-ES")}–${ruta.altMax.toLocaleString("es-ES")}`}
          />
        </dl>

        <div className="mt-3 flex items-end justify-between gap-2">
          <Dato etiqueta="Tiempo est." valor={formatearHoras(horas)} />
          <dl
            className="flex gap-1"
            aria-label="Valoración MIDE estimada"
            title={APARTADOS_MIDE.map(
              (a) => `${a.sigla}: ${a.nombre} — ${mide[a.clave]}/5`,
            ).join("\n")}
          >
            {APARTADOS_MIDE.map(({ clave, sigla, nombre }) => (
              <div
                key={clave}
                className="w-9 rounded border border-roca-700 bg-roca-900/70 py-1 text-center"
              >
                <dd className="font-display text-sm leading-none text-nieve">
                  {mide[clave]}
                </dd>
                <dt
                  aria-label={nombre}
                  className="mt-0.5 text-[9px] uppercase tracking-widest text-roca-300"
                >
                  {sigla}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
            Perfil de elevación
          </p>
          <button
            type="button"
            aria-pressed={invertida}
            onClick={onInvertir}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              invertida
                ? "border-ocre-600 bg-ocre-600/20 text-ocre-200"
                : "border-roca-700 text-hielo-300 hover:text-nieve"
            }`}
          >
            <IconoInvertir width={13} height={13} />
            Invertir sentido
          </button>
        </div>
        <div className="mt-1">
          <PerfilElevacion perfil={ruta.perfil} onPunto={onCursorPerfil} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              descargarGpx(
                ruta.ref ?? ruta.nombre,
                rutaCatalogoAGpx(ruta),
              )
            }
            className="flex items-center gap-1.5 rounded-full border border-roca-700 px-2.5 py-1 text-[11px] text-hielo-300 transition-colors hover:text-nieve"
          >
            <IconoDescargar width={13} height={13} />
            Descargar GPX
          </button>
          <BotonDescargaOffline
            id={`ruta:${ruta.id}`}
            nombre={ruta.ref ?? ruta.nombre}
            tipo="ruta"
            linea={ruta.partes.flat()}
          />
        </div>

        {medio && (
          <div className="mt-3 border-t border-roca-800 pt-3">
            <Meteo lat={medio.lat} lng={medio.lng} altitud={medio.altitud} />
          </div>
        )}

        <MarcarRealizado
          realizado={realizado}
          puedeMarcar={puedeMarcar}
          nombreGrupoActivo={nombreGrupoActivo}
          onMarcar={onMarcar}
          onDesmarcar={onDesmarcar}
        />
        <SeccionSocial
          grupoId={grupoId}
          refTipo="ruta"
          refId={ruta.id}
          usuario={usuario}
          puedeMarcar={puedeMarcar}
        />

        <p className="mt-2 text-xs text-roca-300">
          Tiempo de marcha por la función de Tobler y MIDE estimados
          automáticamente, según el sentido mostrado.
          <br />
          Trazado de{" "}
          <a
            href={enlaceOsm}
            target="_blank"
            rel="noreferrer"
            className="text-hielo-300 underline decoration-roca-500 underline-offset-2 hover:text-nieve"
          >
            OpenStreetMap
          </a>
          {" · "}elevación estimada del modelo del terreno
        </p>
      </div>
    </section>
  );
}
