/**
 * Evolución temporal del grupo: cuántas actividades (picos, ibones,
 * refugios, collados y rutas) se han marcado como realizadas cada mes de
 * los últimos doce, como un histograma SVG sencillo. Mismo lenguaje visual
 * que PerfilElevacion.tsx (rejilla y rótulos recesivos, serie en un color).
 */

const COLOR_BARRA = "#c99655"; // ocre-400: color de marca, no ligado a un tipo
const ANCHO = 320;
const ALTO = 100;
const MARGEN = { sup: 14, der: 4, inf: 16, izq: 4 };

export interface CuboMensual {
  etiqueta: string;
  total: number;
}

export function GraficoActividad({ meses }: { meses: CuboMensual[] }) {
  const maximo = Math.max(1, ...meses.map((m) => m.total));
  const anchoBarra = (ANCHO - MARGEN.izq - MARGEN.der) / meses.length;
  const y = (valor: number) =>
    ALTO - MARGEN.inf - (valor / maximo) * (ALTO - MARGEN.sup - MARGEN.inf);

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="w-full"
      role="img"
      aria-label={`Actividad marcada por mes en los últimos doce meses: ${meses
        .map((m) => `${m.etiqueta} ${m.total}`)
        .join(", ")}`}
    >
      <line
        x1={MARGEN.izq}
        x2={ANCHO - MARGEN.der}
        y1={ALTO - MARGEN.inf}
        y2={ALTO - MARGEN.inf}
        stroke="#453d32"
        strokeWidth={0.6}
      />
      {meses.map((mes, i) => {
        const x = MARGEN.izq + i * anchoBarra;
        const alto = ALTO - MARGEN.inf - y(mes.total);
        return (
          <g key={i}>
            {mes.total > 0 && (
              <>
                <rect
                  x={x + anchoBarra * 0.2}
                  y={y(mes.total)}
                  width={anchoBarra * 0.6}
                  height={alto}
                  rx={1.5}
                  fill={COLOR_BARRA}
                />
                <text
                  x={x + anchoBarra / 2}
                  y={y(mes.total) - 3}
                  textAnchor="middle"
                  fontSize={7.5}
                  fill="#bdd5de"
                >
                  {mes.total}
                </text>
              </>
            )}
            {(i % Math.ceil(meses.length / 6) === 0 || i === meses.length - 1) && (
              <text
                x={x + anchoBarra / 2}
                y={ALTO - 4}
                textAnchor="middle"
                fontSize={7.5}
                fill="#a2967f"
              >
                {mes.etiqueta}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
