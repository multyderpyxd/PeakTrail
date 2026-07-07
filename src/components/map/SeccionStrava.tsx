import { useState } from "react";
import type { User } from "firebase/auth";
import { decodificarPolilinea, emparejarTraza } from "@/lib/emparejar";
import {
  idRealizado,
  marcarRealizado,
  type Realizado,
} from "@/lib/realizados";
import {
  conectarStrava,
  conexionStrava,
  DEPORTES_MONTANA,
  desconectarStrava,
  obtenerActividades,
  stravaConfigurado,
} from "@/lib/strava";
import { elementosPorId } from "./elementos";
import type { Ruta } from "@/types/rutas";
import { IconoActividad } from "@/components/icons";

/**
 * Conexión e importación de Strava dentro del panel de progreso: descarga
 * las actividades del usuario, las empareja geográficamente con el catálogo
 * y marca como realizados los elementos y rutas que coincidan.
 */
export function SeccionStrava({
  usuario,
  realizados,
  rutas,
}: {
  usuario: User;
  realizados: Map<string, Realizado>;
  rutas: Map<string, Ruta> | null;
}) {
  const [conexion, setConexion] = useState(conexionStrava);
  const [estado, setEstado] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  if (!stravaConfigurado) return null;

  async function importar() {
    if (importando) return;
    setImportando(true);
    try {
      setEstado("Descargando actividades…");
      const actividades = await obtenerActividades();
      const conTraza = actividades.filter(
        (a) => a.polilinea && DEPORTES_MONTANA.has(a.deporte),
      );
      setEstado(`Emparejando ${conTraza.length} actividades…`);

      let novedades = 0;
      for (const actividad of conTraza) {
        const traza = decodificarPolilinea(actividad.polilinea!);
        const { elementos, rutas: rutasCoincidentes } = emparejarTraza(
          traza,
          elementosPorId.values(),
          rutas?.values() ?? [],
        );
        const nuevos: Array<{
          tipo: Realizado["tipo"];
          refId: string;
          nombre: string;
          categoria: string;
        }> = [
          ...elementos.map((el) => ({
            tipo: "elemento" as const,
            refId: el.id,
            nombre: el.nombre,
            categoria: el.tipo,
          })),
          ...rutasCoincidentes.map((r) => ({
            tipo: "ruta" as const,
            refId: r.id,
            nombre: r.nombre,
            categoria: r.red,
          })),
        ];
        for (const nuevo of nuevos) {
          if (realizados.has(idRealizado(usuario.uid, nuevo.tipo, nuevo.refId)))
            continue;
          await marcarRealizado({
            usuario: usuario.uid,
            nombreUsuario: usuario.displayName ?? usuario.email ?? "Anónimo",
            ...nuevo,
            fecha: actividad.fecha,
            notas: `Strava: ${actividad.nombre}`,
          });
          novedades += 1;
        }
      }
      setEstado(
        `${conTraza.length} actividades revisadas · ${novedades} ${
          novedades === 1 ? "novedad marcada" : "novedades marcadas"
        }`,
      );
    } catch (e) {
      setEstado(e instanceof Error ? e.message : "La importación falló");
      setConexion(conexionStrava());
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="border-t border-roca-800 pt-3">
      <h3 className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
        Strava
      </h3>
      {conexion ? (
        <>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-hielo-300">
              <IconoActividad width={15} height={15} />
            </span>
            <span className="min-w-0 flex-1 truncate text-hielo-200">
              {conexion.atleta || "Conectado"}
            </span>
            <button
              type="button"
              onClick={() => {
                desconectarStrava();
                setConexion(null);
                setEstado(null);
              }}
              className="text-roca-300 underline decoration-roca-500 underline-offset-2 transition-colors hover:text-nieve"
            >
              Desconectar
            </button>
          </div>
          <button
            type="button"
            disabled={importando || !rutas}
            onClick={importar}
            className="mt-2 w-full rounded bg-ocre-600 px-2.5 py-1.5 text-xs text-roca-950 transition-colors hover:bg-ocre-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {importando ? "Importando…" : "Importar actividades"}
          </button>
          {estado && <p className="mt-2 text-xs text-roca-300">{estado}</p>}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={conectarStrava}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-roca-700 px-2.5 py-1.5 text-xs text-hielo-200 transition-colors hover:border-roca-500 hover:text-nieve"
          >
            <IconoActividad width={14} height={14} />
            Conectar con Strava
          </button>
          <p className="mt-1.5 text-[11px] leading-relaxed text-roca-300">
            Tus salidas marcarán solos los picos, collados, ibones, refugios y rutas
            por los que pasaste.
          </p>
        </>
      )}
    </div>
  );
}
