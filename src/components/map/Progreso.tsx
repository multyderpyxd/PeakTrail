import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { Comunidad } from "@/types/catalogo";
import type { Realizado } from "@/lib/realizados";
import type { ActividadStrava } from "@/lib/strava";
import { expulsar, invitar, listarInvitados, type Invitado } from "@/lib/invitados";
import type { Ruta } from "@/types/rutas";
import { SeccionStrava } from "./SeccionStrava";
import { elementosPorId, TOTALES } from "./elementos";
import { COLOR_TIPO } from "./marcadores";
import { GraficoActividad, type CuboMensual } from "./GraficoActividad";
import {
  IconoCerrar,
  IconoCollado,
  IconoDespliegue,
  IconoHecho,
  IconoIbon,
  IconoPapelera,
  IconoPico,
  IconoRefugio,
  IconoTrazar,
} from "@/components/icons";

/** Bandas de altitud de los picos: mismos cortes que el deslizador del panel de capas. */
const BANDAS_ALTITUD = [
  { min: 0, max: 2000, etiqueta: "< 2.000 m" },
  { min: 2000, max: 2500, etiqueta: "2.000–2.499 m" },
  { min: 2500, max: 3000, etiqueta: "2.500–2.999 m" },
  { min: 3000, max: Infinity, etiqueta: "≥ 3.000 m" },
] as const;

/**
 * Reparto por comunidad autónoma; el desglose más fino por comarcas queda
 * apuntado en notas-mejoras.md como mejora sustancial pendiente.
 */
const COMUNIDADES: { clave: Comunidad; etiqueta: string }[] = [
  { clave: "aragon", etiqueta: "Aragón" },
  { clave: "navarra", etiqueta: "Navarra" },
  { clave: "cataluna", etiqueta: "Cataluña" },
];

function bandaDe(altitud: number): number {
  return BANDAS_ALTITUD.findIndex((b) => altitud >= b.min && altitud < b.max);
}

function BarraProgreso({
  etiqueta,
  hechos,
  total,
  color,
}: {
  etiqueta: string;
  hechos: number;
  total: number;
  color: string;
}) {
  return (
    <li>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-hielo-200">{etiqueta}</span>
        <span className="text-roca-300">
          <span className="font-display text-sm text-nieve">{hechos}</span> de{" "}
          {total}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-roca-800">
        <div
          className="h-full rounded-full"
          style={{
            width: `${total > 0 ? Math.min(100, (hechos / total) * 100) : 0}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </li>
  );
}

/**
 * Sección plegable: cabecera con título (+ un resumen opcional visible ya
 * cerrada) que se pliega/despliega, para no dejar el panel entero como un
 * único div largo con todas las filas y porcentajes a la vez.
 */
function Desplegable({
  titulo,
  resumen,
  abiertoInicial = false,
  primero = false,
  children,
}: {
  titulo: string;
  resumen?: string;
  abiertoInicial?: boolean;
  /** La primera sección del panel no lleva línea separadora por encima. */
  primero?: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <div className={primero ? "" : "border-t border-roca-800 pt-3"}>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
          {titulo}
        </span>
        <span className="flex items-center gap-1.5 text-roca-400">
          {resumen && <span className="text-[11px]">{resumen}</span>}
          <IconoDespliegue
            width={12}
            height={12}
            className={`transition-transform ${abierto ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {abierto && <div className="mt-2">{children}</div>}
    </div>
  );
}

/**
 * Reparto por comunidad: en vez de listar las barras de todas a la vez, se
 * elige una (pestañas) y solo se ve el detalle de esa. Preparado para que el
 * Hito 22 anide comarcas dentro de la comunidad elegida con el mismo patrón.
 */
function PorComunidad({
  totales,
  hechos,
}: {
  totales: Record<Comunidad, number>;
  hechos: Record<Comunidad, number>;
}) {
  const [seleccion, setSeleccion] = useState<Comunidad>(COMUNIDADES[0].clave);
  const actual = COMUNIDADES.find((c) => c.clave === seleccion)!;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {COMUNIDADES.map(({ clave, etiqueta }) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={seleccion === clave}
            onClick={() => setSeleccion(clave)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              seleccion === clave
                ? "border-ocre-600 bg-ocre-600/20 text-ocre-200"
                : "border-roca-700 text-hielo-300 hover:text-nieve"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      <ul className="mt-2.5 space-y-2">
        <BarraProgreso
          etiqueta={actual.etiqueta}
          hechos={hechos[seleccion]}
          total={totales[seleccion]}
          color="#7fa8b8"
        />
      </ul>
    </div>
  );
}

function Pendiente({
  icono,
  numero,
  etiqueta,
}: {
  icono: React.ReactNode;
  numero: number;
  etiqueta: string;
}) {
  return (
    <div className="rounded border border-roca-700 bg-roca-900/70 px-2 py-1.5 text-center">
      <span className="mx-auto flex h-5 w-5 items-center justify-center text-roca-300">
        {icono}
      </span>
      <p className="font-display text-lg leading-none text-nieve">{numero}</p>
      <p className="mt-0.5 text-[9px] uppercase leading-tight tracking-widest text-roca-300">
        {etiqueta}
      </p>
    </div>
  );
}

function Invitaciones({ emailPropio }: { emailPropio: string }) {
  const [invitados, setInvitados] = useState<Invitado[] | null>(null);
  const [correo, setCorreo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    listarInvitados().then(setInvitados).catch(() => setError(true));
  }, []);

  async function anadir(e: React.FormEvent) {
    e.preventDefault();
    const email = correo.trim().toLowerCase();
    if (!email.includes("@") || ocupado) return;
    setOcupado(true);
    try {
      await invitar(email);
      setCorreo("");
      setInvitados(await listarInvitados());
    } catch {
      setError(true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="border-t border-roca-800 pt-3">
      <h3 className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
        Invitaciones
      </h3>
      {error && (
        <p className="mt-2 text-xs text-ocre-400">
          No se pudo acceder a la lista (¿permisos de las reglas?).
        </p>
      )}
      <ul className="mt-2 space-y-1">
        {invitados?.map((inv) => (
          <li key={inv.email} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-hielo-200">
              {inv.email}
              {inv.admin && <span className="ml-1.5 text-roca-300">admin</span>}
            </span>
            {inv.email !== emailPropio && (
              <button
                type="button"
                aria-label={`Expulsar a ${inv.email}`}
                onClick={async () => {
                  await expulsar(inv.email).catch(() => setError(true));
                  setInvitados(await listarInvitados().catch(() => invitados));
                }}
                className="p-1 text-roca-400 transition-colors hover:text-nieve"
              >
                <IconoPapelera width={13} height={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={anadir} className="mt-2 flex gap-2">
        <input
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="correo@ejemplo.com"
          className="min-w-0 flex-1 rounded border border-roca-700 bg-roca-900/70 px-2 py-1 text-xs text-nieve placeholder:text-roca-500 focus:border-ocre-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={ocupado}
          className="rounded bg-ocre-600 px-2.5 py-1 text-xs text-roca-950 transition-colors hover:bg-ocre-400 disabled:opacity-40"
        >
          Invitar
        </button>
      </form>
    </div>
  );
}

const FILAS_PERSONALES = [
  { categoria: "pico", etiqueta: "Picos" },
  { categoria: "collado", etiqueta: "Collados" },
  { categoria: "ibon", etiqueta: "Ibones" },
  { categoria: "refugio", etiqueta: "Refugios" },
] as const;

export function Progreso({
  realizados,
  usuario,
  esInvitado,
  esAdmin,
  rutas,
  totalRutas,
  onCerrar,
  onActividades,
}: {
  realizados: Map<string, Realizado>;
  usuario: User | null;
  esInvitado: boolean;
  esAdmin: boolean;
  rutas: Map<string, Ruta> | null;
  totalRutas: number;
  onCerrar: () => void;
  onActividades?: (todas: ActividadStrava[]) => void;
}) {
  const { propios, rutasPropias, hechosPorBanda, grupo } = useMemo(() => {
    const propios: Record<string, number> = { pico: 0, collado: 0, ibon: 0, refugio: 0 };
    const hechosPorBanda = BANDAS_ALTITUD.map(() => 0);
    let rutasPropias = 0;
    const grupo = new Map<string, { nombre: string; total: number; picos: number }>();
    for (const r of realizados.values()) {
      const datos = grupo.get(r.usuario) ?? {
        nombre: r.nombreUsuario,
        total: 0,
        picos: 0,
      };
      datos.total += 1;
      if (r.categoria === "pico") datos.picos += 1;
      grupo.set(r.usuario, datos);
      if (usuario && r.usuario === usuario.uid) {
        if (r.tipo === "ruta") {
          rutasPropias += 1;
        } else {
          propios[r.categoria] = (propios[r.categoria] ?? 0) + 1;
          if (r.categoria === "pico") {
            const altitud = elementosPorId.get(r.refId)?.altitud;
            const banda = altitud !== undefined && altitud !== null ? bandaDe(altitud) : -1;
            if (banda !== -1) hechosPorBanda[banda] += 1;
          }
        }
      }
    }
    return {
      propios,
      rutasPropias,
      hechosPorBanda,
      grupo: [...grupo.values()].sort(
        (a, b) => b.picos - a.picos || b.total - a.total,
      ),
    };
  }, [realizados, usuario]);

  // Totales por banda de altitud: se recorre el catálogo una sola vez
  const totalesPorBanda = useMemo(() => {
    const totales = BANDAS_ALTITUD.map(() => 0);
    for (const el of elementosPorId.values()) {
      if (el.tipo !== "pico" || el.altitud === null) continue;
      const banda = bandaDe(el.altitud);
      if (banda !== -1) totales[banda] += 1;
    }
    return totales;
  }, []);

  // Actividad del grupo por mes, últimos doce
  const meses = useMemo<CuboMensual[]>(() => {
    const ahora = new Date();
    const claves: string[] = [];
    const cubos: CuboMensual[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      claves.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      cubos.push({ etiqueta: d.toLocaleDateString("es-ES", { month: "short" }), total: 0 });
    }
    const indice = new Map(claves.map((clave, i) => [clave, i]));
    for (const r of realizados.values()) {
      const i = indice.get(r.fecha.slice(0, 7));
      if (i !== undefined) cubos[i].total += 1;
    }
    return cubos;
  }, [realizados]);

  const tresmilesPendientes =
    totalesPorBanda[BANDAS_ALTITUD.length - 1] -
    hechosPorBanda[BANDAS_ALTITUD.length - 1];

  // Resúmenes de una cifra para mostrar junto al título aunque la sección esté cerrada
  const totalPropiosGeneral =
    Object.values(propios).reduce((a, b) => a + b, 0) + rutasPropias;
  const totalPendientesGeneral =
    tresmilesPendientes +
    (TOTALES.collado - (propios.collado ?? 0)) +
    (TOTALES.ibon - (propios.ibon ?? 0)) +
    (TOTALES.refugio - (propios.refugio ?? 0)) +
    (totalRutas - rutasPropias);

  // Elementos y rutas de cada comunidad, y cuántos lleva hechos el usuario
  const { totalesPorComunidad, hechosPorComunidad } = useMemo(() => {
    const totales: Record<Comunidad, number> = { aragon: 0, navarra: 0, cataluna: 0 };
    for (const el of elementosPorId.values()) {
      if (el.comunidad) totales[el.comunidad] += 1;
    }
    for (const ruta of rutas?.values() ?? []) {
      if (ruta.comunidad) totales[ruta.comunidad] += 1;
    }

    const hechos: Record<Comunidad, number> = { aragon: 0, navarra: 0, cataluna: 0 };
    if (usuario) {
      for (const r of realizados.values()) {
        if (r.usuario !== usuario.uid) continue;
        const comunidad =
          r.tipo === "elemento"
            ? elementosPorId.get(r.refId)?.comunidad
            : rutas?.get(r.refId)?.comunidad;
        if (comunidad) hechos[comunidad] += 1;
      }
    }
    return { totalesPorComunidad: totales, hechosPorComunidad: hechos };
  }, [realizados, usuario, rutas]);

  return (
    <section
      aria-label="Progreso del grupo"
      className="absolute left-4 top-33 max-h-[calc(100dvh-10rem)] w-88 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-roca-700 bg-roca-950/90 shadow-lg shadow-roca-950/60"
    >
      <header className="flex items-center gap-3 border-b border-roca-800 p-4">
        <h2 className="min-w-0 flex-1 font-display text-lg leading-tight text-nieve">
          Progreso
        </h2>
        <button
          type="button"
          aria-label="Cerrar progreso"
          onClick={onCerrar}
          className="-m-1 p-1 text-hielo-300 transition-colors hover:text-nieve"
        >
          <IconoCerrar width={18} height={18} />
        </button>
      </header>

      <div className="space-y-4 p-4">
        {usuario ? (
          <>
            <Desplegable
              titulo="Lo mío"
              resumen={`${totalPropiosGeneral} hechos`}
              abiertoInicial
              primero
            >
              <ul className="space-y-2">
                {FILAS_PERSONALES.map(({ categoria, etiqueta }) => (
                  <BarraProgreso
                    key={categoria}
                    etiqueta={etiqueta}
                    hechos={propios[categoria] ?? 0}
                    total={TOTALES[categoria]}
                    color={COLOR_TIPO[categoria as keyof typeof COLOR_TIPO]}
                  />
                ))}
                <BarraProgreso
                  etiqueta="Rutas"
                  hechos={rutasPropias}
                  total={totalRutas}
                  color="#3f92c9"
                />
              </ul>
            </Desplegable>

            <Desplegable titulo="Por comunidad">
              <PorComunidad totales={totalesPorComunidad} hechos={hechosPorComunidad} />
            </Desplegable>

            <Desplegable titulo="Picos por altitud">
              <ul className="space-y-2">
                {BANDAS_ALTITUD.map((banda, i) => (
                  <BarraProgreso
                    key={banda.etiqueta}
                    etiqueta={banda.etiqueta}
                    hechos={hechosPorBanda[i]}
                    total={totalesPorBanda[i]}
                    color={COLOR_TIPO.pico}
                  />
                ))}
              </ul>
            </Desplegable>

            <Desplegable titulo="Pendientes" resumen={`${totalPendientesGeneral}`}>
              <div className="grid grid-cols-3 gap-2">
                <Pendiente
                  icono={<IconoPico width={16} height={16} />}
                  numero={tresmilesPendientes}
                  etiqueta="Tresmiles"
                />
                <Pendiente
                  icono={<IconoCollado width={16} height={16} />}
                  numero={TOTALES.collado - (propios.collado ?? 0)}
                  etiqueta="Collados"
                />
                <Pendiente
                  icono={<IconoIbon width={16} height={16} />}
                  numero={TOTALES.ibon - (propios.ibon ?? 0)}
                  etiqueta="Ibones"
                />
                <Pendiente
                  icono={<IconoRefugio width={16} height={16} />}
                  numero={TOTALES.refugio - (propios.refugio ?? 0)}
                  etiqueta="Refugios"
                />
                <Pendiente
                  icono={<IconoTrazar width={16} height={16} />}
                  numero={totalRutas - rutasPropias}
                  etiqueta="Rutas"
                />
              </div>
            </Desplegable>
          </>
        ) : (
          <p className="text-xs text-roca-300">
            Entra con tu cuenta para ver tu progreso.
          </p>
        )}

        <Desplegable titulo="Evolución del grupo">
          <p className="text-xs text-roca-300">
            Actividades marcadas por mes, último año
          </p>
          <div className="mt-2">
            <GraficoActividad meses={meses} />
          </div>
        </Desplegable>

        <Desplegable
          titulo="El grupo"
          resumen={grupo.length > 0 ? `${grupo.length} personas` : undefined}
        >
          {grupo.length === 0 ? (
            <p className="text-xs text-roca-300">
              Nadie ha marcado nada todavía.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {grupo.map((miembro, i) => (
                <li
                  key={miembro.nombre + i}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="w-4 text-right font-display text-roca-300">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-hielo-200">
                    {miembro.nombre}
                  </span>
                  <span className="flex items-center gap-1 text-roca-300">
                    <span className="font-display text-sm text-nieve">
                      {miembro.picos}
                    </span>
                    picos
                  </span>
                  <span className="flex items-center gap-1 text-roca-300">
                    <IconoHecho width={12} height={12} />
                    {miembro.total}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Desplegable>

        {usuario && esInvitado && (
          <SeccionStrava
            usuario={usuario}
            realizados={realizados}
            rutas={rutas}
            onActividades={onActividades}
          />
        )}

        {esAdmin && usuario?.email && (
          <Invitaciones emailPropio={usuario.email.toLowerCase()} />
        )}
      </div>
    </section>
  );
}
