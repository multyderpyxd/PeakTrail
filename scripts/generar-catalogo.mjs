/**
 * Genera public/catalogo.json con el catálogo del Pirineo peninsular
 * (Aragón, Navarra y Cataluña, cada zona con su corte de latitud):
 *   - todos los picos con nombre y cota
 *   - collados y puertos de montaña con nombre (la cota es opcional)
 *   - ibones y estanys con nombre (fuera embalses y pantanos)
 *   - refugios de montaña
 * consultando Overpass (OpenStreetMap) y aplicando después los ajustes
 * manuales de data/curados.json.
 *
 * Uso: npm run catalogo:generar
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Comunidades por código ISO (más estable que el nombre) y latitud mínima
// que deja fuera el llano: la zona pirenaica y prepirenaica de cada una.
const ZONAS = [
  { nombre: "Aragón", iso: "ES-AR", latMinima: 42.3 },
  { nombre: "Navarra", iso: "ES-NC", latMinima: 42.6 },
  { nombre: "Cataluña", iso: "ES-CT", latMinima: 42.1 },
];

// Lagos de montaña: ibón (Aragón), estany (Cataluña), estanh (Val d'Aran)
const REGEX_LAGO = "(^|[ '‘])([Ii]b[oó]n|[Ee]stanys?|[Ee]stanh)";
// Masas de agua artificiales que el nombre delata aunque falte water=reservoir
const REGEX_EMBALSE = /embassament|pant[aà]no?\b|embalse|resclosa|dep[oò]sit/i;

function consultaZona(iso) {
  return `
[out:json][timeout:300];
area["ISO3166-2"="${iso}"]["admin_level"="4"]->.zona;
(
  node["natural"="peak"]["name"]["ele"](area.zona);
  node["natural"="saddle"]["name"](area.zona);
  node["mountain_pass"="yes"]["name"](area.zona);
  nwr["tourism"="alpine_hut"]["name"](area.zona);
  nwr["natural"="water"]["name"~"${REGEX_LAGO}"](area.zona);
);
out center tags;
`;
}

function slug(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function altitud(tags) {
  const ele = parseFloat(String(tags.ele ?? "").replace(",", "."));
  return Number.isFinite(ele) ? Math.round(ele) : null;
}

function clasificar(tags) {
  if (tags.natural === "peak") return "pico";
  if (tags.natural === "saddle" || tags.mountain_pass === "yes") return "collado";
  if (tags.tourism === "alpine_hut") return "refugio";
  if (tags.natural === "water") return "ibon";
  return null;
}

async function consultarOverpass(consulta, etiqueta) {
  let ultimoError;
  for (const servidor of SERVIDORES) {
    for (let intento = 1; intento <= 2; intento++) {
      try {
        const respuesta = await fetch(servidor, {
          method: "POST",
          headers: {
            // Overpass rechaza con 406 los user-agents genéricos de librería
            "User-Agent": "PeakTrail/0.1 (app personal de montanismo; Node.js)",
            Accept: "application/json",
          },
          body: new URLSearchParams({ data: consulta }),
        });
        if (!respuesta.ok) {
          throw new Error(`${servidor} devolvió ${respuesta.status}`);
        }
        return (await respuesta.json()).elements;
      } catch (error) {
        ultimoError = error;
        console.warn(`  ${etiqueta}: fallo (${error.message}), reintentando...`);
        await new Promise((r) => setTimeout(r, 15_000));
      }
    }
  }
  throw ultimoError;
}

const porId = new Map();
let procesados = 0;

for (const zona of ZONAS) {
  console.log(`Consultando Overpass: ${zona.nombre} (puede tardar unos minutos)...`);
  const elements = await consultarOverpass(consultaZona(zona.iso), zona.nombre);
  let admitidos = 0;

  for (const el of elements) {
    procesados += 1;
    const tipo = clasificar(el.tags ?? {});
    if (!tipo) continue;

    const nombre = el.tags.name.trim();
    const alt = altitud(el.tags);
    // Los picos entran todos, pero siempre con cota (el filtro de altitud
    // de la interfaz la necesita); en los collados la cota es opcional
    if (tipo === "pico" && alt === null) continue;
    // Los albergues de valle vienen a veces etiquetados como alpine_hut
    if (tipo === "refugio" && /^albergue/i.test(nombre)) continue;
    // Fuera embalses de verdad (por nombre): la etiqueta water=reservoir
    // no sirve de criterio porque también la llevan ibones y estanys de
    // montaña regulados con presa (Ibón de Ip, Estany Gento, Cavallers...)
    if (tipo === "ibon" && REGEX_EMBALSE.test(nombre)) continue;

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined || lat < zona.latMinima) continue;

    // Prefijo por tipo para evitar colisiones entre tipos (hay ibones y picos
    // homónimos), sin duplicarlo si el nombre ya empieza por él
    const base = slug(nombre);
    let id = base.startsWith(`${tipo}-`) ? base : `${tipo}-${base}`;

    // Colisiones de id: si es el mismo lugar (ej. un ibón como way y como
    // relation) nos quedamos con el que aporte altitud; si son lugares
    // homónimos alejados entre sí, desambiguamos con el id de OSM.
    const existente = porId.get(id);
    if (existente) {
      const distancia = Math.hypot(
        existente.coordenadas.lat - lat,
        existente.coordenadas.lng - lng,
      );
      if (distancia > 0.01) id = `${id}-${el.id}`;
      else if (existente.altitud !== null || alt === null) continue;
    }

    porId.set(id, {
      id,
      tipo,
      nombre,
      altitud: alt,
      coordenadas: { lng: +lng.toFixed(6), lat: +lat.toFixed(6) },
      fuente: { origen: "osm", osmTipo: el.type, osmId: el.id },
    });
    admitidos += 1;
  }
  console.log(`  ${zona.nombre}: ${admitidos} elementos admitidos`);
}

// Ajustes curados: descripciones y elementos extra mantenidos a mano
const rutaCurados = path.resolve("data/curados.json");
const curados = JSON.parse(await readFile(rutaCurados, "utf8"));
for (const [id, ajustes] of Object.entries(curados.overrides ?? {})) {
  const el = porId.get(id);
  if (el) Object.assign(el, ajustes);
  else console.warn(`Aviso: override curado sin elemento en OSM: ${id}`);
}
for (const extra of curados.extras ?? []) {
  porId.set(extra.id, { fuente: { origen: "manual" }, ...extra });
}

const orden = { pico: 0, ibon: 1, refugio: 2, collado: 3 };
const elementos = [...porId.values()].sort(
  (a, b) => orden[a.tipo] - orden[b.tipo] || a.nombre.localeCompare(b.nombre, "es"),
);

const totales = { pico: 0, ibon: 0, refugio: 0, collado: 0 };
for (const el of elementos) totales[el.tipo] += 1;

const catalogo = {
  generadoEl: new Date().toISOString(),
  totales,
  elementos,
};

// Minificado: lo descarga el navegador (ya no viaja dentro del bundle JS)
await writeFile("public/catalogo.json", JSON.stringify(catalogo) + "\n");
console.log("Catálogo escrito en public/catalogo.json");
console.log("Totales:", totales, "->", elementos.length, "elementos");
