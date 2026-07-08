import { useState } from "react";
import type { User } from "firebase/auth";
import { borrarActividades, sincronizarActividades } from "@/lib/actividades";
import { decodificarPolilinea, emparejarTraza } from "@/lib/emparejar";
import { isFirebaseConfigured, listarPlanes } from "@/lib/planes";
import {
  idRealizado,
  marcarRealizado,
  type Realizado,
} from "@/lib/realizados";
import {
  conectarStrava,
  conexionStrava,
  desconectarStrava,
  stravaConfigurado,
  type ActividadStrava,
} from "@/lib/strava";
import { elementosPorId } from "./elementos";
import type { Ruta } from "@/types/rutas";
import { IconoActividad } from "@/components/icons";

/**
 * Conexión e importación de Strava dentro del panel de progreso. La
 * importación es incremental: las actividades se guardan en una caché local
 * (que alimenta la capa «Mis actividades» del mapa) y a Strava solo se le
 * piden las posteriores a la última sincronización; únicamente las nuevas se
 * emparejan con el catálogo, las rutas y los planes propios.
 */
export function SeccionStrava({
  usuario,
  realizados,
  rutas,
  onActividades,
}: {
  usuario: User;
  realizados: Map<string, Realizado>;
  rutas: Map<string, Ruta> | null;
  onActividades?: (todas: ActividadStrava[]) => void;
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
      const { todas, nuevas } = await sincronizarActividades();
      onActividades?.(todas);
      if (nuevas.length === 0) {
        setEstado(
          "Sin actividades nuevas desde la última importación. La capa «Mis actividades» está en Capas y filtros.",
        );
        return;
      }
      setEstado(`Emparejando ${nuevas.length} actividades nuevas…`);
      const planes = isFirebaseConfigured
        ? await listarPlanes().catch(() => [])
        : [];

      let novedades = 0;
      for (const actividad of nuevas) {
        const traza = decodificarPolilinea(actividad.polilinea!);
        const {
          elementos,
          rutas: rutasCoincidentes,
          planes: planesCoincidentes,
        } = emparejarTraza(
          traza,
          elementosPorId.values(),
          rutas?.values() ?? [],
          planes,
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
          ...planesCoincidentes.map((p) => ({
            tipo: "plan" as const,
            refId: p.id,
            nombre: p.nombre,
            categoria: "plan",
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
        `${nuevas.length} ${nuevas.length === 1 ? "actividad nueva" : "actividades nuevas"} · ${novedades} ${
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
                borrarActividades();
                onActividades?.([]);
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
