import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { Realizado } from "@/lib/realizados";
import { expulsar, invitar, listarInvitados, type Invitado } from "@/lib/invitados";
import type { Ruta } from "@/types/rutas";
import { SeccionStrava } from "./SeccionStrava";
import { TOTALES } from "./elementos";
import { COLOR_TIPO } from "./marcadores";
import { IconoCerrar, IconoHecho, IconoPapelera } from "@/components/icons";

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
}: {
  realizados: Map<string, Realizado>;
  usuario: User | null;
  esInvitado: boolean;
  esAdmin: boolean;
  rutas: Map<string, Ruta> | null;
  totalRutas: number;
  onCerrar: () => void;
}) {
  const { propios, rutasPropias, grupo } = useMemo(() => {
    const propios: Record<string, number> = { pico: 0, collado: 0, ibon: 0, refugio: 0 };
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
        if (r.tipo === "ruta") rutasPropias += 1;
        else propios[r.categoria] = (propios[r.categoria] ?? 0) + 1;
      }
    }
    return {
      propios,
      rutasPropias,
      grupo: [...grupo.values()].sort(
        (a, b) => b.picos - a.picos || b.total - a.total,
      ),
    };
  }, [realizados, usuario]);

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
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
              Lo mío
            </h3>
            <ul className="mt-2 space-y-2">
              {FILAS_PERSONALES.map(({ categoria, etiqueta }) => {
                const hechos = propios[categoria] ?? 0;
                const total = TOTALES[categoria];
                return (
                  <li key={categoria}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-hielo-200">{etiqueta}</span>
                      <span className="text-roca-300">
                        <span className="font-display text-sm text-nieve">
                          {hechos}
                        </span>{" "}
                        de {total}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-roca-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (hechos / total) * 100)}%`,
                          backgroundColor:
                            COLOR_TIPO[categoria as keyof typeof COLOR_TIPO],
                        }}
                      />
                    </div>
                  </li>
                );
              })}
              <li className="flex items-baseline justify-between text-xs">
                <span className="text-hielo-200">Rutas</span>
                <span className="text-roca-300">
                  <span className="font-display text-sm text-nieve">
                    {rutasPropias}
                  </span>{" "}
                  de {totalRutas}
                </span>
              </li>
            </ul>
          </div>
        ) : (
          <p className="text-xs text-roca-300">
            Entra con tu cuenta para ver tu progreso.
          </p>
        )}

        <div className="border-t border-roca-800 pt-3">
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
            El grupo
          </h3>
          {grupo.length === 0 ? (
            <p className="mt-2 text-xs text-roca-300">
              Nadie ha marcado nada todavía.
            </p>
          ) : (
            <ol className="mt-2 space-y-1.5">
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
        </div>

        {usuario && esInvitado && (
          <SeccionStrava usuario={usuario} realizados={realizados} rutas={rutas} />
        )}

        {esAdmin && usuario?.email && (
          <Invitaciones emailPropio={usuario.email.toLowerCase()} />
        )}
      </div>
    </section>
  );
}
