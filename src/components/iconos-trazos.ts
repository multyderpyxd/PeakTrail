import type { TipoElemento } from "@/types/catalogo";

/**
 * Trazos (atributo d de <path>) del set de iconos, sobre retícula 24x24 y
 * pensados para trazo 1.75 con terminaciones redondeadas. Se comparten entre
 * los componentes React de src/components/icons.tsx y los marcadores SVG
 * rasterizados del mapa, para que todo salga del mismo dibujo.
 */
export const TRAZOS: Record<TipoElemento, string[]> = {
  pico: ["M2.5 19h19L14.8 5.2 11.6 11l-3-4.6L2.5 19Z", "m13.3 8.4 1.2 1.6 1.3-1.7"],
  ibon: [
    "M3.5 10c2.3-2 4.7-2 7 0s4.7 2 7 0",
    "M6.5 15.5c1.8-1.6 3.7-1.6 5.5 0s3.7 1.6 5.5 0",
  ],
  refugio: ["M4.5 19v-6.5L12 6l7.5 6.5V19h-15Z", "M10 19v-4.5h4V19"],
  collado: ["M2.5 8c3 0 4 6.5 9.5 6.5S18.5 8 21.5 8", "M9 18h6"],
};
