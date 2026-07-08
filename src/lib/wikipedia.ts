/**
 * Descripción y foto libre desde Wikidata/Wikipedia para los elementos que
 * traen la etiqueta `wikidata` en OSM (Hito 20). Todo gratuito y sin clave:
 * la API de Wikidata resuelve el identificador (QID) al artículo de
 * Wikipedia en el idioma disponible más cercano, y la API REST de esa
 * Wikipedia da el extracto y la imagen de portada (CORS abierto en ambas).
 *
 * Si el artículo encontrado no está en castellano, el extracto se traduce
 * con MyMemory (gratuita, sin clave, CORS abierto) para que toda la app se
 * lea en español; el idioma de origen se conserva en el resultado para
 * mostrar una nota de transparencia ("traducción automática del catalán…")
 * junto al enlace al artículo real. Si la traducción falla, se muestra el
 * extracto original antes que no mostrar nada.
 *
 * Resultado cacheado en memoria por QID.
 */

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const MYMEMORY_API = "https://api.mymemory.translated.net/get";

// Preferencia de idioma: castellano primero, luego las cooficiales del
// Pirineo peninsular (catalán, aranés/occitano, euskera), francés (vertiente
// norte) y por último inglés, antes de rendirse.
const IDIOMAS_PREFERIDOS = ["es", "ca", "oc", "eu", "fr", "en"] as const;

// MyMemory rechaza consultas de más de 500 caracteres (403, "QUERY LENGTH
// LIMIT EXCEEDED"); se deja margen para no rozar el límite exacto.
const MAX_CARACTERES_TRADUCCION = 480;

export interface ResumenWiki {
  titulo: string;
  extracto: string;
  imagenUrl: string | null;
  urlPagina: string;
  /** Idioma del artículo de Wikipedia encontrado (antes de traducir). */
  idioma: string;
  /** true si `extracto` es una traducción automática (idioma !== "es"). */
  traducido: boolean;
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

  const extracto =
    idioma === "es" ? datos.extract : await traducir(datos.extract, idioma);

  return {
    titulo: datos.title,
    extracto,
    imagenUrl: datos.thumbnail?.source ?? null,
    urlPagina:
      datos.content_urls?.desktop?.page ??
      `https://${idioma}.wikipedia.org/wiki/${encodeURIComponent(titulo)}`,
    idioma,
    traducido: idioma !== "es" && extracto !== datos.extract,
  };
}

/** Divide en fragmentos por frase, cada uno dentro del límite de MyMemory. */
function trocearParaTraducir(texto: string, max: number): string[] {
  const oraciones = texto.match(/[^.!?]+[.!?]*\s*/g) ?? [texto];
  const trozos: string[] = [];
  let actual = "";
  for (const oracion of oraciones) {
    if (actual && (actual + oracion).length > max) {
      trozos.push(actual.trim());
      actual = oracion;
    } else {
      actual += oracion;
    }
  }
  if (actual.trim()) trozos.push(actual.trim());
  return trozos;
}

async function traducirTrozo(
  texto: string,
  origen: string,
): Promise<string | null> {
  const url = new URL(MYMEMORY_API);
  url.searchParams.set("q", texto);
  url.searchParams.set("langpair", `${origen}|es`);
  const respuesta = await fetch(url.toString());
  if (!respuesta.ok) return null;
  const datos = await respuesta.json();
  if (datos.responseStatus !== 200 || !datos.responseData?.translatedText) {
    return null;
  }
  return datos.responseData.translatedText;
}

/**
 * Traduce el extracto al castellano trozo a trozo (MyMemory limita cada
 * consulta a 500 caracteres). Si cualquier trozo falla, se descarta la
 * traducción entera y se devuelve el texto original: un resumen a medio
 * traducir, mezclando idiomas, sería peor que dejarlo en el original.
 */
async function traducir(texto: string, origen: string): Promise<string> {
  try {
    const trozos = trocearParaTraducir(texto, MAX_CARACTERES_TRADUCCION);
    const traducidos = await Promise.all(
      trozos.map((t) => traducirTrozo(t, origen)),
    );
    if (traducidos.some((t) => t === null)) return texto;
    return traducidos.join(" ");
  } catch {
    return texto;
  }
}
