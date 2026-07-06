import type { Ruta } from "@/types/rutas";
import { COLOR_RED, ETIQUETA_RED } from "./rutas";
import { IconoCerrar } from "@/components/icons";
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

export function FichaRuta({
  ruta,
  onCerrar,
}: {
  ruta: Ruta;
  onCerrar: () => void;
}) {
  const color = COLOR_RED[ruta.red];
  const enlaceOsm = `https://www.openstreetmap.org/relation/${ruta.fuente.osmId}`;

  return (
    <section
      aria-label={`Ficha de la ruta ${ruta.nombre}`}
      className="absolute left-4 top-33 w-88 max-w-[calc(100vw-2rem)] rounded-lg border border-roca-700 bg-roca-950/90 shadow-lg shadow-roca-950/60"
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
        <button
          type="button"
          aria-label="Cerrar ficha"
          onClick={onCerrar}
          className="-m-1 p-1 text-hielo-300 transition-colors hover:text-nieve"
        >
          <IconoCerrar width={18} height={18} />
        </button>
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

        <div className="mt-3">
          <PerfilElevacion perfil={ruta.perfil} />
        </div>

        <p className="mt-2 text-xs text-roca-300">
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
