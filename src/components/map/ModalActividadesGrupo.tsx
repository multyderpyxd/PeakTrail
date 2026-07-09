import { useMemo, useState } from "react";
import type { Realizado } from "@/lib/realizados";
import { COLOR_TIPO } from "./marcadores";
import { COLOR_RED } from "./rutas";
import {
  IconoBuscar,
  IconoCerrar,
  IconoCollado,
  IconoIbon,
  IconoPico,
  IconoRefugio,
  IconoTrazar,
} from "@/components/icons";

const ICONO_TIPO = {
  pico: IconoPico,
  ibon: IconoIbon,
  refugio: IconoRefugio,
  collado: IconoCollado,
} as const;

const COLOR_NEUTRO = "#7fa8b8";

function iconoYColor(r: Realizado) {
  if (r.tipo === "elemento") {
    const Icono = ICONO_TIPO[r.categoria as keyof typeof ICONO_TIPO] ?? IconoTrazar;
    const color = COLOR_TIPO[r.categoria as keyof typeof COLOR_TIPO] ?? COLOR_NEUTRO;
    return { Icono, color };
  }
  if (r.tipo === "ruta") {
    return {
      Icono: IconoTrazar,
      color: COLOR_RED[r.categoria as keyof typeof COLOR_RED] ?? COLOR_NEUTRO,
    };
  }
  return { Icono: IconoTrazar, color: COLOR_NEUTRO };
}

function fechaCorta(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

interface Actividad {
  clave: string;
  muestra: Realizado;
  nombre: string;
  ultimaFecha: string;
  participantes: { nombre: string; fecha: string }[];
}

/**
 * Ventana de actividades del grupo: en vez de un ranking por persona, una
 * lista de cada elemento/ruta que ha hecho el grupo con quién participó en
 * cada uno. Sustituye al desplegable "El grupo" (que solo mostraba
 * persona+total).
 */
export function ModalActividadesGrupo({
  realizadosGrupo,
  nombreGrupo,
  onCerrar,
}: {
  realizadosGrupo: Map<string, Realizado>;
  nombreGrupo?: string | null;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");

  const { actividades, resumenPersonas } = useMemo(() => {
    const porClave = new Map<
      string,
      { muestra: Realizado; nombre: string; participantes: { nombre: string; fecha: string }[] }
    >();
    const porPersona = new Map<string, number>();
    for (const r of realizadosGrupo.values()) {
      const clave = `${r.tipo}__${r.refId}`;
      const entrada = porClave.get(clave) ?? { muestra: r, nombre: r.nombre, participantes: [] };
      entrada.participantes.push({ nombre: r.nombreUsuario, fecha: r.fecha });
      porClave.set(clave, entrada);
      porPersona.set(r.nombreUsuario, (porPersona.get(r.nombreUsuario) ?? 0) + 1);
    }
    const actividades: Actividad[] = [...porClave.entries()].map(([clave, a]) => ({
      clave,
      muestra: a.muestra,
      nombre: a.nombre,
      participantes: a.participantes.sort((x, y) => (x.fecha < y.fecha ? 1 : -1)),
      ultimaFecha: a.participantes.reduce((max, p) => (p.fecha > max ? p.fecha : max), ""),
    }));
    actividades.sort((a, b) => (a.ultimaFecha < b.ultimaFecha ? 1 : -1));
    const resumenPersonas = [...porPersona.entries()].sort((a, b) => b[1] - a[1]);
    return { actividades, resumenPersonas };
  }, [realizadosGrupo]);

  const visibles = texto.trim()
    ? actividades.filter((a) =>
        a.nombre.toLowerCase().includes(texto.trim().toLowerCase()),
      )
    : actividades;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-roca-950/80 p-4"
      role="dialog"
      aria-label={`Actividades de ${nombreGrupo ?? "el grupo"}`}
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[85vh] w-120 max-w-full flex-col overflow-hidden rounded-lg border border-roca-700 bg-roca-950 shadow-lg shadow-roca-950/60"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-roca-800 p-4">
          <h2 className="min-w-0 flex-1 font-display text-lg leading-tight text-nieve">
            Actividades de {nombreGrupo ?? "el grupo"}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="-m-1 p-1 text-hielo-300 transition-colors hover:text-nieve"
          >
            <IconoCerrar width={18} height={18} />
          </button>
        </header>

        {resumenPersonas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-roca-800 p-4 pt-3">
            {resumenPersonas.map(([nombre, total]) => (
              <span
                key={nombre}
                className="rounded-full border border-roca-700 px-2.5 py-1 text-[11px] text-hielo-300"
              >
                {nombre} <span className="text-nieve">{total}</span>
              </span>
            ))}
          </div>
        )}

        <div className="border-b border-roca-800 p-4 pb-3">
          <div className="flex items-center gap-2 rounded border border-roca-700 bg-roca-900/70 px-2.5 py-1.5">
            <IconoBuscar width={14} height={14} className="text-roca-400" />
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Filtrar por nombre…"
              className="min-w-0 flex-1 bg-transparent text-xs text-nieve placeholder:text-roca-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-y-auto p-4">
          {visibles.length === 0 ? (
            <p className="text-xs text-roca-300">
              {actividades.length === 0
                ? "El grupo no ha marcado nada todavía."
                : "Nada coincide con el filtro."}
            </p>
          ) : (
            <ul className="space-y-2">
              {visibles.map((a) => {
                const { Icono, color } = iconoYColor(a.muestra);
                return (
                  <li
                    key={a.clave}
                    className="rounded border border-roca-800 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2"
                        style={{ borderColor: color, color }}
                      >
                        <Icono width={14} height={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-hielo-100">
                        {a.nombre}
                      </span>
                    </div>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5 pl-9">
                      {a.participantes.map((p, i) => (
                        <li
                          key={p.nombre + i}
                          className="rounded-full border border-roca-700 px-2 py-0.5 text-[11px] text-roca-300"
                        >
                          <span className="text-hielo-200">{p.nombre}</span>{" "}
                          {fechaCorta(p.fecha)}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
