/**
 * Genera data/catalogo.json con el catálogo inicial del Pirineo aragonés:
 *   - picos de 3.000 m o más (tresmiles)
 *   - ibones con nombre
 *   - refugios de montaña
 * consultando Overpass (OpenStreetMap) dentro de la provincia de Huesca,
 * y aplicando después los ajustes manuales de data/curados.json.
 *
 * Uso: npm run catalogo:generar
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OVERPASS = "https://overpass-api.de/api/interpreter";

// Solo la mitad pirenaica de la provincia (fuera Guara y el llano).
const LATITUD_MINIMA = 42.3;

const CONSULTA = `
[out:json][timeout:120];
area["boundary"="administrative"]["admin_level"="6"]["name"="Huesca"]->.huesca;
(
  node["natural"="peak"]["name"]["ele"](area.huesca);
  nwr["tourism"="alpine_hut"]["name"](area.huesca);
  nwr["natural"="water"]["name"~"[Ii]b[oó]n"](area.huesca);
);
out center tags;
`;

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
  if (tags.tourism === "alpine_hut") return "refugio";
  if (tags.natural === "water") return "ibon";
  return null;
}

console.log("Consultando Overpass (puede tardar un minuto)...");
const respuesta = await fetch(OVERPASS, {
  method: "POST",
  headers: {
    // Overpass rechaza con 406 los user-agents genéricos de librería
    "User-Agent": "PeakTrail/0.1 (app personal de montanismo; Node.js)",
    Accept: "application/json",
  },
  body: new URLSearchParams({ data: CONSULTA }),
});
if (!respuesta.ok) {
  throw new Error(`Overpass devolvió ${respuesta.status}: ${await respuesta.text()}`);
}
const { elements } = await respuesta.json();

const porId = new Map();
for (const el of elements) {
  const tipo = clasificar(el.tags ?? {});
  if (!tipo) continue;

  const nombre = el.tags.name.trim();
  const alt = altitud(el.tags);
  if (tipo === "pico" && (alt === null || alt < 3000)) continue;
  // Los albergues de valle vienen a veces etiquetados como alpine_hut
  if (tipo === "refugio" && /^albergue/i.test(nombre)) continue;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat === undefined || lng === undefined || lat < LATITUD_MINIMA) continue;

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

await mkdir("data", { recursive: true });
await writeFile("data/catalogo.json", JSON.stringify(catalogo, null, 2) + "\n");
console.log("Catálogo escrito en data/catalogo.json");
console.log("Totales:", totales, "->", elementos.length, "elementos");
