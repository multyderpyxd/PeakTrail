/**
 * Descripción y foto libre desde Wikidata/Wikipedia para los elementos que
 * traen la etiqueta `wikidata` en OSM (Hito 20). Todo gratuito y sin clave:
 * la API de Wikidata resuelve el identificador (QID) al artículo de
 * Wikipedia en el idioma disponible más cercano, y la API REST de esa
 * Wikipedia da el extracto y la imagen de portada (CORS abierto en ambas).
 * Resultado cacheado en memoria por QID.
 */

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

// Preferencia de idioma: castellano primero, luego las cooficiales del
// Pirineo peninsular (catalán, aranés/occitano, euskera), francés (vertiente
// norte) y por último inglés, antes de rendirse.
const IDIOMAS_PREFERIDOS = ["es", "ca", "oc", "eu", "fr", "en"] as const;

export interface ResumenWiki {
  titulo: string;
  extracto: string;
  imagenUrl: string | null;
  urlPagina: string;
  idioma: string;
}

const cache = new Map<string, Promise<ResumenWiki | null>>();

export function resumenWikidata(qid: string): Promise<ResumenWiki | null> {
  let promesa = cache.get(qid);
  if (!promesa) {
    promesa = obtenerResumen(qid);
    cache.set(qid, promesa);
    promesa.catch(() => cache.delete(qid));
  }
  return promesa;
}

// Contenido opcional: cualquier fallo de red o de la API (Wikidata caída,
// timeout, formato inesperado) se traduce en "sin resumen", nunca en una
// excepción que pueda tumbar la ficha del elemento.
async function obtenerResumen(qid: string): Promise<ResumenWiki | null> {
  try {
    const sitelinks = await sitelinksDe(qid);
    if (!sitelinks) return null;

    for (const idioma of IDIOMAS_PREFERIDOS) {
      const titulo = sitelinks[`${idioma}wiki`];
      if (!titulo) continue;
      const resumen = await resumenDePagina(idioma, titulo);
      if (resumen) return resumen;
    }
    return null;
  } catch {
    return null;
  }
}

async function sitelinksDe(
  qid: string,
): Promise<Record<string, string> | null> {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", qid);
  url.searchParams.set("props", "sitelinks");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const respuesta = await fetch(url.toString());
  if (!respuesta.ok) return null;
  const datos = await respuesta.json();
  const enlaces: Record<string, { title: string }> | undefined =
    datos.entities?.[qid]?.sitelinks;
  if (!enlaces) return null;

  const titulos: Record<string, string> = {};
  for (const [sitio, valor] of Object.entries(enlaces)) {
    titulos[sitio] = valor.title;
  }
  return titulos;
}

async function resumenDePagina(
  idioma: string,
  titulo: string,
): Promise<ResumenWiki | null> {
  const url = `https://${idioma}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    titulo,
  )}`;
  const respuesta = await fetch(url);
  if (!respuesta.ok) return null;
  const datos = await respuesta.json();
  // Páginas de desambiguación o sin extracto real no aportan nada útil
  if (!datos.extract || datos.type === "disambiguation") return null;

  return {
    titulo: datos.title,
    extracto: datos.extract,
    imagenUrl: datos.thumbnail?.source ?? null,
    urlPagina:
      datos.content_urls?.desktop?.page ??
      `https://${idioma}.wikipedia.org/wiki/${encodeURIComponent(titulo)}`,
    idioma,
  };
}
