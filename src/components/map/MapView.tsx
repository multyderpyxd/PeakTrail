"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  CAPA_TOPONIMOS,
  estiloMapa,
  VISTA_INICIAL,
} from "./mapStyle";
import {
  IconoBrujula,
  IconoIbon,
  IconoMas,
  IconoMenos,
  IconoPico,
  IconoRefugio,
  IconoRelieve,
  IconoToponimo,
} from "@/components/icons";
import type { ElementoGeografico, TipoElemento } from "@/types/catalogo";
import { coleccionElementos, elementosPorId, TOTALES } from "./elementos";
import { cargarIconosMapa, COLOR_TIPO } from "./marcadores";
import { FichaElemento } from "./FichaElemento";

const CAPA_ELEMENTOS = "elementos";

const FILTROS: {
  tipo: keyof typeof COLOR_TIPO;
  etiqueta: string;
  Icono: typeof IconoPico;
}[] = [
  { tipo: "pico", etiqueta: "Tresmiles", Icono: IconoPico },
  { tipo: "ibon", etiqueta: "Ibones", Icono: IconoIbon },
  { tipo: "refugio", etiqueta: "Refugios", Icono: IconoRefugio },
];

function BotonMapa({
  etiqueta,
  activo = false,
  onClick,
  children,
}: {
  etiqueta: string;
  activo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center border-b border-roca-700 transition-colors last:border-b-0 ${
        activo
          ? "bg-ocre-600 text-roca-950 hover:bg-ocre-400"
          : "bg-roca-900/90 text-hielo-200 hover:bg-roca-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function MapView() {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<maplibregl.Map | null>(null);
  const [cargado, setCargado] = useState(false);
  const [rumbo, setRumbo] = useState(VISTA_INICIAL.bearing);
  const [inclinacion, setInclinacion] = useState(VISTA_INICIAL.pitch);
  const [toponimos, setToponimos] = useState(true);
  const [seleccionado, setSeleccionado] = useState<ElementoGeografico | null>(
    null,
  );
  const [tiposActivos, setTiposActivos] = useState<TipoElemento[]>([
    "pico",
    "ibon",
    "refugio",
  ]);

  useEffect(() => {
    if (!contenedorRef.current) return;

    const mapa = new maplibregl.Map({
      container: contenedorRef.current,
      style: estiloMapa,
      center: VISTA_INICIAL.center,
      zoom: VISTA_INICIAL.zoom,
      pitch: VISTA_INICIAL.pitch,
      bearing: VISTA_INICIAL.bearing,
      minZoom: 5.5,
      maxPitch: 80,
      attributionControl: { compact: false },
      // Opción del gestor de ratón ausente en MapOptions (de ahí el cast):
      // suaviza el giro con botón derecho (0.8 grados/píxel por defecto)
      rotateDegreesPerPixelMoved: 0.55,
    } as maplibregl.MapOptions & { rotateDegreesPerPixelMoved: number });

    mapa.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
      "bottom-left",
    );

    mapa.on("load", async () => {
      await cargarIconosMapa(mapa);
      mapa.addSource(CAPA_ELEMENTOS, {
        type: "geojson",
        data: coleccionElementos(),
      });
      mapa.addLayer({
        id: CAPA_ELEMENTOS,
        type: "symbol",
        source: CAPA_ELEMENTOS,
        layout: {
          "icon-image": ["concat", "marcador-", ["get", "tipo"]],
          "icon-padding": 1,
          // En colisiones ganan las cimas más altas
          "symbol-sort-key": ["-", 4000, ["coalesce", ["get", "altitud"], 0]],
        },
      });
      setCargado(true);
    });

    mapa.on("click", (e) => {
      const [marcador] = mapa.queryRenderedFeatures(e.point, {
        layers: mapa.getLayer(CAPA_ELEMENTOS) ? [CAPA_ELEMENTOS] : [],
      });
      const elemento = marcador
        ? elementosPorId.get(String(marcador.properties.id))
        : undefined;
      setSeleccionado(elemento ?? null);
      if (elemento) {
        mapa.easeTo({ center: elemento.coordenadas, duration: 600 });
      }
    });
    mapa.on("mouseenter", CAPA_ELEMENTOS, () => {
      mapa.getCanvas().style.cursor = "pointer";
    });
    mapa.on("mouseleave", CAPA_ELEMENTOS, () => {
      mapa.getCanvas().style.cursor = "";
    });

    mapa.on("move", () => {
      setRumbo(mapa.getBearing());
      setInclinacion(mapa.getPitch());
    });

    mapaRef.current = mapa;
    return () => {
      mapaRef.current = null;
      mapa.remove();
    };
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    mapa.setFilter(CAPA_ELEMENTOS, [
      "in",
      ["get", "tipo"],
      ["literal", tiposActivos],
    ]);
  }, [tiposActivos, cargado]);

  function alternarTipo(tipo: TipoElemento) {
    setTiposActivos((activos) => {
      const nuevos = activos.includes(tipo)
        ? activos.filter((t) => t !== tipo)
        : [...activos, tipo];
      setSeleccionado((sel) => (sel && !nuevos.includes(sel.tipo) ? null : sel));
      return nuevos;
    });
  }

  const en3D = inclinacion > 5;

  function alternarPitch() {
    mapaRef.current?.easeTo({
      pitch: en3D ? 0 : VISTA_INICIAL.pitch,
      duration: 900,
    });
  }

  function orientarNorte() {
    mapaRef.current?.easeTo({ bearing: 0, duration: 700 });
  }

  function alternarToponimos() {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const visibles = !toponimos;
    mapa.setLayoutProperty(
      CAPA_TOPONIMOS,
      "visibility",
      visibles ? "visible" : "none",
    );
    setToponimos(visibles);
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      {/* MapLibre impone position:relative al contenedor, así que la altura
          debe ser explícita: con absolute+inset colapsaría a 0 */}
      <div ref={contenedorRef} className="h-full w-full" />

      {/* Cabecera */}
      <header className="absolute left-4 top-4 flex items-center gap-3 rounded-lg border border-roca-700 bg-roca-950/85 px-4 py-3">
        <IconoPico width={28} height={28} className="text-ocre-400" />
        <div>
          <h1 className="font-display text-xl leading-none text-nieve">
            PeakTrail
          </h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-hielo-300">
            Pirineo aragonés
          </p>
        </div>
      </header>

      {/* Filtros por tipo (también leyenda) */}
      <div className="absolute left-4 top-22 flex gap-2">
        {FILTROS.map(({ tipo, etiqueta, Icono }) => {
          const activo = tiposActivos.includes(tipo);
          return (
            <button
              key={tipo}
              type="button"
              aria-pressed={activo}
              onClick={() => alternarTipo(tipo)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                activo
                  ? "border-roca-700 bg-roca-950/85 text-nieve"
                  : "border-roca-800 bg-roca-950/60 text-roca-500 hover:text-roca-300"
              }`}
            >
              <span style={activo ? { color: COLOR_TIPO[tipo] } : undefined}>
                <Icono width={15} height={15} />
              </span>
              {etiqueta}
              <span className={activo ? "text-hielo-300" : ""}>
                {TOTALES[tipo]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ficha del elemento seleccionado */}
      {seleccionado && (
        <FichaElemento
          elemento={seleccionado}
          onCerrar={() => setSeleccionado(null)}
        />
      )}

      {/* Controles de navegación */}
      <div className="absolute right-4 top-4 flex flex-col gap-3">
        <div className="flex flex-col overflow-hidden rounded-lg border border-roca-700 shadow-lg shadow-roca-950/60">
          <BotonMapa
            etiqueta="Acercar"
            onClick={() => mapaRef.current?.zoomIn()}
          >
            <IconoMas />
          </BotonMapa>
          <BotonMapa
            etiqueta="Alejar"
            onClick={() => mapaRef.current?.zoomOut()}
          >
            <IconoMenos />
          </BotonMapa>
        </div>

        <div className="flex flex-col overflow-hidden rounded-lg border border-roca-700 shadow-lg shadow-roca-950/60">
          <BotonMapa etiqueta="Orientar al norte" onClick={orientarNorte}>
            <IconoBrujula
              style={{ transform: `rotate(${-rumbo}deg)` }}
              className="transition-transform duration-150"
            />
          </BotonMapa>
          <BotonMapa
            etiqueta={en3D ? "Ver en planta (2D)" : "Ver relieve (3D)"}
            activo={en3D}
            onClick={alternarPitch}
          >
            <IconoRelieve />
          </BotonMapa>
          <BotonMapa
            etiqueta={toponimos ? "Ocultar topónimos" : "Mostrar topónimos"}
            activo={toponimos}
            onClick={alternarToponimos}
          >
            <IconoToponimo />
          </BotonMapa>
        </div>
      </div>

      {/* Ayuda de navegación */}
      <p className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-roca-700 bg-roca-950/80 px-4 py-1.5 text-xs text-hielo-300">
        Arrastra con el botón derecho (o Ctrl + arrastrar) para inclinar y
        rotar la vista
      </p>

      {/* Velo de carga */}
      {!cargado && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-roca-950">
          <IconoPico width={48} height={48} className="text-ocre-400" />
          <p className="text-sm tracking-wide text-hielo-300">
            Cargando el terreno del Pirineo…
          </p>
        </div>
      )}
    </main>
  );
}
