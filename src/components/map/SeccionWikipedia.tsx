import { useEffect, useState } from "react";
import { resumenWikidata, type ResumenWiki } from "@/lib/wikipedia";
import { useConexion } from "@/lib/conexion";

const ETIQUETA_IDIOMA: Record<string, string> = {
  ca: "catalán",
  oc: "occitano",
  eu: "euskera",
  fr: "francés",
  en: "inglés",
};

/**
 * Descripción y foto libre de Wikipedia para los elementos con etiqueta
 * `wikidata` en OSM (Hito 20). Si no hay artículo aprovechable (o el
 * elemento no trae la etiqueta) no se renderiza nada: es contenido extra,
 * no un hueco vacío en la ficha.
 */
export function SeccionWikipedia({ wikidata }: { wikidata?: string }) {
  const [resumen, setResumen] = useState<ResumenWiki | null | undefined>(
    undefined,
  );
  const enLinea = useConexion();

  useEffect(() => {
    if (!wikidata || !enLinea) {
      setResumen(null);
      return;
    }
    let cancelado = false;
    setResumen(undefined);
    resumenWikidata(wikidata)
      .then((r) => {
        if (!cancelado) setResumen(r);
      })
      .catch(() => {
        if (!cancelado) setResumen(null);
      });
    return () => {
      cancelado = true;
    };
  }, [wikidata, enLinea]);

  if (!wikidata || resumen === null) return null;
  if (resumen === undefined) {
    return (
      <p className="text-xs text-roca-300">Cargando descripción…</p>
    );
  }

  return (
    <div className="space-y-2 border-t border-roca-800 pt-3">
      {resumen.imagenUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resumen.imagenUrl}
          alt={resumen.titulo}
          className="max-h-48 w-full rounded object-cover"
        />
      )}
      <p className="text-sm leading-relaxed text-hielo-200">
        {resumen.extracto}
      </p>
      <p className="text-xs text-roca-300">
        {resumen.traducido && (
          <>Traducción automática del {ETIQUETA_IDIOMA[resumen.idioma]} · </>
        )}
        {!resumen.traducido && resumen.idioma !== "es" && (
          <>En {ETIQUETA_IDIOMA[resumen.idioma]} (no se pudo traducir) · </>
        )}
        <a
          href={resumen.urlPagina}
          target="_blank"
          rel="noreferrer"
          className="text-hielo-300 underline decoration-roca-500 underline-offset-2 hover:text-nieve"
        >
          Leer en Wikipedia
        </a>
      </p>
    </div>
  );
}
