import { useState } from "react";
import { IconoCompartir, IconoHecho } from "@/components/icons";

/**
 * Copia al portapapeles un enlace directo a la ficha (misma página con el
 * parámetro de selección). Cambia a confirmación durante unos segundos.
 */
export function BotonCompartir({ query }: { query: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const url = `${window.location.origin}${window.location.pathname}?${query}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Navegadores sin permiso de portapapeles: respaldo con prompt
      window.prompt("Copia el enlace:", url);
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label="Copiar enlace a esta ficha"
      className="flex shrink-0 items-center gap-1 rounded-full border border-roca-700 px-2 py-1 text-[11px] text-hielo-300 transition-colors hover:text-nieve"
    >
      {copiado ? (
        <IconoHecho width={13} height={13} />
      ) : (
        <IconoCompartir width={13} height={13} />
      )}
      {copiado ? "Copiado" : "Compartir"}
    </button>
  );
}
