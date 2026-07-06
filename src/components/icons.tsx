import type { SVGProps } from "react";

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

/** Marca de PeakTrail: dos cimas con línea de nieve en la mayor. */
export function IconoPico(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M2.5 19h19L14.8 5.2 11.6 11l-3-4.6L2.5 19Z" />
      <path d="m13.3 8.4 1.2 1.6 1.3-1.7" />
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
