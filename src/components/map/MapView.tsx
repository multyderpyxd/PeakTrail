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
  IconoMas,
  IconoMenos,
  IconoPico,
  IconoRelieve,
  IconoToponimo,
} from "@/components/icons";

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
    });

    mapa.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
      "bottom-left",
    );

    mapa.on("load", () => setCargado(true));
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
      <div ref={contenedorRef} className="absolute inset-0" />

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
