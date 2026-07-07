import type maplibregl from "maplibre-gl";
import { TRAZOS } from "@/components/iconos-trazos";
import type { TipoElemento } from "@/types/catalogo";

/**
 * Marcadores del mapa: insignia circular con el glifo del set de iconos,
 * rasterizada a 2x para pantallas de alta densidad. El color del aro
 * identifica el tipo (los mismos tokens de la paleta que usa la UI).
 */

export const COLOR_TIPO: Record<Exclude<TipoElemento, "collado">, string> = {
  pico: "#c99655", // ocre-400
  ibon: "#7fa8b8", // hielo-500
  refugio: "#7ba488", // pino-300
};

export const TIPOS_MARCADOR = Object.keys(COLOR_TIPO) as (keyof typeof COLOR_TIPO)[];

function svgMarcador(
  tipo: keyof typeof COLOR_TIPO,
  destello = false,
): string {
  const glifo = TRAZOS[tipo].map((d) => `<path d="${d}"/>`).join("");
  // La variante de destello invierte la insignia: fondo del color del aro
  // y glifo oscuro; se alterna con la normal para hacer parpadear el punto
  const fondo = destello ? COLOR_TIPO[tipo] : "#16130f";
  const trazo = destello ? "#16130f" : "#f6f4ee";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="68" height="68" viewBox="0 0 34 34">` +
    `<circle cx="17" cy="17" r="14" fill="${fondo}" fill-opacity="${destello ? 1 : 0.88}" stroke="${COLOR_TIPO[tipo]}" stroke-width="2"/>` +
    `<g transform="translate(6.6 6.6) scale(0.87)" fill="none" stroke="${trazo}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${glifo}</g>` +
    `</svg>`
  );
}

/**
 * Señales minimalistas de la ruta seleccionada: punto de salida, banderín de
 * llegada y el cursor que sigue al perfil de elevación (mismo azul de la
 * serie del gráfico). Mismo lenguaje de trazo que el resto del set.
 */
const SVG_RUTA: Record<string, string> = {
  // Fondo claro (hielo) y glifo oscuro: destacan aunque caigan encima de un
  // marcador oscuro del catálogo (cima, refugio...) en la salida o la llegada
  "ruta-inicio":
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 22 22">` +
    `<circle cx="11" cy="11" r="8" fill="#dce9ee" stroke="#16130f" stroke-width="1.6"/>` +
    `<circle cx="11" cy="11" r="2.8" fill="#16130f"/>` +
    `</svg>`,
  "ruta-fin":
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 22 22">` +
    `<circle cx="11" cy="11" r="8" fill="#dce9ee" stroke="#16130f" stroke-width="1.6"/>` +
    `<g fill="none" stroke="#16130f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M8 15.5V6.5"/><path d="M8 6.5h6.5l-1.8 2.2 1.8 2.2H8"/>` +
    `</g></svg>`,
  "ruta-cursor":
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 13 13">` +
    `<circle cx="6.5" cy="6.5" r="4.6" fill="#3f92c9" stroke="#f6f4ee" stroke-width="1.6"/>` +
    `</svg>`,
  // Puntos marcados al planificar una ruta propia
  "plan-punto":
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 13 13">` +
    `<circle cx="6.5" cy="6.5" r="4.4" fill="#c99655" stroke="#16130f" stroke-width="1.5"/>` +
    `</svg>`,
};

async function anadirImagen(
  mapa: maplibregl.Map,
  nombre: string,
  svg: string,
): Promise<void> {
  const imagen = new Image();
  imagen.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await imagen.decode();
  mapa.addImage(nombre, imagen, { pixelRatio: 2 });
}

export async function cargarIconosMapa(mapa: maplibregl.Map): Promise<void> {
  await Promise.all([
    ...TIPOS_MARCADOR.map((tipo) =>
      anadirImagen(mapa, `marcador-${tipo}`, svgMarcador(tipo)),
    ),
    ...TIPOS_MARCADOR.map((tipo) =>
      anadirImagen(mapa, `marcador-${tipo}-destello`, svgMarcador(tipo, true)),
    ),
    ...Object.entries(SVG_RUTA).map(([nombre, svg]) =>
      anadirImagen(mapa, nombre, svg),
    ),
  ]);
}
