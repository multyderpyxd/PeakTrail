"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { RedRuta, Ruta } from "@/types/rutas";
import { coleccionElementos, elementosPorId, TOTALES } from "./elementos";
import { cargarIconosMapa, COLOR_TIPO } from "./marcadores";
import {
  cargarRutas,
  coleccionRutas,
  COLOR_RED,
  ETIQUETA_RED,
  extremosRuta,
  invertirRuta,
  limitesRuta,
  puntoEnRuta,
} from "./rutas";
import { FichaElemento } from "./FichaElemento";
import { FichaRuta } from "./FichaRuta";

const CAPA_ELEMENTOS = "elementos";
const CAPA_RUTAS = "rutas";
const CAPA_RUTAS_CASCO = "rutas-casco";
const CAPA_RUTAS_PULSABLE = "rutas-pulsable";
const CAPA_RUTA_DESTACADA = "ruta-destacada";
const CAPA_RUTA_EXTREMOS = "ruta-extremos";
const CAPA_RUTA_CURSOR = "ruta-cursor";

const COLECCION_VACIA: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

type Seleccion =
  | { clase: "elemento"; elemento: ElementoGeografico }
  | { clase: "ruta"; ruta: Ruta };

const EXPRESION_COLOR_RED: maplibregl.ExpressionSpecification = [
  "match",
  ["get", "red"],
  "gr",
  COLOR_RED.gr,
  "pr",
  COLOR_RED.pr,
  "sl",
  COLOR_RED.sl,
  COLOR_RED.sl,
];

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
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [sentidoInvertido, setSentidoInvertido] = useState(false);
  const [tiposActivos, setTiposActivos] = useState<TipoElemento[]>([
    "pico",
    "ibon",
    "refugio",
  ]);
  const [redesActivas, setRedesActivas] = useState<RedRuta[]>([
    "gr",
    "pr",
    "sl",
  ]);
  const [totalesRutas, setTotalesRutas] = useState<Record<
    RedRuta,
    number
  > | null>(null);
  const rutasRef = useRef<Map<string, Ruta> | null>(null);

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

      // Rutas: líneas bajo los marcadores, con casco oscuro para que se lean
      // sobre la ortofoto y una capa ancha invisible que facilita el clic
      const rutas = await cargarRutas();
      rutasRef.current = rutas;
      mapa.addSource(CAPA_RUTAS, {
        type: "geojson",
        data: coleccionRutas(rutas.values()),
      });
      mapa.addLayer({
        id: CAPA_RUTAS_CASCO,
        type: "line",
        source: CAPA_RUTAS,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#16130f", "line-width": 4, "line-opacity": 0.55 },
      });
      mapa.addLayer({
        id: CAPA_RUTA_DESTACADA,
        type: "line",
        source: CAPA_RUTAS,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f6f4ee", "line-width": 7, "line-opacity": 0.6 },
        filter: ["==", ["get", "id"], ""],
      });
      mapa.addLayer({
        id: CAPA_RUTAS,
        type: "line",
        source: CAPA_RUTAS,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": EXPRESION_COLOR_RED, "line-width": 2.2 },
      });
      mapa.addLayer({
        id: CAPA_RUTAS_PULSABLE,
        type: "line",
        source: CAPA_RUTAS,
        paint: { "line-color": "#000000", "line-width": 14, "line-opacity": 0.01 },
      });

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

      // Señales de la ruta seleccionada: salida/llegada y cursor del perfil,
      // por encima de los marcadores del catálogo
      mapa.addSource(CAPA_RUTA_EXTREMOS, {
        type: "geojson",
        data: COLECCION_VACIA,
      });
      mapa.addLayer({
        id: CAPA_RUTA_EXTREMOS,
        type: "symbol",
        source: CAPA_RUTA_EXTREMOS,
        layout: {
          "icon-image": ["get", "rol"],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      mapa.addSource(CAPA_RUTA_CURSOR, {
        type: "geojson",
        data: COLECCION_VACIA,
      });
      mapa.addLayer({
        id: CAPA_RUTA_CURSOR,
        type: "symbol",
        source: CAPA_RUTA_CURSOR,
        layout: {
          "icon-image": "ruta-cursor",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      const totales: Record<RedRuta, number> = { gr: 0, pr: 0, sl: 0 };
      for (const ruta of rutas.values()) totales[ruta.red] += 1;
      setTotalesRutas(totales);
      setCargado(true);
    });

    mapa.on("click", (e) => {
      const capas = [CAPA_ELEMENTOS, CAPA_RUTAS_PULSABLE].filter((c) =>
        mapa.getLayer(c),
      );
      // queryRenderedFeatures devuelve primero lo pintado más arriba:
      // los marcadores tienen prioridad sobre las rutas
      const [pulsado] = mapa.queryRenderedFeatures(e.point, { layers: capas });
      setSentidoInvertido(false);
      if (!pulsado) {
        setSeleccion(null);
        return;
      }
      if (pulsado.layer.id === CAPA_ELEMENTOS) {
        const elemento = elementosPorId.get(String(pulsado.properties.id));
        if (!elemento) return;
        setSeleccion({ clase: "elemento", elemento });
        mapa.easeTo({ center: elemento.coordenadas, duration: 600 });
      } else {
        const ruta = rutasRef.current?.get(String(pulsado.properties.id));
        if (!ruta) return;
        setSeleccion({ clase: "ruta", ruta });
        mapa.fitBounds(limitesRuta(ruta), {
          padding: { top: 90, right: 90, bottom: 60, left: 400 },
          duration: 900,
        });
      }
    });
    for (const capa of [CAPA_ELEMENTOS, CAPA_RUTAS_PULSABLE]) {
      mapa.on("mouseenter", capa, () => {
        mapa.getCanvas().style.cursor = "pointer";
      });
      mapa.on("mouseleave", capa, () => {
        mapa.getCanvas().style.cursor = "";
      });
    }

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

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    const filtro: maplibregl.ExpressionSpecification = [
      "in",
      ["get", "red"],
      ["literal", redesActivas],
    ];
    for (const capa of [CAPA_RUTAS, CAPA_RUTAS_CASCO, CAPA_RUTAS_PULSABLE]) {
      mapa.setFilter(capa, filtro);
    }
  }, [redesActivas, cargado]);

  // Ruta tal y como se muestra: en su sentido original o invertida
  const rutaVista = useMemo(() => {
    if (seleccion?.clase !== "ruta") return null;
    return sentidoInvertido ? invertirRuta(seleccion.ruta) : seleccion.ruta;
  }, [seleccion, sentidoInvertido]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    mapa.setFilter(CAPA_RUTA_DESTACADA, ["==", ["get", "id"], rutaVista?.id ?? ""]);
    (mapa.getSource(CAPA_RUTA_EXTREMOS) as maplibregl.GeoJSONSource).setData(
      rutaVista ? extremosRuta(rutaVista) : COLECCION_VACIA,
    );
    (mapa.getSource(CAPA_RUTA_CURSOR) as maplibregl.GeoJSONSource).setData(
      COLECCION_VACIA,
    );
  }, [rutaVista, cargado]);

  function moverCursorPerfil(km: number | null) {
    const mapa = mapaRef.current;
    const ruta = rutaVista;
    if (!mapa || !cargado || !ruta) return;
    (mapa.getSource(CAPA_RUTA_CURSOR) as maplibregl.GeoJSONSource).setData(
      km === null
        ? COLECCION_VACIA
        : {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: puntoEnRuta(ruta, km) },
                properties: {},
              },
            ],
          },
    );
  }

  function alternarTipo(tipo: TipoElemento) {
    setTiposActivos((activos) => {
      const nuevos = activos.includes(tipo)
        ? activos.filter((t) => t !== tipo)
        : [...activos, tipo];
      setSeleccion((sel) =>
        sel?.clase === "elemento" && !nuevos.includes(sel.elemento.tipo)
          ? null
          : sel,
      );
      return nuevos;
    });
  }

  function alternarRed(red: RedRuta) {
    setRedesActivas((activas) => {
      const nuevas = activas.includes(red)
        ? activas.filter((r) => r !== red)
        : [...activas, red];
      setSeleccion((sel) =>
        sel?.clase === "ruta" && !nuevas.includes(sel.ruta.red) ? null : sel,
      );
      return nuevas;
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

      {/* Filtros por tipo y por red de senderos (también leyenda) */}
      <div className="absolute left-4 top-22 flex max-w-[calc(100vw-2rem)] flex-wrap gap-2">
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
        {totalesRutas &&
          (Object.keys(ETIQUETA_RED) as RedRuta[]).map((red) => {
            const activa = redesActivas.includes(red);
            return (
              <button
                key={red}
                type="button"
                aria-pressed={activa}
                onClick={() => alternarRed(red)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  activa
                    ? "border-roca-700 bg-roca-950/85 text-nieve"
                    : "border-roca-800 bg-roca-950/60 text-roca-500 hover:text-roca-300"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-1 w-4 rounded-full"
                  style={{
                    backgroundColor: activa ? COLOR_RED[red] : "#6e6353",
                  }}
                />
                {ETIQUETA_RED[red]}
                <span className={activa ? "text-hielo-300" : ""}>
                  {totalesRutas[red]}
                </span>
              </button>
            );
          })}
      </div>

      {/* Ficha de la selección */}
      {seleccion?.clase === "elemento" && (
        <FichaElemento
          elemento={seleccion.elemento}
          onCerrar={() => setSeleccion(null)}
        />
      )}
      {rutaVista && (
        <FichaRuta
          ruta={rutaVista}
          invertida={sentidoInvertido}
          onInvertir={() => setSentidoInvertido((v) => !v)}
          onCerrar={() => setSeleccion(null)}
          onCursorPerfil={moverCursorPerfil}
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
