import { useEffect, useState } from "react";
import {
  ETIQUETA_CIELO,
  pronostico,
  type DiaMeteo,
} from "@/lib/meteo";
import { IconoMeteo, IconoViento } from "@/components/icons";

function diaSemana(fecha: string, indice: number): string {
  if (indice === 0) return "Hoy";
  const d = new Date(`${fecha}T12:00:00`);
  const etiqueta = d.toLocaleDateString("es-ES", { weekday: "short" });
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1, 3);
}

/**
 * Previsión de 7 días para un punto (Open-Meteo). Tira de días seleccionable;
 * debajo, el detalle del día elegido con precipitación, viento y cota de nieve.
 */
export function Meteo({
  lat,
  lng,
  altitud,
}: {
  lat: number;
  lng: number;
  altitud: number | null;
}) {
  const [dias, setDias] = useState<DiaMeteo[] | null>(null);
  const [error, setError] = useState(false);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setDias(null);
    setError(false);
    setSel(0);
    pronostico(lat, lng, altitud)
      .then((d) => {
        if (!cancelado) setDias(d);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });
    return () => {
      cancelado = true;
    };
  }, [lat, lng, altitud]);

  if (error) {
    return (
      <p className="text-xs text-roca-300">No se pudo cargar la previsión.</p>
    );
  }
  if (!dias) {
    return <p className="text-xs text-roca-300">Cargando previsión…</p>;
  }

  const dia = dias[sel];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
          Previsión 7 días
        </p>
        <span className="text-[10px] text-roca-400">Open-Meteo</span>
      </div>

      <ul className="flex gap-1">
        {dias.map((d, i) => (
          <li key={d.fecha} className="flex-1">
            <button
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={`flex w-full flex-col items-center gap-0.5 rounded-md border px-0.5 py-1.5 transition-colors ${
                i === sel
                  ? "border-ocre-600 bg-ocre-600/15"
                  : "border-transparent hover:bg-roca-900"
              }`}
            >
              <span className="text-[10px] text-hielo-300">
                {diaSemana(d.fecha, i)}
              </span>
              <IconoMeteo
                estado={d.estado}
                width={22}
                height={22}
                className="text-hielo-100"
              />
              <span className="text-[11px] leading-none text-nieve">
                {d.tempMax}°
              </span>
              <span className="text-[10px] leading-none text-roca-300">
                {d.tempMin}°
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 rounded-md border border-roca-800 bg-roca-900/50 px-3 py-2">
        <p className="text-xs text-hielo-200">{ETIQUETA_CIELO[dia.estado]}</p>
        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1">
            <dt className="text-roca-300">Precip.</dt>
            <dd className="text-nieve">
              {dia.precipitacion > 0
                ? `${dia.precipitacion.toLocaleString("es-ES")} mm`
                : "—"}
              {dia.probLluvia != null && dia.probLluvia > 0
                ? ` · ${dia.probLluvia}%`
                : ""}
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="text-roca-300">
              <IconoViento width={13} height={13} />
            </dt>
            <dd className="text-nieve">{dia.viento} km/h</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="text-roca-300">Cota nieve</dt>
            <dd className="text-nieve">
              {dia.cotaNieve != null
                ? `${dia.cotaNieve.toLocaleString("es-ES")} m`
                : "—"}
            </dd>
          </div>
          {dia.nevada > 0 && (
            <div className="flex items-center gap-1">
              <dt className="text-roca-300">Nieve</dt>
              <dd className="text-nieve">
                {dia.nevada.toLocaleString("es-ES")} cm
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
