import type { ElementoGeografico, TipoElemento } from "@/types/catalogo";
import type { Realizado } from "@/lib/realizados";
import type { User } from "firebase/auth";
import { BotonCompartir } from "./BotonCompartir";
import { COLOR_TIPO } from "./marcadores";
import { MarcarRealizado } from "./MarcarRealizado";
import { Meteo } from "./Meteo";
import { SeccionSocial } from "./SeccionSocial";
import { SeccionWikipedia } from "./SeccionWikipedia";
import {
  IconoCerrar,
  IconoCollado,
  IconoIbon,
  IconoPico,
  IconoRefugio,
} from "@/components/icons";

const ETIQUETA_TIPO: Record<TipoElemento, string> = {
  pico: "Pico",
  ibon: "Ibón",
  refugio: "Refugio",
  collado: "Collado",
};

const ICONO_TIPO = {
  pico: IconoPico,
  ibon: IconoIbon,
  refugio: IconoRefugio,
  collado: IconoCollado,
} as const;

function coordenadaLegible(valor: number, ejes: [string, string]) {
  return `${Math.abs(valor).toFixed(4)}° ${valor >= 0 ? ejes[0] : ejes[1]}`;
}

export function FichaElemento({
  elemento,
  onCerrar,
  realizado,
  puedeMarcar,
  onMarcar,
  onDesmarcar,
  usuario,
  grupoId,
}: {
  elemento: ElementoGeografico;
  onCerrar: () => void;
  realizado: Realizado | null;
  puedeMarcar: boolean;
  onMarcar: (fecha: string, notas: string) => Promise<void>;
  onDesmarcar: () => Promise<void>;
  usuario: User | null;
  grupoId: string | null;
}) {
  const color =
    COLOR_TIPO[elemento.tipo as keyof typeof COLOR_TIPO] ?? "#c99655";
  const Icono = ICONO_TIPO[elemento.tipo as keyof typeof ICONO_TIPO] ?? IconoPico;
  const { lng, lat } = elemento.coordenadas;
  const enlaceOsm =
    elemento.fuente.origen === "osm" && elemento.fuente.osmTipo
      ? `https://www.openstreetmap.org/${elemento.fuente.osmTipo}/${elemento.fuente.osmId}`
      : null;

  return (
    <section
      aria-label={`Ficha de ${elemento.nombre}`}
      className="absolute left-4 top-33 max-h-[calc(100dvh-10rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-roca-700 bg-roca-950/90 shadow-lg shadow-roca-950/60"
    >
      <header className="flex items-start gap-3 border-b border-roca-800 p-4">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-nieve"
          style={{ borderColor: color }}
        >
          <Icono width={18} height={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color }}
          >
            {ETIQUETA_TIPO[elemento.tipo]}
          </p>
          <h2 className="font-display text-lg leading-tight text-nieve">
            {elemento.nombre}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BotonCompartir query={`el=${elemento.id}`} />
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

      <div className="space-y-3 p-4">
        {elemento.altitud !== null && (
          <p className="font-display text-3xl text-nieve">
            {elemento.altitud.toLocaleString("es-ES")}
            <span className="ml-1 text-base text-hielo-300">m</span>
          </p>
        )}
        {elemento.descripcion && (
          <p className="text-sm leading-relaxed text-hielo-200">
            {elemento.descripcion}
          </p>
        )}
        <SeccionWikipedia wikidata={elemento.wikidata} />
        <p className="text-xs text-roca-300">
          {coordenadaLegible(lat, ["N", "S"])} · {coordenadaLegible(lng, ["E", "O"])}
          {enlaceOsm && (
            <>
              {" · "}
              <a
                href={enlaceOsm}
                target="_blank"
                rel="noreferrer"
                className="text-hielo-300 underline decoration-roca-500 underline-offset-2 hover:text-nieve"
              >
                Ver en OpenStreetMap
              </a>
            </>
          )}
        </p>
        <div className="border-t border-roca-800 pt-3">
          <Meteo lat={lat} lng={lng} altitud={elemento.altitud} />
        </div>
        <MarcarRealizado
          realizado={realizado}
          puedeMarcar={puedeMarcar}
          onMarcar={onMarcar}
          onDesmarcar={onDesmarcar}
        />
        <SeccionSocial
          grupoId={grupoId}
          refTipo="elemento"
          refId={elemento.id}
          usuario={usuario}
          puedeMarcar={puedeMarcar}
        />
      </div>
    </section>
  );
}
