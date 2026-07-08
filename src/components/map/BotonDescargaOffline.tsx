"use client";

import { useState } from "react";
import { borrarPack, descargarPack, listarPacks, type PackDescarga } from "@/lib/descargas";
import { IconoDescargaOffline, IconoPapelera } from "@/components/icons";

/**
 * Botón "Descargar para sin cobertura" de una ruta/plan/actividad: calcula y
 * cachea las teselas de su corredor (src/lib/teselas.ts + descargas.ts). Una
 * vez descargado, se convierte en "Quitar descarga" para borrarlo desde la
 * propia ficha sin tener que abrir el panel de Descargas.
 */
export function BotonDescargaOffline({
  id,
  nombre,
  tipo,
  linea,
}: {
  id: string;
  nombre: string;
  tipo: PackDescarga["tipo"];
  linea: [number, number][];
}) {
  const [descargado, setDescargado] = useState(() =>
    listarPacks().some((p) => p.id === id),
  );
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(
    null,
  );
  const [descargando, setDescargando] = useState(false);

  if (linea.length < 2) return null;

  async function descargar() {
    setDescargando(true);
    setProgreso(null);
    try {
      await descargarPack({ id, nombre, tipo, linea }, setProgreso);
      setDescargado(true);
    } finally {
      setDescargando(false);
      setProgreso(null);
    }
  }

  async function quitar() {
    await borrarPack(id);
    setDescargado(false);
  }

  if (descargando) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-roca-300">
        <IconoDescargaOffline width={13} height={13} />
        Descargando…{progreso ? ` ${progreso.hechas}/${progreso.total} teselas` : ""}
      </span>
    );
  }

  if (descargado) {
    return (
      <button
        type="button"
        onClick={quitar}
        className="flex items-center gap-1.5 rounded-full border border-ocre-600 bg-ocre-600/20 px-2.5 py-1 text-[11px] text-ocre-200 transition-colors hover:text-nieve"
      >
        <IconoPapelera width={13} height={13} />
        Quitar descarga
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={descargar}
      className="flex items-center gap-1.5 rounded-full border border-roca-700 px-2.5 py-1 text-[11px] text-hielo-300 transition-colors hover:text-nieve"
    >
      <IconoDescargaOffline width={13} height={13} />
      Descargar para sin cobertura
    </button>
  );
}
