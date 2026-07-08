import { useEffect, useState } from "react";
import { borrarPack, listarPacks, type PackDescarga } from "@/lib/descargas";
import { IconoCerrar, IconoPapelera } from "@/components/icons";

const ETIQUETA_TIPO: Record<PackDescarga["tipo"], string> = {
  ruta: "Ruta",
  actividad: "Salida",
  plan: "Plan",
};

function formatoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

/**
 * Gestión de las descargas "para sin cobertura": lista de packs de teselas
 * (rutas/planes/salidas) guardados en Cache Storage, con su tamaño
 * aproximado y borrado individual. `navigator.storage.estimate()` da una
 * referencia de cuota real del dispositivo, no solo lo que ocupan los packs.
 */
export function PanelDescargas({ onCerrar }: { onCerrar: () => void }) {
  const [packs, setPacks] = useState<PackDescarga[]>(() => listarPacks());
  const [cuota, setCuota] = useState<{ uso: number; cuota: number } | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) =>
        setCuota({ uso: e.usage ?? 0, cuota: e.quota ?? 0 }),
      )
      .catch(() => setCuota(null));
  }, [packs]);

  async function eliminar(id: string) {
    setBorrando(id);
    try {
      await borrarPack(id);
      setPacks(listarPacks());
    } finally {
      setBorrando(null);
    }
  }

  return (
    <section
      aria-label="Descargas para sin cobertura"
      className="absolute left-4 top-33 flex max-h-[calc(100dvh-10rem)] w-96 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-roca-700 bg-roca-950/90 shadow-lg shadow-roca-950/60"
    >
      <header className="flex items-center gap-3 border-b border-roca-800 p-4 pb-3">
        <h2 className="min-w-0 flex-1 font-display text-lg leading-tight text-nieve">
          Descargas
        </h2>
        <button
          type="button"
          aria-label="Cerrar descargas"
          onClick={onCerrar}
          className="-m-1 p-1 text-hielo-300 transition-colors hover:text-nieve"
        >
          <IconoCerrar width={18} height={18} />
        </button>
      </header>

      <div className="overflow-y-auto p-4">
        <p className="text-xs text-roca-300">
          Guarda una ruta, plan o salida para consultarla sin cobertura en el
          monte, con el botón «Descargar para sin cobertura» de su ficha.
        </p>

        {cuota && cuota.cuota > 0 && (
          <p className="mt-2 text-[11px] text-roca-400">
            {formatoBytes(cuota.uso)} usados de {formatoBytes(cuota.cuota)}{" "}
            disponibles en este dispositivo.
          </p>
        )}

        {packs.length === 0 ? (
          <p className="mt-3 text-[11px] text-roca-400">
            Todavía no has descargado nada.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {packs.map((pack) => (
              <li
                key={pack.id}
                className="flex items-center gap-2 rounded border border-roca-800 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-hielo-100">{pack.nombre}</p>
                  <p className="text-[11px] text-roca-400">
                    {ETIQUETA_TIPO[pack.tipo]} · {formatoBytes(pack.bytesAprox)} ·{" "}
                    {fechaCorta(pack.creadoEl)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Borrar descarga de ${pack.nombre}`}
                  disabled={borrando === pack.id}
                  onClick={() => eliminar(pack.id)}
                  className="p-1 text-roca-400 transition-colors hover:text-nieve disabled:opacity-40"
                >
                  <IconoPapelera width={14} height={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
