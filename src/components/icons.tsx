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

/** Rótulo de topónimo sobre el mapa. */
export function IconoToponimo(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3.5" y="6" width="17" height="9" rx="2" />
      <path d="M8 10.5h8M12 15v4" />
    </Base>
  );
}
