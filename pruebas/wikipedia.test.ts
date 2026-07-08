import { afterEach, describe, expect, it, vi } from "vitest";
import { resumenWikidata } from "@/lib/wikipedia";

/** Refleja el qid pedido en la URL (?ids=...), como hace la API real. */
function respuestaSitelinks(url: string, enlaces: Record<string, string>) {
  const qid = new URL(url).searchParams.get("ids")!;
  const sitelinks: Record<string, { title: string }> = {};
  for (const [sitio, titulo] of Object.entries(enlaces)) {
    sitelinks[sitio] = { title: titulo };
  }
  return new Response(
    JSON.stringify({ entities: { [qid]: { sitelinks } } }),
    { status: 200 },
  );
}

function respuestaResumen(datos: Record<string, unknown>) {
  return new Response(JSON.stringify(datos), { status: 200 });
}

/** Traducción mockeada de MyMemory: antepone "ES:" al texto pedido. */
function respuestaTraduccion(url: string) {
  const texto = new URL(url).searchParams.get("q")!;
  return new Response(
    JSON.stringify({
      responseStatus: 200,
      responseData: { translatedText: `ES:${texto}` },
    }),
    { status: 200 },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resumenWikidata", () => {
  it("prefiere el castellano cuando está disponible", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("wikidata.org")) {
        return respuestaSitelinks(u, {
          eswiki: "Pico Aneto",
          cawiki: "Pic d'Aneto",
        });
      }
      if (u.includes("es.wikipedia.org")) {
        return respuestaResumen({
          title: "Pico Aneto",
          extract: "El Aneto es el pico más elevado de los Pirineos.",
          thumbnail: { source: "https://example.org/aneto.jpg" },
          content_urls: { desktop: { page: "https://es.wikipedia.org/wiki/Pico_Aneto" } },
        });
      }
      throw new Error(`URL inesperada: ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await resumenWikidata("Q208081");
    expect(r?.idioma).toBe("es");
    expect(r?.titulo).toBe("Pico Aneto");
    expect(r?.imagenUrl).toBe("https://example.org/aneto.jpg");
    expect(r?.urlPagina).toBe("https://es.wikipedia.org/wiki/Pico_Aneto");
  });

  it("sin sitio en castellano, cae al catalán y traduce el extracto", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("wikidata.org")) {
        return respuestaSitelinks(u, { cawiki: "Puigmal" });
      }
      if (u.includes("ca.wikipedia.org")) {
        return respuestaResumen({
          title: "Puigmal",
          extract: "El Puigmal és una muntanya del Pirineu.",
          content_urls: { desktop: { page: "https://ca.wikipedia.org/wiki/Puigmal" } },
        });
      }
      if (u.includes("mymemory.translated.net")) {
        return respuestaTraduccion(u);
      }
      throw new Error(`URL inesperada: ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await resumenWikidata("Q1-puigmal");
    expect(r?.idioma).toBe("ca");
    expect(r?.titulo).toBe("Puigmal");
    expect(r?.imagenUrl).toBeNull();
    expect(r?.traducido).toBe(true);
    expect(r?.extracto).toBe("ES:El Puigmal és una muntanya del Pirineu.");
  });

  it("el castellano nunca pasa por el traductor (ahorra cuota de MyMemory)", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("wikidata.org")) {
        return respuestaSitelinks(u, { eswiki: "Posets" });
      }
      if (u.includes("es.wikipedia.org")) {
        return respuestaResumen({
          title: "Posets",
          extract: "El Posets es un pico del Pirineo.",
          content_urls: { desktop: { page: "https://es.wikipedia.org/wiki/Posets" } },
        });
      }
      // Cualquier llamada a MyMemory aquí sería un fallo: no hace falta traducir
      throw new Error(`URL inesperada (no debería traducir): ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await resumenWikidata("Q1b-sin-traducir");
    expect(r?.traducido).toBe(false);
    expect(r?.extracto).toBe("El Posets es un pico del Pirineo.");
  });

  it("si la traducción falla, se mantiene el extracto original (mejor que un hueco vacío)", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("wikidata.org")) {
        return respuestaSitelinks(u, { frwiki: "Mont Perdu" });
      }
      if (u.includes("fr.wikipedia.org")) {
        return respuestaResumen({
          title: "Mont Perdu",
          extract: "Le Mont Perdu est un sommet des Pyrénées.",
          content_urls: { desktop: { page: "https://fr.wikipedia.org/wiki/Mont_Perdu" } },
        });
      }
      if (u.includes("mymemory.translated.net")) {
        return new Response("boom", { status: 503 });
      }
      throw new Error(`URL inesperada: ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await resumenWikidata("Q1c-traduccion-caida");
    expect(r?.idioma).toBe("fr");
    expect(r?.traducido).toBe(false);
    expect(r?.extracto).toBe("Le Mont Perdu est un sommet des Pyrénées.");
  });

  it("trocea los extractos largos (límite de MyMemory) y une las traducciones", async () => {
    const frase1 = "A".repeat(300) + ".";
    const frase2 = "B".repeat(300) + ".";
    const extractoLargo = `${frase1} ${frase2}`;
    const peticionesTraduccion: string[] = [];

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("wikidata.org")) {
        return respuestaSitelinks(u, { enwiki: "Long Peak" });
      }
      if (u.includes("en.wikipedia.org")) {
        return respuestaResumen({
          title: "Long Peak",
          extract: extractoLargo,
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Long_Peak" } },
        });
      }
      if (u.includes("mymemory.translated.net")) {
        peticionesTraduccion.push(new URL(u).searchParams.get("q")!);
        return respuestaTraduccion(u);
      }
      throw new Error(`URL inesperada: ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await resumenWikidata("Q1d-extracto-largo");
    // El extracto entero (603 caracteres) supera el límite de MyMemory (500):
    // debe trocearse por frase en dos peticiones, no una sola que fallaría
    expect(peticionesTraduccion).toHaveLength(2);
    for (const trozo of peticionesTraduccion) {
      expect(trozo.length).toBeLessThanOrEqual(480);
    }
    expect(r?.extracto).toBe(`ES:${frase1} ES:${frase2}`);
  });

  it("página de desambiguación: se descarta como si no hubiera resumen", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("wikidata.org")) {
        return respuestaSitelinks(u, { eswiki: "Aneto" });
      }
      return respuestaResumen({
        title: "Aneto",
        type: "disambiguation",
        extract: "Aneto hace referencia a varios artículos.",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await resumenWikidata("Q2-desambiguacion");
    expect(r).toBeNull();
  });

  it("sin sitelinks conocidos: null sin lanzar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) =>
        respuestaSitelinks(String(url), {}),
      ),
    );
    const r = await resumenWikidata("Q3-sin-sitios");
    expect(r).toBeNull();
  });

  it("Wikidata caído: null sin lanzar (contenido opcional, no bloquea la ficha)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 503 })),
    );
    await expect(resumenWikidata("Q4-wikidata-caido")).resolves.toBeNull();
  });

  it("Wikipedia caída tras resolver el sitio: null sin lanzar", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("wikidata.org")) {
        return respuestaSitelinks(u, { eswiki: "Monte Perdido" });
      }
      return new Response("boom", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      resumenWikidata("Q5-wikipedia-caida"),
    ).resolves.toBeNull();
  });

  it("resultados en caché: una sola petición de red para el mismo QID", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("wikidata.org")) {
        return respuestaSitelinks(u, { eswiki: "Posets" });
      }
      return respuestaResumen({
        title: "Posets",
        extract: "El Posets es el segundo pico más alto del Pirineo.",
        content_urls: { desktop: { page: "https://es.wikipedia.org/wiki/Posets" } },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const qid = "Q6-cache";
    await resumenWikidata(qid);
    await resumenWikidata(qid);
    expect(fetchMock).toHaveBeenCalledTimes(2); // sitelinks + resumen, una sola vez
  });
});
