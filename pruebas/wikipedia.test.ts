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

  it("sin sitio en castellano, cae al catalán", async () => {
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
      throw new Error(`URL inesperada: ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await resumenWikidata("Q1-puigmal");
    expect(r?.idioma).toBe("ca");
    expect(r?.titulo).toBe("Puigmal");
    expect(r?.imagenUrl).toBeNull();
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
