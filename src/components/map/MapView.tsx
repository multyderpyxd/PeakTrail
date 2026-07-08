"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AMBIENTES,
  CAPA_TOPONIMOS,
  estiloMapa,
  VISTA_INICIAL,
  type Ambiente,
} from "./mapStyle";
import { Buscador, type ResultadoBusqueda } from "./Buscador";
import { PanelCapas } from "./PanelCapas";
import {
  IconoBrujula,
  IconoDescargaOffline,
  IconoLista,
  IconoMas,
  IconoMenos,
  IconoPico,
  IconoProgreso,
  IconoRelieve,
  IconoTrazar,
  IconoUsuario,
} from "@/components/icons";
import type { ElementoGeografico, TipoElemento } from "@/types/catalogo";
import type { RedRuta, Ruta } from "@/types/rutas";
import { cargarCatalogo, coleccionElementos, elementosPorId } from "./elementos";
import { cargarIconosMapa } from "./marcadores";
import {
  cargarRutas,
  coleccionRutas,
  COLOR_RED,
  extremosLinea,
  extremosRuta,
  invertirRuta,
  limitesLinea,
  limitesRuta,
  puntoEnLinea,
  puntoEnRuta,
} from "./rutas";
import { FichaElemento } from "./FichaElemento";
import { FichaRuta } from "./FichaRuta";
import { Planificador } from "./Planificador";
import { medirLinea, type MetricasLinea } from "@/lib/elevacion";
import { enrutarSegmento, type SegmentoRuta } from "@/lib/enrutador";
import { construirGpx, descargarGpx, leerGpx } from "@/lib/gpx";
import {
  claveSegmento,
  coserTrazado,
  indiceDeInsercion,
  nodosDelPlan,
} from "@/lib/plan";
import {
  borrarPlan,
  guardarPlan,
  isFirebaseConfigured,
  listarPlanes,
} from "@/lib/planes";
import type { RutaPlaneada, Waypoint } from "@/types/plan";
import { entrar, salir, useUsuario } from "@/lib/auth";
import {
  desmarcarRealizado,
  escucharRealizados,
  idRealizado,
  marcarRealizado,
  type Realizado,
} from "@/lib/realizados";
import { Explorador } from "./Explorador";
import { FichaActividad } from "./FichaActividad";
import { Progreso } from "./Progreso";
import { PanelDescargas } from "./PanelDescargas";
import {
  COLOR_ACTIVIDAD,
  coleccionActividades,
} from "./actividades-capa";
import { leerActividades } from "@/lib/actividades";
import { decodificarPolilinea } from "@/lib/emparejar";
import type { ActividadStrava } from "@/lib/strava";
import { procesarRetornoStrava } from "@/lib/strava";
import { guardarPreferencias, leerPreferencias } from "@/lib/preferencias";
import { useConexion } from "@/lib/conexion";

const CAPA_ELEMENTOS = "elementos";
const CAPA_RUTAS = "rutas";
const CAPA_RUTAS_CASCO = "rutas-casco";
const CAPA_RUTAS_PULSABLE = "rutas-pulsable";
const CAPA_RUTA_DESTACADA = "ruta-destacada";
const CAPA_RUTA_EXTREMOS = "ruta-extremos";
const CAPA_RUTA_CURSOR = "ruta-cursor";
const CAPA_ACTIVIDADES = "actividades";
const CAPA_ACTIVIDADES_CASCO = "actividades-casco";
const CAPA_ACTIVIDAD_DESTACADA = "actividad-destacada";
const CAPA_ACTIVIDADES_PULSABLE = "actividades-pulsable";
const CAPA_PLAN_LINEA = "plan-linea";
const CAPA_PLAN_PULSABLE = "plan-pulsable";
const CAPA_PLAN_PUNTOS = "plan-puntos";
const CAPA_DESTELLO = "elemento-destello";

const COLECCION_VACIA: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

type Seleccion =
  | { clase: "elemento"; elemento: ElementoGeografico }
  | { clase: "ruta"; ruta: Ruta }
  | { clase: "actividad"; actividad: ActividadStrava };

function crearWaypoint(lngLat: [number, number]): Waypoint {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `wp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, lngLat };
}

/**
 * Elemento DOM del marcador de un waypoint: insignia circular numerada con el
 * orden. La salida (1) va en pino y la llegada (N) en ocre; los intermedios en
 * oscuro con aro ocre. Estilos en línea con los hex de la paleta (los
 * marcadores DOM no pasan por el JIT de Tailwind).
 */
function elementoWaypoint(indice: number, total: number): HTMLDivElement {
  const esInicio = indice === 0;
  const esFin = total > 1 && indice === total - 1;
  const fondo = esInicio ? "#7ba488" : esFin ? "#c99655" : "#16130f";
  const borde = esInicio ? "#7ba488" : "#c99655";
  const color = esInicio || esFin ? "#16130f" : "#f6f4ee";
  const el = document.createElement("div");
  el.textContent = String(indice + 1);
  el.setAttribute(
    "aria-label",
    esInicio ? "Salida" : esFin ? "Llegada" : `Punto ${indice + 1}`,
  );
  el.style.cssText = [
    "width:22px",
    "height:22px",
    "border-radius:9999px",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font-family:Archivo,system-ui,sans-serif",
    "font-weight:600",
    "font-size:11px",
    "line-height:1",
    `color:${color}`,
    `background:${fondo}`,
    `border:2px solid ${borde}`,
    "box-shadow:0 1px 4px rgba(0,0,0,.55)",
    "cursor:grab",
  ].join(";");
  return el;
}

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
  const [ambiente, setAmbiente] = useState<Ambiente>("dia");
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [sentidoInvertido, setSentidoInvertido] = useState(false);

  // Estado del planificador de rutas propias
  const [modoPlan, setModoPlan] = useState(false);
  const modoPlanRef = useRef(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [segmentos, setSegmentos] = useState<SegmentoRuta[]>([]);
  const cacheSegmentos = useRef(new Map<string, SegmentoRuta>());
  // El manejador de clic del mapa se registra una sola vez: estos refs le dan
  // acceso a los segmentos y al plan visible frescos (mismo patrón que
  // modoPlanRef y destellarElementoRef)
  const segmentosRef = useRef<SegmentoRuta[]>([]);
  const planVisibleRef = useRef<RutaPlaneada | null>(null);
  const [modoSenderos, setModoSenderos] = useState(true);
  const [enrutando, setEnrutando] = useState(false);
  const [metricasPlan, setMetricasPlan] = useState<MetricasLinea | null>(null);
  const [midiendo, setMidiendo] = useState(false);
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [planes, setPlanes] = useState<RutaPlaneada[] | null>(null);
  const [planVisible, setPlanVisible] = useState<RutaPlaneada | null>(null);
  const marcadoresPlan = useRef<maplibregl.Marker[]>([]);

  // Sesión, registro de realizados del grupo y panel de progreso
  const sesion = useUsuario();
  const [realizados, setRealizados] = useState<Map<string, Realizado>>(
    new Map(),
  );
  const [verProgreso, setVerProgreso] = useState(false);
  const [verExplorador, setVerExplorador] = useState(false);
  const [verDescargas, setVerDescargas] = useState(false);
  const enLinea = useConexion();

  useEffect(() => {
    if (!sesion.invitado) {
      setRealizados(new Map());
      return;
    }
    return escucharRealizados(setRealizados);
  }, [sesion.invitado]);

  // Al volver del OAuth de Strava, guardar los tokens y abrir el progreso
  useEffect(() => {
    if (procesarRetornoStrava()) setVerProgreso(true);
  }, []);

  const puedeMarcar = Boolean(sesion.usuario && sesion.invitado);

  function realizadoDe(tipo: Realizado["tipo"], refId: string) {
    if (!sesion.usuario) return null;
    return realizados.get(idRealizado(sesion.usuario.uid, tipo, refId)) ?? null;
  }

  async function marcar(
    tipo: Realizado["tipo"],
    refId: string,
    nombre: string,
    categoria: string,
    fecha: string,
    notas: string,
  ) {
    if (!sesion.usuario) return;
    await marcarRealizado({
      usuario: sesion.usuario.uid,
      nombreUsuario:
        sesion.usuario.displayName ?? sesion.usuario.email ?? "Anónimo",
      tipo,
      refId,
      nombre,
      categoria,
      fecha,
      notas,
    });
  }
  const [tiposActivos, setTiposActivos] = useState<TipoElemento[]>([
    "pico",
    "ibon",
    "refugio",
    "collado",
  ]);
  const [redesActivas, setRedesActivas] = useState<RedRuta[]>([
    "gr",
    "pr",
    "sl",
  ]);
  // Solo se pintan los picos desde esta cota (los demás tipos no filtran)
  const [altitudMinima, setAltitudMinima] = useState(0);
  // Actividades de Strava del dispositivo (caché local) y su capa en el mapa
  const [actividades, setActividades] = useState<ActividadStrava[] | null>(
    null,
  );
  const [mostrarActividades, setMostrarActividades] = useState(false);
  const actividadesRef = useRef<Map<number, ActividadStrava>>(new Map());
  const [totalesTipos, setTotalesTipos] = useState<Record<
    TipoElemento,
    number
  > | null>(null);
  const [alturasPicos, setAlturasPicos] = useState<number[]>([]);
  const [totalesRutas, setTotalesRutas] = useState<Record<
    RedRuta,
    number
  > | null>(null);
  const rutasRef = useRef<Map<string, Ruta> | null>(null);

  // Preferencias de vista: se restauran tras montar (no en el render, para
  // no desajustar la hidratación) y se guardan en cada cambio
  useEffect(() => {
    const prefs = leerPreferencias();
    if (prefs.tiposActivos) setTiposActivos(prefs.tiposActivos);
    if (prefs.redesActivas) setRedesActivas(prefs.redesActivas);
    if (prefs.ambiente) setAmbiente(prefs.ambiente);
    if (prefs.toponimos !== undefined) setToponimos(prefs.toponimos);
    if (prefs.altitudMinima !== undefined) setAltitudMinima(prefs.altitudMinima);
    if (prefs.mostrarActividades !== undefined)
      setMostrarActividades(prefs.mostrarActividades);
    // La caché de actividades vive en localStorage: solo tras montar
    setActividades(leerActividades()?.actividades ?? null);
  }, []);

  useEffect(() => {
    guardarPreferencias({
      tiposActivos,
      redesActivas,
      ambiente,
      toponimos,
      altitudMinima,
      mostrarActividades,
    });
  }, [
    tiposActivos,
    redesActivas,
    ambiente,
    toponimos,
    altitudMinima,
    mostrarActividades,
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
      const [, rutas, catalogo] = await Promise.all([
        cargarIconosMapa(mapa),
        cargarRutas(),
        cargarCatalogo(),
      ]);

      // Rutas: líneas bajo los marcadores, con casco oscuro para que se lean
      // sobre la ortofoto y una capa ancha invisible que facilita el clic
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

      // Mis actividades de Strava: encima de las redes de senderos, debajo
      // de los marcadores; ocultas hasta que el usuario active la capa
      mapa.addSource(CAPA_ACTIVIDADES, {
        type: "geojson",
        data: COLECCION_VACIA,
      });
      mapa.addLayer({
        id: CAPA_ACTIVIDADES_CASCO,
        type: "line",
        source: CAPA_ACTIVIDADES,
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
        paint: { "line-color": "#16130f", "line-width": 4, "line-opacity": 0.55 },
      });
      mapa.addLayer({
        id: CAPA_ACTIVIDAD_DESTACADA,
        type: "line",
        source: CAPA_ACTIVIDADES,
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
        paint: { "line-color": "#f6f4ee", "line-width": 7, "line-opacity": 0.6 },
        filter: ["==", ["get", "id"], -1],
      });
      mapa.addLayer({
        id: CAPA_ACTIVIDADES,
        type: "line",
        source: CAPA_ACTIVIDADES,
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
        paint: { "line-color": COLOR_ACTIVIDAD, "line-width": 2.2 },
      });
      mapa.addLayer({
        id: CAPA_ACTIVIDADES_PULSABLE,
        type: "line",
        source: CAPA_ACTIVIDADES,
        layout: { visibility: "none" },
        paint: { "line-color": "#000000", "line-width": 14, "line-opacity": 0.01 },
      });

      mapa.addSource(CAPA_ELEMENTOS, {
        type: "geojson",
        data: coleccionElementos(catalogo.elementos),
      });
      setTotalesTipos(catalogo.totales);
      setAlturasPicos(
        catalogo.elementos
          .filter((el) => el.tipo === "pico" && el.altitud !== null)
          .map((el) => el.altitud as number)
          .sort((a, b) => a - b),
      );
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

      // Borrador del planificador: trazado ocre discontinuo y puntos marcados
      mapa.addSource(CAPA_PLAN_LINEA, { type: "geojson", data: COLECCION_VACIA });
      mapa.addLayer({
        id: `${CAPA_PLAN_LINEA}-casco`,
        type: "line",
        source: CAPA_PLAN_LINEA,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#16130f", "line-width": 5, "line-opacity": 0.6 },
      });
      mapa.addLayer({
        id: CAPA_PLAN_LINEA,
        type: "line",
        source: CAPA_PLAN_LINEA,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          // Ojo: line-dasharray + terreno 3D congela el renderizador de
          // MapLibre (comprobado empíricamente); la línea va sólida
          "line-color": "#c99655",
          "line-width": 3,
        },
      });
      // Franja invisible ancha sobre la línea del borrador: pulsar sobre ella
      // inserta un punto intermedio en vez de añadirlo al final
      mapa.addLayer({
        id: CAPA_PLAN_PULSABLE,
        type: "line",
        source: CAPA_PLAN_LINEA,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000000", "line-width": 18, "line-opacity": 0.01 },
      });
      mapa.addSource(CAPA_PLAN_PUNTOS, { type: "geojson", data: COLECCION_VACIA });
      mapa.addLayer({
        id: CAPA_PLAN_PUNTOS,
        type: "symbol",
        source: CAPA_PLAN_PUNTOS,
        layout: {
          "icon-image": ["coalesce", ["get", "icon"], "plan-punto"],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      // Destello del marcador al llegar desde el buscador
      mapa.addSource(CAPA_DESTELLO, { type: "geojson", data: COLECCION_VACIA });
      mapa.addLayer({
        id: CAPA_DESTELLO,
        type: "symbol",
        source: CAPA_DESTELLO,
        layout: {
          "icon-image": ["concat", "marcador-", ["get", "tipo"], "-destello"],
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
      cancelarDestelloRef.current();
      if (modoPlanRef.current) {
        const clic: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        // Pulsar sobre la línea del borrador inserta el punto entre los dos
        // waypoints de ese tramo (Komoot-style); en otro caso, se añade al final
        if (!planVisibleRef.current && mapa.getLayer(CAPA_PLAN_PULSABLE)) {
          const sobreLinea = mapa.queryRenderedFeatures(e.point, {
            layers: [CAPA_PLAN_PULSABLE],
          });
          if (sobreLinea.length > 0) {
            const indice = indiceDeInsercion(segmentosRef.current, clic);
            if (indice !== null) {
              setWaypoints((w) => [
                ...w.slice(0, indice),
                crearWaypoint(clic),
                ...w.slice(indice),
              ]);
              return;
            }
          }
        }
        setPlanVisible(null);
        setWaypoints((w) => [...w, crearWaypoint(clic)]);
        return;
      }
      const capas = [
        CAPA_ELEMENTOS,
        CAPA_ACTIVIDADES_PULSABLE,
        CAPA_RUTAS_PULSABLE,
      ].filter((c) => mapa.getLayer(c));
      // queryRenderedFeatures devuelve primero lo pintado más arriba:
      // marcadores sobre actividades, y actividades sobre rutas
      const [pulsado] = mapa.queryRenderedFeatures(e.point, { layers: capas });
      setSentidoInvertido(false);
      if (!pulsado) {
        setSeleccion(null);
        return;
      }
      setVerProgreso(false);
      setVerExplorador(false);
      setVerDescargas(false);
      if (pulsado.layer.id === CAPA_ELEMENTOS) {
        const elemento = elementosPorId.get(String(pulsado.properties.id));
        if (!elemento) return;
        setSeleccion({ clase: "elemento", elemento });
        mapa.easeTo({ center: elemento.coordenadas, duration: 600 });
        destellarElementoRef.current(elemento, 650);
      } else if (pulsado.layer.id === CAPA_ACTIVIDADES_PULSABLE) {
        const actividad = actividadesRef.current.get(
          Number(pulsado.properties.id),
        );
        if (!actividad) return;
        setSeleccion({ clase: "actividad", actividad });
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
    for (const capa of [
      CAPA_ELEMENTOS,
      CAPA_ACTIVIDADES_PULSABLE,
      CAPA_RUTAS_PULSABLE,
    ]) {
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
    if (process.env.NODE_ENV !== "production") {
      // Acceso al mapa desde la consola para depurar en desarrollo
      (window as unknown as { __mapa?: maplibregl.Map }).__mapa = mapa;
    }
    return () => {
      mapaRef.current = null;
      mapa.remove();
    };
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    mapa.setFilter(CAPA_ELEMENTOS, [
      "all",
      ["in", ["get", "tipo"], ["literal", tiposActivos]],
      // La cota mínima solo recorta picos; ibones, refugios y collados no
      [
        "any",
        ["!=", ["get", "tipo"], "pico"],
        [">=", ["coalesce", ["get", "altitud"], 0], altitudMinima],
      ],
    ]);
  }, [tiposActivos, altitudMinima, cargado]);

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

  // Capa «Mis actividades»: datos desde la caché local y visibilidad según
  // la preferencia; el índice por id resuelve el clic
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    actividadesRef.current = new Map(
      (actividades ?? []).map((a) => [a.id, a]),
    );
    (mapa.getSource(CAPA_ACTIVIDADES) as maplibregl.GeoJSONSource).setData(
      actividades ? coleccionActividades(actividades) : COLECCION_VACIA,
    );
    const visibilidad = mostrarActividades ? "visible" : "none";
    for (const capa of [
      CAPA_ACTIVIDADES,
      CAPA_ACTIVIDADES_CASCO,
      CAPA_ACTIVIDAD_DESTACADA,
      CAPA_ACTIVIDADES_PULSABLE,
    ]) {
      mapa.setLayoutProperty(capa, "visibility", visibilidad);
    }
    setSeleccion((sel) =>
      sel?.clase === "actividad" && !mostrarActividades ? null : sel,
    );
  }, [actividades, mostrarActividades, cargado]);

  // Planes propios marcados como realizados (p. ej. por el emparejado Strava)
  const planesHechos = useMemo(() => {
    const hechos = new Set<string>();
    if (!sesion.usuario) return hechos;
    for (const r of realizados.values()) {
      if (r.tipo === "plan" && r.usuario === sesion.usuario.uid) {
        hechos.add(r.refId);
      }
    }
    return hechos;
  }, [realizados, sesion.usuario]);

  // Ruta tal y como se muestra: en su sentido original o invertida
  const rutaVista = useMemo(() => {
    if (seleccion?.clase !== "ruta") return null;
    return sentidoInvertido ? invertirRuta(seleccion.ruta) : seleccion.ruta;
  }, [seleccion, sentidoInvertido]);

  // Traza decodificada de la actividad seleccionada (extremos y cursor)
  const trazaActividad = useMemo(() => {
    if (seleccion?.clase !== "actividad" || !seleccion.actividad.polilinea)
      return null;
    return decodificarPolilinea(seleccion.actividad.polilinea);
  }, [seleccion]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    mapa.setFilter(CAPA_RUTA_DESTACADA, ["==", ["get", "id"], rutaVista?.id ?? ""]);
    mapa.setFilter(CAPA_ACTIVIDAD_DESTACADA, [
      "==",
      ["get", "id"],
      seleccion?.clase === "actividad" ? seleccion.actividad.id : -1,
    ]);
    // Salida y llegada: de la ruta del catálogo o de la actividad seleccionada
    (mapa.getSource(CAPA_RUTA_EXTREMOS) as maplibregl.GeoJSONSource).setData(
      rutaVista
        ? extremosRuta(rutaVista)
        : trazaActividad
          ? extremosLinea(trazaActividad)
          : COLECCION_VACIA,
    );
    (mapa.getSource(CAPA_RUTA_CURSOR) as maplibregl.GeoJSONSource).setData(
      COLECCION_VACIA,
    );
  }, [rutaVista, trazaActividad, seleccion, cargado]);

  // --- Planificador ---

  // Recalcula los segmentos entre waypoints consecutivos. Los recalcula todos,
  // pero cachea por (modo, par de puntos): al añadir, mover o reordenar solo se
  // rehacen los segmentos afectados. Un token cancela los cálculos en vuelo.
  useEffect(() => {
    if (waypoints.length < 2) {
      setSegmentos([]);
      setEnrutando(false);
      return;
    }
    let cancelado = false;
    setEnrutando(true);
    (async () => {
      const cache = cacheSegmentos.current;
      const segs: SegmentoRuta[] = [];
      for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i].lngLat;
        const b = waypoints[i + 1].lngLat;
        const clave = claveSegmento(modoSenderos, a, b);
        let seg = cache.get(clave);
        if (!seg) {
          seg = await enrutarSegmento(a, b, modoSenderos);
          if (cancelado) return;
          cache.set(clave, seg);
        }
        segs.push(seg);
      }
      if (!cancelado) {
        setSegmentos(segs);
        setEnrutando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [waypoints, modoSenderos]);

  // Posición visible de cada waypoint y trazado cosido (lógica en lib/plan.ts,
  // probada aparte). Los segmentos ya traen resuelto snap/conector, así que la
  // línea llega siempre a los marcadores por construcción.
  segmentosRef.current = segmentos;
  planVisibleRef.current = planVisible;
  const nodosPlan = useMemo<[number, number][]>(
    () => nodosDelPlan(waypoints, segmentos),
    [waypoints, segmentos],
  );

  const trazadoPlan = useMemo<[number, number][]>(
    () => coserTrazado(segmentos),
    [segmentos],
  );

  // Métricas del borrador (elevación muestreada), con un pequeño debounce
  useEffect(() => {
    if (trazadoPlan.length < 2) {
      setMetricasPlan(null);
      return;
    }
    let cancelado = false;
    setMidiendo(true);
    const temporizador = setTimeout(async () => {
      try {
        const metricas = await medirLinea(trazadoPlan);
        if (!cancelado) setMetricasPlan(metricas);
      } catch {
        if (!cancelado) setMetricasPlan(null);
      } finally {
        if (!cancelado) setMidiendo(false);
      }
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [trazadoPlan]);

  // Pinta la línea (borrador o plan guardado). El plan guardado muestra además
  // sus puntos con salida/llegada; el borrador usa marcadores DOM arrastrables.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    const linea = planVisible ? planVisible.linea : trazadoPlan;
    (mapa.getSource(CAPA_PLAN_LINEA) as maplibregl.GeoJSONSource).setData(
      linea.length > 1
        ? {
            type: "Feature",
            geometry: { type: "LineString", coordinates: linea },
            properties: {},
          }
        : COLECCION_VACIA,
    );
    const puntos = planVisible?.puntos ?? [];
    (mapa.getSource(CAPA_PLAN_PUNTOS) as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: puntos.map((coord, i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: coord },
        properties: {
          icon:
            i === 0
              ? "ruta-inicio"
              : i === puntos.length - 1
                ? "ruta-fin"
                : undefined,
        },
      })),
    });
  }, [trazadoPlan, planVisible, cargado]);

  // Marcadores DOM del borrador: numerados, arrastrables, con salida y llegada
  // distinguidas por color. Se reconstruyen al cambiar los waypoints.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    for (const m of marcadoresPlan.current) m.remove();
    marcadoresPlan.current = [];
    if (!modoPlan || planVisible) return;
    const total = waypoints.length;
    waypoints.forEach((wp, i) => {
      const el = elementoWaypoint(i, total);
      const marcador = new maplibregl.Marker({
        element: el,
        draggable: true,
        anchor: "center",
      })
        // El marcador va sobre el nodo enganchado al sendero (donde acaba la
        // línea), no sobre el clic crudo, para que el punto y el trazado
        // coincidan aunque el clic caiga a un lado de la senda
        .setLngLat(nodosPlan[i] ?? wp.lngLat)
        .addTo(mapa);
      marcador.on("dragstart", () => {
        el.style.cursor = "grabbing";
      });
      marcador.on("dragend", () => {
        el.style.cursor = "grab";
        const { lng, lat } = marcador.getLngLat();
        setWaypoints((w) =>
          w.map((x) => (x.id === wp.id ? { ...x, lngLat: [lng, lat] } : x)),
        );
      });
      marcadoresPlan.current.push(marcador);
    });
    return () => {
      for (const m of marcadoresPlan.current) m.remove();
      marcadoresPlan.current = [];
    };
  }, [waypoints, nodosPlan, modoPlan, planVisible, cargado]);

  // Cursor de mira mientras se planifica
  useEffect(() => {
    modoPlanRef.current = modoPlan;
    const mapa = mapaRef.current;
    if (mapa) mapa.getCanvas().style.cursor = modoPlan ? "crosshair" : "";
  }, [modoPlan]);

  function alternarPlanificador() {
    const activar = !modoPlan;
    setModoPlan(activar);
    if (activar) {
      setSeleccion(null);
      setVerProgreso(false);
      setVerExplorador(false);
      setVerDescargas(false);
      if (isFirebaseConfigured && planes === null) {
        listarPlanes()
          .then(setPlanes)
          .catch(() => setPlanes([]));
      }
    } else {
      limpiarBorrador();
      setPlanVisible(null);
    }
  }

  function limpiarBorrador() {
    setWaypoints([]);
    setSegmentos([]);
    setMetricasPlan(null);
  }

  function deshacerPunto() {
    setWaypoints((w) => w.slice(0, -1));
  }

  function eliminarWaypoint(id: string) {
    setWaypoints((w) => w.filter((x) => x.id !== id));
  }

  function moverWaypoint(indice: number, direccion: -1 | 1) {
    setWaypoints((w) => {
      const destino = indice + direccion;
      if (destino < 0 || destino >= w.length) return w;
      const copia = [...w];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  // Exporta el borrador actual a GPX (trazado completo + salida/llegada)
  function descargarBorrador() {
    if (trazadoPlan.length < 2) return;
    const gpx = construirGpx({
      nombre: "Ruta propia",
      coords: trazadoPlan,
      perfil: metricasPlan?.perfil,
      puntos: nodosPlan.map((coord, i) => ({
        coord,
        nombre:
          i === 0
            ? "Salida"
            : i === nodosPlan.length - 1
              ? "Llegada"
              : `Punto ${i + 1}`,
      })),
    });
    descargarGpx("ruta-propia", gpx);
  }

  // Importa un GPX al planificador: la traza completa se conserva como el
  // segmento entre salida y llegada (se siembra la caché), así que solo hay dos
  // puntos editables pero el trazado queda idéntico al archivo.
  function importarGpx(archivo: File) {
    const lector = new FileReader();
    lector.onload = () => {
      const imp = leerGpx(String(lector.result));
      if (!imp || imp.coords.length < 2) return;
      const a = imp.coords[0];
      const b = imp.coords[imp.coords.length - 1];
      cacheSegmentos.current.set(claveSegmento(false, a, b), {
        coords: imp.coords,
        porSenderos: false,
        inicio: a,
        fin: b,
      });
      setModoSenderos(false);
      setPlanVisible(null);
      setWaypoints([crearWaypoint(a), crearWaypoint(b)]);
      let [oeste, sur, este, norte] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [lng, lat] of imp.coords) {
        oeste = Math.min(oeste, lng);
        este = Math.max(este, lng);
        sur = Math.min(sur, lat);
        norte = Math.max(norte, lat);
      }
      mapaRef.current?.fitBounds([oeste, sur, este, norte], {
        padding: { top: 90, right: 90, bottom: 60, left: 400 },
        duration: 900,
      });
    };
    lector.readAsText(archivo);
  }

  async function guardarBorrador(nombre: string) {
    if (!metricasPlan || trazadoPlan.length < 2) return;
    setGuardandoPlan(true);
    try {
      await guardarPlan({
        nombre,
        puntos: nodosPlan,
        linea: trazadoPlan,
        metricas: metricasPlan,
        autor: sesion.usuario
          ? {
              uid: sesion.usuario.uid,
              nombre:
                sesion.usuario.displayName ?? sesion.usuario.email ?? "Anónimo",
            }
          : null,
      });
      const lista = await listarPlanes();
      setPlanes(lista);
      const guardada = lista.find((p) => p.nombre === nombre) ?? null;
      setPlanVisible(guardada);
      if (guardada) limpiarBorrador();
    } finally {
      setGuardandoPlan(false);
    }
  }

  async function borrarPlanGuardado(id: string) {
    await borrarPlan(id);
    setPlanVisible((v) => (v?.id === id ? null : v));
    setPlanes((lista) => lista?.filter((p) => p.id !== id) ?? lista);
  }

  function verPlan(plan: RutaPlaneada | null) {
    setPlanVisible(plan);
    if (plan) {
      const mapa = mapaRef.current;
      let [oeste, sur, este, norte] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [lng, lat] of plan.linea) {
        oeste = Math.min(oeste, lng);
        este = Math.max(este, lng);
        sur = Math.min(sur, lat);
        norte = Math.max(norte, lat);
      }
      mapa?.fitBounds([oeste, sur, este, norte], {
        padding: { top: 90, right: 90, bottom: 60, left: 400 },
        duration: 900,
      });
    }
  }

  function pintarCursor(coordenadas: [number, number] | null) {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    (mapa.getSource(CAPA_RUTA_CURSOR) as maplibregl.GeoJSONSource).setData(
      coordenadas === null
        ? COLECCION_VACIA
        : {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: coordenadas },
                properties: {},
              },
            ],
          },
    );
  }

  function moverCursorPerfil(km: number | null) {
    const ruta = rutaVista;
    if (!ruta) return;
    pintarCursor(km === null ? null : puntoEnRuta(ruta, km));
  }

  // Cursor del perfil sobre la traza de la actividad de Strava seleccionada
  function moverCursorActividad(km: number | null) {
    if (!trazaActividad) return;
    pintarCursor(km === null ? null : puntoEnLinea(trazaActividad, km));
  }

  // Cursor del perfil sobre el plan guardado a la vista o el borrador
  function moverCursorPlan(km: number | null) {
    const linea = planVisible ? planVisible.linea : trazadoPlan;
    if (linea.length < 2) return;
    pintarCursor(km === null ? null : puntoEnLinea(linea, km));
  }

  // Abrir una actividad desde el explorador: la capa se enciende (si no, la
  // selección no sobreviviría al efecto que la limpia con la capa oculta)
  function verActividad(actividad: ActividadStrava) {
    setVerExplorador(false);
    setVerProgreso(false);
    setVerDescargas(false);
    if (modoPlan) alternarPlanificador();
    setSentidoInvertido(false);
    setMostrarActividades(true);
    setSeleccion({ clase: "actividad", actividad });
    if (actividad.polilinea) {
      mapaRef.current?.fitBounds(
        limitesLinea(decodificarPolilinea(actividad.polilinea)),
        { padding: { top: 90, right: 90, bottom: 60, left: 400 }, duration: 1200 },
      );
    }
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

  // Pulso del marcador encontrado: la variante rellena (fondo del color del
  // aro) se funde suavemente entrando y saliendo sobre la insignia normal,
  // de forma indefinida hasta que el usuario interactúa
  const PERIODO_DESTELLO_MS = 1200;
  const destelloArranque = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destelloIntervalo = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelarDestelloRef = useRef(() => {});

  function cancelarDestello() {
    if (destelloArranque.current) clearTimeout(destelloArranque.current);
    if (destelloIntervalo.current) clearInterval(destelloIntervalo.current);
    destelloArranque.current = null;
    destelloIntervalo.current = null;
    const fuente = mapaRef.current?.getSource(CAPA_DESTELLO) as
      | maplibregl.GeoJSONSource
      | undefined;
    fuente?.setData(COLECCION_VACIA);
  }
  cancelarDestelloRef.current = cancelarDestello;

  function destellarElemento(elemento: ElementoGeografico, retrasoMs = 1150) {
    cancelarDestello();
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    const fuente = mapa.getSource(CAPA_DESTELLO) as maplibregl.GeoJSONSource;
    const punto: GeoJSON.Feature = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [elemento.coordenadas.lng, elemento.coordenadas.lat],
      },
      properties: { tipo: elemento.tipo },
    };
    // el fundido lo hace MapLibre transicionando icon-opacity
    mapa.setPaintProperty(CAPA_DESTELLO, "icon-opacity-transition", {
      duration: PERIODO_DESTELLO_MS,
      delay: 0,
    });
    mapa.setPaintProperty(CAPA_DESTELLO, "icon-opacity", 0);
    // arranca cuando la cámara ya ha llegado
    destelloArranque.current = setTimeout(() => {
      fuente.setData(punto);
      let visible = true;
      mapa.setPaintProperty(CAPA_DESTELLO, "icon-opacity", 1);
      destelloIntervalo.current = setInterval(() => {
        visible = !visible;
        mapa.setPaintProperty(CAPA_DESTELLO, "icon-opacity", visible ? 1 : 0);
      }, PERIODO_DESTELLO_MS);
    }, retrasoMs);
  }
  // El manejador de clic del mapa se crea una sola vez: accede a la versión
  // fresca de la función a través de este ref
  const destellarElementoRef = useRef(destellarElemento);
  destellarElementoRef.current = destellarElemento;

  function irAResultado(resultado: ResultadoBusqueda) {
    const mapa = mapaRef.current;
    setVerProgreso(false);
    setVerExplorador(false);
    setVerDescargas(false);
    if (modoPlan) alternarPlanificador();
    setSentidoInvertido(false);
    if (resultado.clase === "elemento") {
      setSeleccion({ clase: "elemento", elemento: resultado.elemento });
      mapa?.easeTo({
        center: resultado.elemento.coordenadas,
        zoom: Math.max(mapa.getZoom(), 13),
        duration: 1200,
      });
      destellarElemento(resultado.elemento);
    } else {
      cancelarDestello();
      setSeleccion({ clase: "ruta", ruta: resultado.ruta });
      mapa?.fitBounds(limitesRuta(resultado.ruta), {
        padding: { top: 90, right: 90, bottom: 60, left: 400 },
        duration: 1200,
      });
    }
  }

  // El ambiente y los topónimos se aplican como efectos para que las
  // preferencias restauradas surtan efecto en cuanto el mapa carga
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    const preset = AMBIENTES[ambiente];
    mapa.setSky(preset.sky as Parameters<typeof mapa.setSky>[0]);
    for (const [propiedad, valor] of Object.entries(preset.sombreado)) {
      mapa.setPaintProperty("sombreado-relieve", propiedad, valor);
    }
    for (const [propiedad, valor] of Object.entries(preset.ortofoto)) {
      mapa.setPaintProperty("ortofoto", propiedad, valor);
    }
  }, [ambiente, cargado]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    mapa.setLayoutProperty(
      CAPA_TOPONIMOS,
      "visibility",
      toponimos ? "visible" : "none",
    );
  }, [toponimos, cargado]);

  // Enlaces directos: la URL refleja la ficha abierta (?el=… / ?ruta=…). Al
  // cargar se abre la que venga en la URL; después la URL sigue a la selección
  const deepLinkAplicado = useRef(false);
  useEffect(() => {
    if (!cargado) return;
    if (!deepLinkAplicado.current) {
      deepLinkAplicado.current = true;
      const params = new URLSearchParams(window.location.search);
      const elId = params.get("el");
      const rutaId = params.get("ruta");
      const elemento = elId ? elementosPorId.get(elId) : undefined;
      const ruta = rutaId ? rutasRef.current?.get(rutaId) : undefined;
      if (elemento) {
        irAResultado({ clase: "elemento", elemento });
        return;
      }
      if (ruta) {
        irAResultado({ clase: "ruta", ruta });
        return;
      }
    }
    const params = new URLSearchParams(window.location.search);
    params.delete("el");
    params.delete("ruta");
    if (seleccion?.clase === "elemento") params.set("el", seleccion.elemento.id);
    else if (seleccion?.clase === "ruta") params.set("ruta", seleccion.ruta.id);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
    // irAResultado es estable en la práctica; evitamos re-ejecutar por su identidad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado, seleccion]);

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
            Pirineo
          </p>
        </div>
        {!enLinea && (
          <span className="rounded-full border border-roca-700 px-2.5 py-1 text-[11px] text-roca-300">
            Sin conexión
          </span>
        )}
        {isFirebaseConfigured && !sesion.cargando && (
          <div className="ml-2 flex items-center gap-2 border-l border-roca-800 pl-3">
            {sesion.usuario ? (
              <>
                {sesion.usuario.photoURL ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={sesion.usuario.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-full border border-roca-700"
                  />
                ) : (
                  <span className="text-hielo-300">
                    <IconoUsuario width={18} height={18} />
                  </span>
                )}
                <div className="max-w-28">
                  <p className="truncate text-xs text-hielo-200">
                    {sesion.usuario.displayName ?? sesion.usuario.email}
                  </p>
                  {!sesion.invitado && (
                    <p className="text-[10px] text-ocre-400">Sin invitación</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={salir}
                  className="text-xs text-roca-300 underline decoration-roca-500 underline-offset-2 transition-colors hover:text-nieve"
                >
                  Salir
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => entrar().catch(() => {})}
                className="flex items-center gap-1.5 rounded-full border border-roca-700 px-3 py-1.5 text-xs text-hielo-200 transition-colors hover:border-roca-500 hover:text-nieve"
              >
                <IconoUsuario width={14} height={14} />
                Entrar
              </button>
            )}
          </div>
        )}
      </header>

      {/* Buscador y panel de capas y filtros (también leyenda) */}
      <div className="absolute left-4 top-22 z-10 flex max-w-[calc(100vw-2rem)] flex-wrap gap-2">
        <Buscador rutas={cargado ? rutasRef.current : null} onElegir={irAResultado} />
        <PanelCapas
          tiposActivos={tiposActivos}
          onAlternarTipo={alternarTipo}
          totalesTipos={totalesTipos}
          altitudMinima={altitudMinima}
          onAltitudMinima={setAltitudMinima}
          alturasPicos={alturasPicos}
          redesActivas={redesActivas}
          onAlternarRed={alternarRed}
          totalesRutas={totalesRutas}
          numActividades={actividades?.length ?? null}
          mostrarActividades={mostrarActividades}
          onAlternarActividades={() => setMostrarActividades((v) => !v)}
          toponimos={toponimos}
          onAlternarToponimos={() => setToponimos((v) => !v)}
          ambiente={ambiente}
          onAmbiente={setAmbiente}
        />
      </div>

      {/* Planificador de rutas propias */}
      {modoPlan && (
        <Planificador
          waypoints={waypoints}
          metricas={metricasPlan}
          midiendo={midiendo}
          enrutando={enrutando}
          modoSenderos={modoSenderos}
          onModoSenderos={setModoSenderos}
          onDeshacer={deshacerPunto}
          onLimpiar={limpiarBorrador}
          onEliminar={eliminarWaypoint}
          onMover={moverWaypoint}
          onImportarGpx={importarGpx}
          onDescargarBorrador={
            trazadoPlan.length >= 2 ? descargarBorrador : null
          }
          onGuardar={guardarBorrador}
          guardando={guardandoPlan}
          firebaseListo={isFirebaseConfigured}
          planes={planes}
          planesHechos={planesHechos}
          planVisible={planVisible}
          onVerPlan={verPlan}
          onBorrarPlan={borrarPlanGuardado}
          onCursorPerfil={moverCursorPlan}
          onCerrar={alternarPlanificador}
        />
      )}

      {/* Panel de progreso */}
      {verProgreso && (
        <Progreso
          realizados={realizados}
          usuario={sesion.usuario}
          esInvitado={sesion.invitado}
          esAdmin={sesion.admin}
          rutas={rutasRef.current}
          totalRutas={rutasRef.current?.size ?? 0}
          onCerrar={() => setVerProgreso(false)}
          onActividades={(todas) =>
            setActividades(todas.length > 0 ? todas : null)
          }
        />
      )}

      {/* Explorador del catálogo */}
      {verExplorador && (
        <Explorador
          rutas={cargado ? rutasRef.current : null}
          actividades={actividades}
          realizados={realizados}
          usuario={sesion.usuario}
          onIr={irAResultado}
          onVerActividad={verActividad}
          onCerrar={() => setVerExplorador(false)}
        />
      )}

      {/* Panel de descargas para sin cobertura */}
      {verDescargas && (
        <PanelDescargas onCerrar={() => setVerDescargas(false)} />
      )}

      {/* Ficha de la selección */}
      {!modoPlan && seleccion?.clase === "elemento" && (
        <FichaElemento
          elemento={seleccion.elemento}
          onCerrar={() => {
            cancelarDestello();
            setSeleccion(null);
          }}
          realizado={realizadoDe("elemento", seleccion.elemento.id)}
          puedeMarcar={puedeMarcar}
          onMarcar={(fecha, notas) => {
            const el = seleccion.elemento;
            return marcar("elemento", el.id, el.nombre, el.tipo, fecha, notas);
          }}
          onDesmarcar={async () => {
            const r = realizadoDe("elemento", seleccion.elemento.id);
            if (r) await desmarcarRealizado(r.id);
          }}
          usuario={sesion.usuario}
          esInvitado={sesion.invitado}
        />
      )}
      {!modoPlan && seleccion?.clase === "actividad" && (
        <FichaActividad
          actividad={seleccion.actividad}
          onCerrar={() => setSeleccion(null)}
          onCursorPerfil={moverCursorActividad}
        />
      )}
      {!modoPlan && rutaVista && (
        <FichaRuta
          ruta={rutaVista}
          invertida={sentidoInvertido}
          onInvertir={() => setSentidoInvertido((v) => !v)}
          onCerrar={() => setSeleccion(null)}
          onCursorPerfil={moverCursorPerfil}
          realizado={realizadoDe("ruta", rutaVista.id)}
          puedeMarcar={puedeMarcar}
          onMarcar={(fecha, notas) =>
            marcar("ruta", rutaVista.id, rutaVista.nombre, rutaVista.red, fecha, notas)
          }
          onDesmarcar={async () => {
            const r = realizadoDe("ruta", rutaVista.id);
            if (r) await desmarcarRealizado(r.id);
          }}
          usuario={sesion.usuario}
          esInvitado={sesion.invitado}
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
        </div>

        <div className="flex flex-col overflow-hidden rounded-lg border border-roca-700 shadow-lg shadow-roca-950/60">
          <BotonMapa
            etiqueta={
              modoPlan ? "Salir del planificador" : "Planificar ruta propia"
            }
            activo={modoPlan}
            onClick={alternarPlanificador}
          >
            <IconoTrazar />
          </BotonMapa>
          <BotonMapa
            etiqueta={verProgreso ? "Cerrar progreso" : "Ver progreso"}
            activo={verProgreso}
            onClick={() => {
              const abrir = !verProgreso;
              setVerProgreso(abrir);
              if (abrir) {
                setSeleccion(null);
                setVerExplorador(false);
                setVerDescargas(false);
                if (modoPlan) alternarPlanificador();
              }
            }}
          >
            <IconoProgreso />
          </BotonMapa>
          <BotonMapa
            etiqueta={
              verExplorador ? "Cerrar explorador" : "Explorar el catálogo"
            }
            activo={verExplorador}
            onClick={() => {
              const abrir = !verExplorador;
              setVerExplorador(abrir);
              if (abrir) {
                setSeleccion(null);
                setVerProgreso(false);
                setVerDescargas(false);
                if (modoPlan) alternarPlanificador();
              }
            }}
          >
            <IconoLista />
          </BotonMapa>
          <BotonMapa
            etiqueta={verDescargas ? "Cerrar descargas" : "Descargas para sin cobertura"}
            activo={verDescargas}
            onClick={() => {
              const abrir = !verDescargas;
              setVerDescargas(abrir);
              if (abrir) {
                setSeleccion(null);
                setVerProgreso(false);
                setVerExplorador(false);
                if (modoPlan) alternarPlanificador();
              }
            }}
          >
            <IconoDescargaOffline />
          </BotonMapa>
        </div>
      </div>

      {/* Ayuda de navegación */}
      <p className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-roca-700 bg-roca-950/80 px-4 py-1.5 text-xs text-hielo-300">
        Arrastra con el botón derecho (o Ctrl + arrastrar) para inclinar y
        rotar la vista
      </p>

      {/* Velo de carga: por encima de todo (la fila del buscador lleva z-10) */}
      {!cargado && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-roca-950">
          <IconoPico width={48} height={48} className="text-ocre-400" />
          <p className="text-sm tracking-wide text-hielo-300">
            Cargando el terreno del Pirineo…
          </p>
        </div>
      )}
    </main>
  );
}
