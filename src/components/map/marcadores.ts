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

function svgMarcador(tipo: keyof typeof COLOR_TIPO): string {
  const glifo = TRAZOS[tipo].map((d) => `<path d="${d}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="68" height="68" viewBox="0 0 34 34">` +
    `<circle cx="17" cy="17" r="14" fill="#16130f" fill-opacity="0.88" stroke="${COLOR_TIPO[tipo]}" stroke-width="2"/>` +
    `<g transform="translate(6.6 6.6) scale(0.87)" fill="none" stroke="#f6f4ee" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${glifo}</g>` +
    `</svg>`
  );
}

export async function cargarIconosMapa(mapa: maplibregl.Map): Promise<void> {
  await Promise.all(
    TIPOS_MARCADOR.map(async (tipo) => {
      const imagen = new Image(68, 68);
      imagen.src =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarcador(tipo));
      await imagen.decode();
      mapa.addImage(`marcador-${tipo}`, imagen, { pixelRatio: 2 });
    }),
  );
}
