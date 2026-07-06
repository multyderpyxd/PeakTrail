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
  IconoProgreso,
  IconoRelieve,
  IconoToponimo,
  IconoTrazar,
  IconoUsuario,
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
import { Planificador } from "./Planificador";
import { medirLinea, type MetricasLinea } from "@/lib/elevacion";
import { segmentoAPie } from "@/lib/enrutador";
import {
  borrarPlan,
  guardarPlan,
  isFirebaseConfigured,
  listarPlanes,
} from "@/lib/planes";
import type { RutaPlaneada } from "@/types/plan";
import { entrar, salir, useUsuario } from "@/lib/auth";
import {
  desmarcarRealizado,
  escucharRealizados,
  idRealizado,
  marcarRealizado,
  type Realizado,
} from "@/lib/realizados";
import { Progreso } from "./Progreso";
import { procesarRetornoStrava } from "@/lib/strava";

const CAPA_ELEMENTOS = "elementos";
const CAPA_RUTAS = "rutas";
const CAPA_RUTAS_CASCO = "rutas-casco";
const CAPA_RUTAS_PULSABLE = "rutas-pulsable";
const CAPA_RUTA_DESTACADA = "ruta-destacada";
const CAPA_RUTA_EXTREMOS = "ruta-extremos";
const CAPA_RUTA_CURSOR = "ruta-cursor";
const CAPA_PLAN_LINEA = "plan-linea";
const CAPA_PLAN_PUNTOS = "plan-puntos";

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

  // Estado del planificador de rutas propias
  const [modoPlan, setModoPlan] = useState(false);
  const modoPlanRef = useRef(false);
  const [puntosPlan, setPuntosPlan] = useState<[number, number][]>([]);
  const [segmentosPlan, setSegmentosPlan] = useState<[number, number][][]>([]);
  const [modoSenderos, setModoSenderos] = useState(true);
  const [enrutando, setEnrutando] = useState(false);
  const enrutandoRef = useRef(false);
  const [metricasPlan, setMetricasPlan] = useState<MetricasLinea | null>(null);
  const [midiendo, setMidiendo] = useState(false);
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [planes, setPlanes] = useState<RutaPlaneada[] | null>(null);
  const [planVisible, setPlanVisible] = useState<RutaPlaneada | null>(null);

  // Sesión, registro de realizados del grupo y panel de progreso
  const sesion = useUsuario();
  const [realizados, setRealizados] = useState<Map<string, Realizado>>(
    new Map(),
  );
  const [verProgreso, setVerProgreso] = useState(false);

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
      mapa.addSource(CAPA_PLAN_PUNTOS, { type: "geojson", data: COLECCION_VACIA });
      mapa.addLayer({
        id: CAPA_PLAN_PUNTOS,
        type: "symbol",
        source: CAPA_PLAN_PUNTOS,
        layout: {
          "icon-image": "plan-punto",
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
      if (modoPlanRef.current) {
        setPlanVisible(null);
        setPuntosPlan((p) => [...p, [e.lngLat.lng, e.lngLat.lat]]);
        return;
      }
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
      setVerProgreso(false);
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

  // --- Planificador ---

  // Calcula el segmento pendiente entre los dos últimos puntos marcados
  useEffect(() => {
    // Si al deshacer sobran segmentos (p. ej. con un enrutado en vuelo),
    // se recortan antes de calcular nada
    const esperados = Math.max(0, puntosPlan.length - 1);
    if (segmentosPlan.length > esperados) {
      setSegmentosPlan((s) => s.slice(0, esperados));
      return;
    }
    if (puntosPlan.length - 1 <= segmentosPlan.length || enrutandoRef.current)
      return;
    const a = puntosPlan[segmentosPlan.length];
    const b = puntosPlan[segmentosPlan.length + 1];
    enrutandoRef.current = true;
    setEnrutando(true);
    (modoSenderos
      ? segmentoAPie(a, b)
      : Promise.resolve({ coords: [a, b] as [number, number][] })
    )
      .then(({ coords }) => setSegmentosPlan((s) => [...s, coords]))
      .finally(() => {
        enrutandoRef.current = false;
        setEnrutando(false);
      });
  }, [puntosPlan, segmentosPlan, modoSenderos]);

  const lineaPlan = useMemo(() => {
    const linea: [number, number][] = [];
    for (const seg of segmentosPlan)
      linea.push(...(linea.length ? seg.slice(1) : seg));
    return linea;
  }, [segmentosPlan]);

  // Métricas del borrador (elevación muestreada), con un pequeño debounce
  useEffect(() => {
    if (lineaPlan.length < 2) {
      setMetricasPlan(null);
      return;
    }
    let cancelado = false;
    setMidiendo(true);
    const temporizador = setTimeout(async () => {
      try {
        const metricas = await medirLinea(lineaPlan);
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
  }, [lineaPlan]);

  // Pinta borrador o plan guardado seleccionado
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !cargado) return;
    const linea = planVisible ? planVisible.linea : lineaPlan;
    const puntos = planVisible ? planVisible.puntos : puntosPlan;
    (mapa.getSource(CAPA_PLAN_LINEA) as maplibregl.GeoJSONSource).setData(
      linea.length > 1
        ? {
            type: "Feature",
            geometry: { type: "LineString", coordinates: linea },
            properties: {},
          }
        : COLECCION_VACIA,
    );
    (mapa.getSource(CAPA_PLAN_PUNTOS) as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: puntos.map((coord) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: coord },
        properties: {},
      })),
    });
  }, [lineaPlan, puntosPlan, planVisible, cargado]);

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
    setPuntosPlan([]);
    setSegmentosPlan([]);
    setMetricasPlan(null);
  }

  function deshacerPunto() {
    setPuntosPlan((p) => p.slice(0, -1));
    setSegmentosPlan((s) =>
      s.length >= puntosPlan.length - 1 ? s.slice(0, -1) : s,
    );
  }

  async function guardarBorrador(nombre: string) {
    if (!metricasPlan || lineaPlan.length < 2) return;
    setGuardandoPlan(true);
    try {
      await guardarPlan({
        nombre,
        puntos: puntosPlan,
        linea: lineaPlan,
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

      {/* Planificador de rutas propias */}
      {modoPlan && (
        <Planificador
          numPuntos={puntosPlan.length}
          metricas={metricasPlan}
          midiendo={midiendo}
          enrutando={enrutando}
          modoSenderos={modoSenderos}
          onModoSenderos={setModoSenderos}
          onDeshacer={deshacerPunto}
          onLimpiar={limpiarBorrador}
          onGuardar={guardarBorrador}
          guardando={guardandoPlan}
          firebaseListo={isFirebaseConfigured}
          planes={planes}
          planVisible={planVisible}
          onVerPlan={verPlan}
          onBorrarPlan={borrarPlanGuardado}
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
        />
      )}

      {/* Ficha de la selección */}
      {!modoPlan && seleccion?.clase === "elemento" && (
        <FichaElemento
          elemento={seleccion.elemento}
          onCerrar={() => setSeleccion(null)}
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
                if (modoPlan) alternarPlanificador();
              }
            }}
          >
            <IconoProgreso />
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
