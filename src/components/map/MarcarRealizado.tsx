import { useState } from "react";
import { historialDe, vecesRealizado, type Realizado } from "@/lib/realizados";
import { IconoHecho } from "@/components/icons";

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function fechaLegible(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Compañero del grupo activo, para etiquetarlo como participante al marcar. */
export interface ParticipanteGrupo {
  email: string;
  nombre: string | null;
  /** null hasta que esa persona entra a la app por primera vez tras este hito. */
  uid: string | null;
}

/**
 * Bloque de "lo he hecho" común a las fichas de elemento y de ruta:
 * sin sesión muestra una pista, con sesión permite marcar con fecha, notas,
 * a quién más del grupo etiquetar como participante (si no es individual:
 * cada uno se lleva su propio registro) y si compartirlo con el grupo
 * activo o guardarlo como logro individual (por defecto se comparte; el
 * aviso bajo la casilla deja claro qué va a pasar). Si ya está marcado,
 * enseña el registro (con el historial si se ha repetido más de una vez) y
 * permite desmarcar la repetición más reciente o marcar otra vez.
 */
export function MarcarRealizado({
  realizado,
  puedeMarcar,
  nombreGrupoActivo,
  participantesGrupo,
  onMarcar,
  onDesmarcar,
}: {
  realizado: Realizado | null;
  /** true solo con sesión iniciada (no hace falta pertenecer a un grupo: se puede marcar individual). */
  puedeMarcar: boolean;
  /** Nombre del grupo activo; null/undefined si no hay ninguno (fuerza individual). */
  nombreGrupoActivo?: string | null;
  /** Resto de miembros del grupo activo, para el selector de participantes. */
  participantesGrupo?: ParticipanteGrupo[];
  onMarcar: (
    fecha: string,
    notas: string,
    individual: boolean,
    participantesUid: string[],
  ) => Promise<void>;
  onDesmarcar: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(fechaHoy);
  const [notas, setNotas] = useState("");
  const [individual, setIndividual] = useState(false);
  const [participantes, setParticipantes] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);

  if (!puedeMarcar && !realizado) return null;

  const veces = realizado ? vecesRealizado(realizado) : 0;
  const anteriores = realizado && veces > 1 ? historialDe(realizado).slice(0, -1) : [];

  const banner = realizado && (
    <div className="flex items-start gap-2 rounded border border-pino-500/40 bg-pino-500/10 px-3 py-2">
      <span className="mt-0.5 text-pino-300">
        <IconoHecho width={15} height={15} />
      </span>
      <div className="min-w-0 flex-1 text-xs text-hielo-200">
        <p>
          Realizado el{" "}
          <span className="text-nieve">{fechaLegible(realizado.fecha)}</span>
          {veces > 1 && <span className="text-roca-300"> · {veces} veces</span>}
          {realizado.grupoId === null && (
            <span className="text-roca-300"> · individual</span>
          )}
        </p>
        {anteriores.length > 0 && (
          <p className="mt-0.5 text-roca-300">
            También:{" "}
            {anteriores
              .map((h) => fechaLegible(h.fecha))
              .reverse()
              .join(", ")}
          </p>
        )}
        {realizado.notas && (
          <p className="mt-0.5 text-roca-300">{realizado.notas}</p>
        )}
      </div>
      {puedeMarcar && (
        <button
          type="button"
          onClick={() => onDesmarcar()}
          className="text-xs text-roca-300 underline decoration-roca-500 underline-offset-2 transition-colors hover:text-nieve"
        >
          Desmarcar
        </button>
      )}
    </div>
  );

  if (!puedeMarcar) {
    return <div className="mt-3 space-y-2">{banner}</div>;
  }

  if (!abierto) {
    return (
      <div className="mt-3 space-y-2">
        {banner}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center justify-center gap-2 rounded border border-roca-700 px-3 py-1.5 text-xs text-hielo-300 transition-colors hover:border-roca-500 hover:text-nieve"
        >
          <IconoHecho width={14} height={14} />
          {realizado ? "Marcar otra vez" : "Lo he hecho"}
        </button>
      </div>
    );
  }

  const seGuardaIndividual = individual || !nombreGrupoActivo;

  return (
    <div className="mt-3 space-y-2">
      {banner}
      <form
        className="space-y-2 rounded border border-roca-700 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setGuardando(true);
          try {
            await onMarcar(fecha, notas.trim(), seGuardaIndividual, [...participantes]);
            setAbierto(false);
            setNotas("");
            setIndividual(false);
            setParticipantes(new Set());
          } finally {
            setGuardando(false);
          }
        }}
      >
        <div className="flex items-center gap-2">
          <label
            htmlFor="fecha-realizado"
            className="text-[10px] uppercase tracking-[0.18em] text-roca-300"
          >
            Fecha
          </label>
          <input
            id="fecha-realizado"
            type="date"
            required
            value={fecha}
            max={fechaHoy()}
            onChange={(e) => setFecha(e.target.value)}
            className="flex-1 rounded border border-roca-700 bg-roca-900/70 px-2 py-1 text-xs text-nieve focus:border-ocre-600 focus:outline-none [color-scheme:dark]"
          />
        </div>
        <input
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas (opcional)"
          className="w-full rounded border border-roca-700 bg-roca-900/70 px-2 py-1 text-xs text-nieve placeholder:text-roca-500 focus:border-ocre-600 focus:outline-none"
        />
        {nombreGrupoActivo && (
          <label className="flex items-center gap-2 text-xs text-hielo-200">
            <input
              type="checkbox"
              checked={individual}
              onChange={(e) => setIndividual(e.target.checked)}
              className="accent-ocre-600"
            />
            Marcar como individual (no se comparte con el grupo)
          </label>
        )}
        {!seGuardaIndividual && (participantesGrupo?.length ?? 0) > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
              También lo hicieron
            </p>
            <div className="flex flex-wrap gap-1.5">
              {participantesGrupo!.map((p) => (
                <label
                  key={p.email}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                    p.uid
                      ? "border-roca-700 text-hielo-300"
                      : "border-roca-800 text-roca-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!p.uid}
                    checked={p.uid ? participantes.has(p.uid) : false}
                    onChange={(e) => {
                      if (!p.uid) return;
                      const uid = p.uid;
                      setParticipantes((prev) => {
                        const siguiente = new Set(prev);
                        if (e.target.checked) siguiente.add(uid);
                        else siguiente.delete(uid);
                        return siguiente;
                      });
                    }}
                    className="accent-ocre-600"
                  />
                  {p.nombre ?? p.email}
                  {!p.uid && " (aún no ha entrado a la app)"}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-roca-400">
              Si alguien ya lo tenía marcado, se le añadirá como una repetición más.
            </p>
          </div>
        )}
        <p className="text-[11px] text-roca-400">
          {seGuardaIndividual
            ? "Se guardará como logro individual, solo tuyo."
            : `Se compartirá con «${nombreGrupoActivo}».`}
        </p>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={guardando}
            className="flex-1 rounded bg-ocre-600 px-2 py-1 text-xs text-roca-950 transition-colors hover:bg-ocre-400 disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Marcar como realizado"}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded border border-roca-700 px-2 py-1 text-xs text-hielo-300 transition-colors hover:text-nieve"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
