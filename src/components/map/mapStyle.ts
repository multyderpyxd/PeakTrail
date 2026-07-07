import type { StyleSpecification } from "maplibre-gl";

/**
 * Vista inicial: valle de Ordesa mirando hacia el macizo de Monte Perdido,
 * con la cámara ya inclinada para que el relieve se aprecie nada más cargar.
 */
export const VISTA_INICIAL = {
  center: [0.03, 42.62] as [number, number],
  zoom: 11.8,
  pitch: 62,
  bearing: -18,
};

export const EXAGERACION_TERRENO = 1.35;

const ATRIBUCION_IGN = "© Instituto Geográfico Nacional";
const ATRIBUCION_OSM =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const ATRIBUCION_TERRENO =
  "Elevación: Mapzen/AWS Open Data (SRTM, EU-DEM)";

/** Ortofoto PNOA de máxima actualidad, WMTS del IGN en rejilla web mercator. */
const TESELAS_PNOA =
  "https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&version=1.0.0" +
  "&layer=OI.OrthoimageCoverage&style=default&format=image/jpeg" +
  "&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}";

/** Capa de rotulación del IGN pensada para superponerse a ortofoto. */
const TESELAS_TOPONIMOS =
  "https://www.ign.es/wmts/ign-base?request=GetTile&service=WMTS&version=1.0.0" +
  "&layer=IGNBaseOrto&style=default&format=image/png" +
  "&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}";

/**
 * Teselas de elevación en codificación terrarium (Mapzen/AWS Open Data).
 * El MDT05 del IGN no se publica como teselas terrain-RGB consumibles por
 * MapLibre; cuando montemos nuestra propia tubería MDT05 → terrain-RGB,
 * bastará con cambiar esta URL y la codificación.
 */
const TESELAS_ELEVACION =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const CAPA_TOPONIMOS = "toponimos";

export const estiloMapa: StyleSpecification = {
  version: 8,
  sources: {
    pnoa: {
      type: "raster",
      tiles: [TESELAS_PNOA],
      tileSize: 256,
      maxzoom: 19,
      attribution: `${ATRIBUCION_IGN} | ${ATRIBUCION_OSM}`,
    },
    toponimos: {
      type: "raster",
      tiles: [TESELAS_TOPONIMOS],
      tileSize: 256,
      maxzoom: 17,
    },
    terreno: {
      type: "raster-dem",
      tiles: [TESELAS_ELEVACION],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 13,
      attribution: ATRIBUCION_TERRENO,
    },
    sombreado: {
      type: "raster-dem",
      tiles: [TESELAS_ELEVACION],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 13,
    },
  },
  layers: [
    {
      id: "fondo",
      type: "background",
      paint: { "background-color": "#16130f" },
    },
    {
      id: "ortofoto",
      type: "raster",
      source: "pnoa",
      paint: {
        // Ligero ajuste para quitar el velo lechoso de la ortofoto en verano
        "raster-saturation": 0.12,
        "raster-contrast": 0.06,
      },
    },
    {
      // Sombreado calculado del propio MDT: da volumen también en vista cenital
      id: "sombreado-relieve",
      type: "hillshade",
      source: "sombreado",
      paint: {
        "hillshade-exaggeration": 0.35,
        "hillshade-shadow-color": "#1d150c",
        "hillshade-highlight-color": "#fff8ec",
        "hillshade-accent-color": "#2a2013",
        "hillshade-illumination-direction": 335,
      },
    },
    {
      id: CAPA_TOPONIMOS,
      type: "raster",
      source: "toponimos",
      paint: { "raster-opacity": 0.95 },
    },
  ],
  terrain: {
    source: "terreno",
    exaggeration: EXAGERACION_TERRENO,
  },
  sky: {
    "sky-color": "#8fb6cf",
    "horizon-color": "#dce9ee",
    "fog-color": "#e7ded0",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.7,
    "fog-ground-blend": 0.9,
  },
};

/**
 * Ambientes del mapa: presets de cielo, sombreado y tratamiento de la
 * ortofoto que cambian la luz de la escena sin tocar los datos.
 */
export type Ambiente = "dia" | "niebla" | "atardecer";

export const ORDEN_AMBIENTES: Ambiente[] = ["dia", "niebla", "atardecer"];

export const ETIQUETA_AMBIENTE: Record<Ambiente, string> = {
  dia: "Día",
  niebla: "Niebla",
  atardecer: "Atardecer",
};

interface PresetAmbiente {
  sky: Record<string, unknown>;
  sombreado: Record<string, unknown>;
  ortofoto: Record<string, number>;
}

export const AMBIENTES: Record<Ambiente, PresetAmbiente> = {
  dia: {
    sky: {
      "sky-color": "#8fb6cf",
      "horizon-color": "#dce9ee",
      "fog-color": "#e7ded0",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.9,
    },
    sombreado: {
      "hillshade-exaggeration": 0.35,
      "hillshade-shadow-color": "#1d150c",
      "hillshade-highlight-color": "#fff8ec",
      "hillshade-accent-color": "#2a2013",
      "hillshade-illumination-direction": 335,
    },
    ortofoto: { "raster-saturation": 0.12, "raster-contrast": 0.06, "raster-hue-rotate": 0 },
  },
  niebla: {
    sky: {
      "sky-color": "#9db0ba",
      "horizon-color": "#ccd4d8",
      "fog-color": "#d8dcdd",
      "sky-horizon-blend": 0.85,
      "horizon-fog-blend": 0.95,
      "fog-ground-blend": 0.55,
    },
    sombreado: {
      "hillshade-exaggeration": 0.22,
      "hillshade-shadow-color": "#232526",
      "hillshade-highlight-color": "#f2f5f5",
      "hillshade-accent-color": "#2c2f30",
      "hillshade-illumination-direction": 335,
    },
    ortofoto: { "raster-saturation": -0.35, "raster-contrast": -0.08, "raster-hue-rotate": 0 },
  },
  atardecer: {
    sky: {
      "sky-color": "#8a5a63",
      "horizon-color": "#e0995c",
      "fog-color": "#d9b18a",
      "sky-horizon-blend": 0.55,
      "horizon-fog-blend": 0.75,
      "fog-ground-blend": 0.8,
    },
    sombreado: {
      "hillshade-exaggeration": 0.5,
      "hillshade-shadow-color": "#241118",
      "hillshade-highlight-color": "#ffd9a8",
      "hillshade-accent-color": "#331c22",
      "hillshade-illumination-direction": 260,
    },
    ortofoto: { "raster-saturation": 0.18, "raster-contrast": 0.1, "raster-hue-rotate": 8 },
  },
};
