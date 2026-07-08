import type { SVGProps } from "react";
import { TRAZOS } from "./iconos-trazos";

/*
 * Set de iconos propio de PeakTrail.
 * Estilo común: trazo 1.75 sobre retícula 24x24, terminaciones y uniones
 * redondeadas, sin rellenos salvo detalle puntual. Cualquier icono nuevo
 * del proyecto debe salir de esta misma base.
 */

function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function trazos(tipo: keyof typeof TRAZOS) {
  return TRAZOS[tipo].map((d) => <path key={d} d={d} />);
}

/** Marca de PeakTrail: dos cimas con línea de nieve en la mayor. */
export function IconoPico(props: SVGProps<SVGSVGElement>) {
  return <Base {...props}>{trazos("pico")}</Base>;
}

/** Lámina de agua de un ibón. */
export function IconoIbon(props: SVGProps<SVGSVGElement>) {
  return <Base {...props}>{trazos("ibon")}</Base>;
}

/** Refugio de montaña. */
export function IconoRefugio(props: SVGProps<SVGSVGElement>) {
  return <Base {...props}>{trazos("refugio")}</Base>;
}

/** Collado entre dos vertientes. */
export function IconoCollado(props: SVGProps<SVGSVGElement>) {
  return <Base {...props}>{trazos("collado")}</Base>;
}

/** Intercambiar sentido: dos flechas opuestas. */
export function IconoInvertir(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4.5 9h14M15.3 5.8 18.5 9l-3.2 3.2" />
      <path d="M19.5 15H5.5M8.7 18.2 5.5 15l3.2-3.2" />
    </Base>
  );
}

/** Trazar una ruta propia: camino con puntos en los extremos. */
export function IconoTrazar(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M5.5 18c4.5-1 2.5-6.5 7-7.5s4-4 6-5" />
      <circle cx="5" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
    </Base>
  );
}

/** Deshacer el último paso. */
export function IconoDeshacer(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M8 5.5 4.5 9 8 12.5" />
      <path d="M4.5 9h9.5a4.75 4.75 0 0 1 0 9.5H11" />
    </Base>
  );
}

/** Borrar. */
export function IconoPapelera(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M5 7h14M10 7V5h4v2M7.5 7l.9 12h7.2l.9-12" />
    </Base>
  );
}

/** Usuario del grupo. */
export function IconoUsuario(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 19.5c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5" />
    </Base>
  );
}

/** Progreso: cimas ascendentes conquistadas. */
export function IconoProgreso(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 19.5v-5M9.5 19.5v-9M15 19.5V6.5M20 19.5V10" />
    </Base>
  );
}

/** Hecho / realizado. */
export function IconoHecho(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Base>
  );
}

/** Actividad registrada (pulso de una traza). */
export function IconoActividad(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 13h3.5L9 6.5 14 19l2.5-6H21" />
    </Base>
  );
}

/** Ambiente / luz de la escena (sol sobre el horizonte). */
export function IconoAmbiente(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12.5" r="4" />
      <path d="M12 5.5v-2M17 7.5l1.4-1.4M6.9 7.5 5.5 6.1M19.5 12.5h2M2.5 12.5h2M4.5 18.5h15" />
    </Base>
  );
}

/** Buscar. */
export function IconoBuscar(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 5 5" />
    </Base>
  );
}

/** Cerrar paneles y fichas. */
export function IconoCerrar(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="m6.5 6.5 11 11m0-11-11 11" />
    </Base>
  );
}

/** Aumentar zoom. */
export function IconoMas(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Base>
  );
}

/** Reducir zoom. */
export function IconoMenos(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M5.5 12h13" />
    </Base>
  );
}

/** Aguja de brújula; la mitad norte va rellena. Rotarla desde fuera. */
export function IconoBrujula(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 2.8 15 12l-3 9.2L9 12l3-9.2Z" />
      <path d="M12 2.8 15 12H9l3-9.2Z" fill="currentColor" stroke="none" />
    </Base>
  );
}

/** Relieve en perspectiva: plano inclinado con una cima, para alternar 2D/3D. */
export function IconoRelieve(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 16.5 12 21l9-4.5" />
      <path d="m3 16.5 5.2-8.3 3.1 4.4 2.6-6.1L21 16.5" />
    </Base>
  );
}

/** Capas del mapa apiladas en perspectiva. */
export function IconoCapas(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3.5 20 8l-8 4.5L4 8l8-4.5Z" />
      <path d="m4 12.5 8 4.5 8-4.5" />
      <path d="m4 16.5 8 4.5 8-4.5" />
    </Base>
  );
}

/** Rótulo de topónimo sobre el mapa. */
export function IconoToponimo(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3.5" y="6" width="17" height="9" rx="2" />
      <path d="M8 10.5h8M12 15v4" />
    </Base>
  );
}

/* --- Iconografía meteo (glifos propios, un estado del cielo cada uno) --- */

const SOL = (
  <>
    <circle cx="12" cy="12" r="3.8" />
    <path d="M12 3.4v2.3M12 18.3v2.3M3.4 12h2.3M18.3 12h2.3M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6" />
  </>
);

// Nubes: cuerpo standalone (más bajo) y variante alta que deja sitio a la
// precipitación debajo
const NUBE_BAJA =
  "M8 17h8a3.3 3.3 0 0 0 .1-6.6 4.3 4.3 0 0 0-8.3-1.1A3.2 3.2 0 0 0 8 17Z";
const NUBE_ALTA =
  "M8 15h8a3.2 3.2 0 0 0 .1-6.4 4.2 4.2 0 0 0-8.1-1.1A3.1 3.1 0 0 0 8 15Z";

const SOL_PEQUENO = (
  <>
    <circle cx="9" cy="9.4" r="2.5" />
    <path d="M9 4.4v1.6M4 9.4h1.6M5.7 6.1l1.1 1.1M12.3 6.1l-1.1 1.1" />
  </>
);
const NUBE_FRENTE =
  "M10 18.5h6.5a2.8 2.8 0 0 0 .1-5.6 3.6 3.6 0 0 0-6.9-.9A2.7 2.7 0 0 0 10 18.5Z";

export function IconoMeteo({
  estado,
  ...props
}: SVGProps<SVGSVGElement> & { estado: string }) {
  switch (estado) {
    case "despejado":
      return <Base {...props}>{SOL}</Base>;
    case "poco-nuboso":
      return (
        <Base {...props}>
          {SOL_PEQUENO}
          <path d={NUBE_FRENTE} />
        </Base>
      );
    case "nuboso":
      return (
        <Base {...props}>
          <path d={NUBE_BAJA} />
        </Base>
      );
    case "niebla":
      return (
        <Base {...props}>
          <path d={NUBE_BAJA} />
          <path d="M7.5 19.5h9M9.5 22h5" />
        </Base>
      );
    case "lluvia":
      return (
        <Base {...props}>
          <path d={NUBE_ALTA} />
          <path d="M9.5 17.5l-1 2.6M12.5 17.5l-1 2.6M15.5 17.5l-1 2.6" />
        </Base>
      );
    case "chubascos":
      return (
        <Base {...props}>
          {SOL_PEQUENO}
          <path d={NUBE_FRENTE} />
          <path d="M11 19.8l-.8 2M14 19.8l-.8 2" />
        </Base>
      );
    case "nieve":
      return (
        <Base {...props}>
          <path d={NUBE_ALTA} />
          <path d="M9.5 18v2M8.5 19h2M12.5 18v2M11.5 19h2M15.5 18v2M14.5 19h2" />
        </Base>
      );
    case "tormenta":
      return (
        <Base {...props}>
          <path d={NUBE_ALTA} />
          <path d="M12.5 16 10 19.6h2.2l-1.2 3.1" />
        </Base>
      );
    default:
      return (
        <Base {...props}>
          <path d={NUBE_BAJA} />
        </Base>
      );
  }
}

/** Viento: dos rachas curvas. */
export function IconoViento(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 8.5h11a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M3 15.5h14a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M3 12h6" />
    </Base>
  );
}
