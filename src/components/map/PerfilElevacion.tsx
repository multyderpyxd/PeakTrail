import { useState } from "react";

/**
 * Perfil de elevación (distancia vs altitud) como SVG puro.
 * Serie única: área + línea en un solo color validado sobre el panel oscuro;
 * rejilla y rótulos recesivos con los tokens de texto; crosshair con lectura
 * puntual al pasar el cursor.
 */

const COLOR_SERIE = "#3f92c9";
const ANCHO = 320;
const ALTO = 132;
const MARGEN = { sup: 8, der: 8, inf: 18, izq: 38 };

function ticksRedondos(min: number, max: number, n: number): number[] {
  const paso = [1000, 500, 250, 200, 100, 50, 25, 10, 5, 2, 1].find(
    (p) => (max - min) / p >= n - 1,
  ) ?? 1;
  const primero = Math.ceil(min / paso) * paso;
  const ticks = [];
  for (let v = primero; v <= max; v += paso) ticks.push(v);
  return ticks.length ? ticks : [min, max];
}

export function PerfilElevacion({
  perfil,
  onPunto,
}: {
  perfil: [number, number][];
  /** Avisa del km bajo el cursor (null al salir) para reflejarlo en el mapa. */
  onPunto?: (km: number | null) => void;
}) {
  const [indice, setIndice] = useState<number | null>(null);

  const kmMax = perfil[perfil.length - 1][0];
  const eles = perfil.map(([, e]) => e);
  const eleMin = Math.min(...eles);
  const eleMax = Math.max(...eles);
  const margenEle = Math.max(20, (eleMax - eleMin) * 0.08);
  const [y0, y1] = [eleMin - margenEle, eleMax + margenEle];

  const x = (km: number) =>
    MARGEN.izq + (km / kmMax) * (ANCHO - MARGEN.izq - MARGEN.der);
  const y = (ele: number) =>
    ALTO - MARGEN.inf - ((ele - y0) / (y1 - y0)) * (ALTO - MARGEN.sup - MARGEN.inf);

  const linea = perfil
    .map(([km, ele], i) => `${i ? "L" : "M"}${x(km).toFixed(1)} ${y(ele).toFixed(1)}`)
    .join("");
  const area = `${linea}L${x(kmMax).toFixed(1)} ${ALTO - MARGEN.inf}L${MARGEN.izq} ${
    ALTO - MARGEN.inf
  }Z`;

  const ticksY = ticksRedondos(y0, y1, 3);
  const ticksX = ticksRedondos(0, kmMax, 4);

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    const km = ((e.clientX - caja.left) / caja.width) * ANCHO;
    let mejor = 0;
    for (let i = 1; i < perfil.length; i++) {
      if (Math.abs(x(perfil[i][0]) - km) < Math.abs(x(perfil[mejor][0]) - km))
        mejor = i;
    }
    setIndice(mejor);
    onPunto?.(perfil[mejor][0]);
  }

  function alSalir() {
    setIndice(null);
    onPunto?.(null);
  }

  const punto = indice !== null ? perfil[indice] : null;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Perfil de elevación: de ${eleMin} a ${eleMax} metros a lo largo de ${kmMax} kilómetros`}
        onPointerMove={alMover}
        onPointerLeave={alSalir}
      >
        {ticksY.map((v) => (
          <g key={v}>
            <line
              x1={MARGEN.izq}
              x2={ANCHO - MARGEN.der}
              y1={y(v)}
              y2={y(v)}
              stroke="#453d32"
              strokeWidth={0.6}
            />
            <text
              x={MARGEN.izq - 5}
              y={y(v) + 3}
              textAnchor="end"
              fontSize={8.5}
              fill="#a2967f"
            >
              {v.toLocaleString("es-ES")}
            </text>
          </g>
        ))}
        {ticksX.map((v) => (
          <text
            key={v}
            x={x(v)}
            y={ALTO - 5}
            textAnchor="middle"
            fontSize={8.5}
            fill="#a2967f"
          >
            {v} km
          </text>
        ))}
        <path d={area} fill={COLOR_SERIE} fillOpacity={0.16} />
        <path d={linea} fill="none" stroke={COLOR_SERIE} strokeWidth={1.8} />
        {punto && (
          <g pointerEvents="none">
            <line
              x1={x(punto[0])}
              x2={x(punto[0])}
              y1={MARGEN.sup}
              y2={ALTO - MARGEN.inf}
              stroke="#dce9ee"
              strokeWidth={0.7}
              strokeDasharray="2 2"
            />
            <circle
              cx={x(punto[0])}
              cy={y(punto[1])}
              r={3.2}
              fill={COLOR_SERIE}
              stroke="#16130f"
              strokeWidth={1.5}
            />
          </g>
        )}
      </svg>
      <figcaption className="mt-1 h-4 text-center text-xs text-hielo-300">
        {punto
          ? `km ${punto[0].toLocaleString("es-ES")} · ${punto[1].toLocaleString("es-ES")} m`
          : " "}
      </figcaption>
    </figure>
  );
}
