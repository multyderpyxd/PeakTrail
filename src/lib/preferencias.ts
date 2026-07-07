import type { TipoElemento } from "@/types/catalogo";
import type { RedRuta } from "@/types/rutas";
import type { Ambiente } from "@/components/map/mapStyle";

/**
 * Preferencias de vista del mapa, persistidas en localStorage para que
 * sobrevivan a la recarga: filtros activos, ambiente y topónimos.
 * Se leen tras montar (nunca durante el render) para no desajustar la
 * hidratación de Next.
 */

export interface PreferenciasVista {
  tiposActivos: TipoElemento[];
  redesActivas: RedRuta[];
  ambiente: Ambiente;
  toponimos: boolean;
  /** Cota mínima (m) de los picos mostrados; 0 = todos. */
  altitudMinima: number;
}

// v2: el Hito 12 añadió collados y cota mínima; las preferencias v1 no
// conocían el tipo collado y lo dejarían oculto para siempre
const CLAVE = "peaktrail:vista:2";

const TIPOS: TipoElemento[] = ["pico", "ibon", "refugio", "collado"];
const REDES: RedRuta[] = ["gr", "pr", "sl"];
const AMBIENTES_VALIDOS: Ambiente[] = ["dia", "niebla", "atardecer"];

export function leerPreferencias(): Partial<PreferenciasVista> {
  if (typeof window === "undefined") return {};
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return {};
    const datos = JSON.parse(crudo) as Partial<PreferenciasVista>;
    const limpias: Partial<PreferenciasVista> = {};
    if (Array.isArray(datos.tiposActivos)) {
      limpias.tiposActivos = datos.tiposActivos.filter((t) =>
        TIPOS.includes(t),
      );
    }
    if (Array.isArray(datos.redesActivas)) {
      limpias.redesActivas = datos.redesActivas.filter((r) =>
        REDES.includes(r),
      );
    }
    if (datos.ambiente && AMBIENTES_VALIDOS.includes(datos.ambiente)) {
      limpias.ambiente = datos.ambiente;
    }
    if (typeof datos.toponimos === "boolean") {
      limpias.toponimos = datos.toponimos;
    }
    if (
      typeof datos.altitudMinima === "number" &&
      datos.altitudMinima >= 0 &&
      datos.altitudMinima <= 3000
    ) {
      limpias.altitudMinima = datos.altitudMinima;
    }
    return limpias;
  } catch {
    return {};
  }
}

export function guardarPreferencias(prefs: PreferenciasVista): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(prefs));
  } catch {
    // Sin sitio o en modo privado: la vista simplemente no se recuerda
  }
}
