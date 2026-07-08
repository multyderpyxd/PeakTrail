/**
 * Genera public/rutas.json con las rutas de senderismo (GR/PR/SL) del
 * Pirineo peninsular a partir de las relaciones route=hiking de
 * OpenStreetMap dentro de Aragón, Navarra y Cataluña:
 *
 *   1. Descarga las relaciones con geometría por zona (una petición por
 *      comunidad; la misma relación puede salir de varias si cruza el
 *      límite administrativo, de ahí la deduplicación por id).
 *   2. Cose los tramos (ways) de cada relación en líneas continuas.
 *   3. Muestrea la elevación cada 50 m con el MDT05 del IGN (malla de 5 m,
 *      LiDAR), más fiel que las teselas terrarium que usa el terreno 3D
 *      del mapa (pensadas para el relieve visual, no para métricas).
 *   4. Calcula distancia, desniveles (con histéresis de 5 m), altitudes
 *      mínima/máxima y un perfil de elevación compacto.
 *   5. Simplifica la geometría (Douglas-Peucker) para pintarla en el mapa.
 *
 * Uso: npm run rutas:generar
 */

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { consultarOverpass, ZONAS_PIRINEO } from "./overpass.mjs";
import { elevacionMDT05, estadisticasCacheMDT05 } from "./mdt05.mjs";
import { elevacionTerrarium } from "./terrarium.mjs";

// Punto de control: el entorno de desarrollo puede reiniciarse a mitad de
// una generación larga (cientos de rutas, miles de puntos muestreados). Se
// guarda el progreso aquí para poder reanudar sin repetir el trabajo ya
// hecho; se borra al terminar con éxito.
const CHECKPOINT = ".cache/rutas-parciales.json";

const PASO_MUESTREO_M = 50;
// Fracción mínima del trazado en la mitad pirenaica: deja fuera caminos de
// larga distancia de tierra baja que solo rozan la zona. Se usa el corte
// más permisivo de las tres comunidades (Cataluña) porque el propio recorte
// geográfico ya lo hace cada consulta por zona.
const LATITUD_PIRINEO = Math.min(...ZONAS_PIRINEO.map((z) => z.latMinima));
const FRACCION_MINIMA_PIRINEO = 0.6;
const TOLERANCIA_SIMPLIFICACION = 0.00025; // ~25 m
const MAX_PUNTOS_PERFIL = 220;
const UMBRAL_DESNIVEL_M = 5;

// ---------- utilidades geométricas ----------

const R_TIERRA = 6371000;
function haversine([lng1, lat1], [lng2, lat2]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(a));
}

function douglasPeucker(puntos, tolerancia) {
  if (puntos.length <= 2) return puntos;
  let maxDist = 0;
  let indice = 0;
  const [a, b] = [puntos[0], puntos[puntos.length - 1]];
  for (let i = 1; i < puntos.length - 1; i++) {
    const p = puntos[i];
    // distancia perpendicular aproximada en grados (suficiente a esta escala)
    const num = Math.abs(
      (b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1]),
    );
    const den = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-12;
    const d = num / den;
    if (d > maxDist) {
      maxDist = d;
      indice = i;
    }
  }
  if (maxDist <= tolerancia) return [puntos[0], puntos[puntos.length - 1]];
  return [
    ...douglasPeucker(puntos.slice(0, indice + 1), tolerancia).slice(0, -1),
    ...douglasPeucker(puntos.slice(indice), tolerancia),
  ];
}

// ---------- cosido de tramos ----------

function mismasCoordenadas(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

/** Une los ways de una relación en el menor número de líneas continuas. */
function coserTramos(tramos) {
  const pendientes = tramos.filter((t) => t.length > 1);
  const partes = [];
  while (pendientes.length) {
    let cadena = pendientes.shift();
    let crecio = true;
    while (crecio) {
      crecio = false;
      for (let i = 0; i < pendientes.length; i++) {
        const t = pendientes[i];
        const inicio = cadena[0];
        const fin = cadena[cadena.length - 1];
        if (mismasCoordenadas(fin, t[0])) cadena = [...cadena, ...t.slice(1)];
        else if (mismasCoordenadas(fin, t[t.length - 1]))
          cadena = [...cadena, ...t.slice(0, -1).reverse()];
        else if (mismasCoordenadas(inicio, t[t.length - 1]))
          cadena = [...t.slice(0, -1), ...cadena];
        else if (mismasCoordenadas(inicio, t[0]))
          cadena = [...t.slice(1).reverse(), ...cadena];
        else continue;
        pendientes.splice(i, 1);
        crecio = true;
        break;
      }
    }
    partes.push(cadena);
  }
  // de mayor a menor longitud: la parte principal primero
  return partes.sort((a, b) => b.length - a.length);
}

/** Remuestrea una línea a puntos equidistantes (~paso metros). */
function remuestrear(linea, paso) {
  const puntos = [linea[0]];
  let restante = paso;
  for (let i = 1; i < linea.length; i++) {
    let [previo, actual] = [linea[i - 1], linea[i]];
    let d = haversine(previo, actual);
    while (d >= restante) {
      const f = restante / d;
      previo = [
        previo[0] + (actual[0] - previo[0]) * f,
        previo[1] + (actual[1] - previo[1]) * f,
      ];
      puntos.push(previo);
      d -= restante;
      restante = paso;
    }
    restante -= d;
  }
  puntos.push(linea[linea.length - 1]);
  return puntos;
}

// ---------- clasificación ----------

function redDeRuta(tags) {
  const ref = (tags.ref ?? "").toUpperCase();
  if (ref.startsWith("GR") || tags.network === "nwn" || tags.network === "iwn")
    return "gr";
  if (ref.startsWith("PR") || tags.network === "rwn") return "pr";
  if (ref.startsWith("SL") || tags.network === "lwn") return "sl";
  return "sl";
}

// ---------- proceso principal ----------

const CACHE_RELACIONES = ".cache/rutas-relaciones.json";

// Zonas grandes (Cataluña) hacen que la consulta completa supere el tiempo
// de espera de Overpass; se trocea por red igual que antes de ampliar a
// las tres comunidades, y cada trozo se guarda en cuanto llega para no
// repetir los que ya hayan tenido éxito si el proceso se corta.
const GRUPOS_RED = [
  ["nwn", "iwn"], // GR de red nacional e internacional (GR-11, HRP...)
  ["rwn"], // PR
  ["lwn"], // SL y senderos locales
];

const relacionesPorId = new Map();
const trozosHechos = new Set();
const cacheRelaciones = await readFile(CACHE_RELACIONES, "utf8").catch(() => null);
if (cacheRelaciones) {
  const datos = JSON.parse(cacheRelaciones);
  for (const rel of datos.relaciones) relacionesPorId.set(rel.id, rel);
  for (const t of datos.trozosHechos) trozosHechos.add(t);
  console.log(
    `Relaciones de Overpass recuperadas de caché: ${relacionesPorId.size} (${trozosHechos.size} trozos ya hechos)`,
  );
}

async function guardarCacheRelaciones() {
  await mkdir(".cache", { recursive: true });
  await writeFile(
    CACHE_RELACIONES,
    JSON.stringify({
      relaciones: [...relacionesPorId.values()],
      trozosHechos: [...trozosHechos],
    }),
  );
}

for (const zona of ZONAS_PIRINEO) {
  for (const redes of GRUPOS_RED) {
    const clave = `${zona.iso}:${redes.join("+")}`;
    if (trozosHechos.has(clave)) continue;

    const consulta = `
[out:json][timeout:300];
area["ISO3166-2"="${zona.iso}"]["admin_level"="4"]->.zona;
relation["route"="hiking"]["network"~"^(${redes.join("|")})$"](area.zona);
out geom;
`;
    console.log(`Descargando rutas de Overpass: ${zona.nombre} (${redes.join("+")})...`);
    const elements = await consultarOverpass(consulta, `${zona.nombre} ${redes.join("+")}`);
    for (const rel of elements) relacionesPorId.set(rel.id, rel);
    trozosHechos.add(clave);
    console.log(`  ${elements.length} relaciones`);
    await guardarCacheRelaciones();
  }
}
const relaciones = [...relacionesPorId.values()];

// Retoma un punto de control si lo hay: relaciones ya evaluadas en una
// ejecución anterior (tanto las que dieron ruta como las descartadas) se
// saltan sin volver a muestrear su elevación.
let rutas = [];
const vistas = new Set();
const checkpoint = await readFile(CHECKPOINT, "utf8").catch(() => null);
if (checkpoint) {
  const datos = JSON.parse(checkpoint);
  rutas = datos.rutas;
  for (const id of datos.vistas) vistas.add(id);
  console.log(
    `Retomando punto de control: ${rutas.length} rutas y ${vistas.size} relaciones ya evaluadas`,
  );
}

async function guardarCheckpoint() {
  await mkdir(".cache", { recursive: true });
  await writeFile(CHECKPOINT, JSON.stringify({ rutas, vistas: [...vistas] }));
}

// El entorno puede reiniciarse con un SIGTERM (no un fallo del proceso):
// guardar el progreso antes de que se corte de verdad.
let guardando = null;
for (const senal of ["SIGTERM", "SIGINT"]) {
  process.on(senal, () => {
    if (guardando) return;
    console.warn(`\n${senal} recibida: guardando punto de control antes de salir...`);
    guardando = guardarCheckpoint().finally(() => process.exit(0));
  });
}

let contador = 0;
for (const rel of relaciones) {
  if (vistas.has(rel.id)) continue;
  vistas.add(rel.id);
  contador += 1;
  if (contador % 20 === 0) await guardarCheckpoint();
  try {
    const tags = rel.tags ?? {};
    // los contenedores (super-relaciones) se saltan: sus etapas ya vienen sueltas
    const contieneRelaciones = (rel.members ?? []).some((m) => m.type === "relation");
    const tramos = (rel.members ?? [])
      .filter(
        (m) =>
          m.type === "way" &&
          m.geometry &&
          !["alternative", "excursion", "approach", "connection"].includes(m.role),
      )
      .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
    if (contieneRelaciones || !tramos.length) continue;
    if (!tags.name && !tags.ref) continue;

    const partes = coserTramos(tramos);

    // muestreo de elevación sobre las partes concatenadas
    const muestras = [];
    const muestrasLat = [];
    let distancia = 0;
    for (const parte of partes) {
      const puntos = remuestrear(parte, PASO_MUESTREO_M);
      for (let i = 0; i < puntos.length; i++) {
        if (i > 0) distancia += haversine(puntos[i - 1], puntos[i]);
        // Fuera de España (rutas transfronterizas como el HRP o el GR-10)
        // el MDT05 no tiene dato: se recurre a terrarium para ese punto
        const ele =
          (await elevacionMDT05(puntos[i])) ?? (await elevacionTerrarium(puntos[i]));
        muestras.push({ d: distancia, ele });
        muestrasLat.push(puntos[i][1]);
      }
    }
    if (muestras.length < 2) continue;

    const enPirineo =
      muestrasLat.filter((lat) => lat >= LATITUD_PIRINEO).length / muestrasLat.length;
    if (enPirineo < FRACCION_MINIMA_PIRINEO) continue;

    // suavizado (media móvil de 3) y desniveles con histéresis
    const suave = muestras.map((m, i) => ({
      d: m.d,
      ele:
        (muestras[Math.max(0, i - 1)].ele + m.ele + muestras[Math.min(muestras.length - 1, i + 1)].ele) / 3,
    }));
    let [pos, neg] = [0, 0];
    let referencia = suave[0].ele;
    for (const m of suave) {
      const delta = m.ele - referencia;
      if (delta >= UMBRAL_DESNIVEL_M) {
        pos += delta;
        referencia = m.ele;
      } else if (delta <= -UMBRAL_DESNIVEL_M) {
        neg -= delta;
        referencia = m.ele;
      }
    }

    const salto = Math.max(1, Math.ceil(suave.length / MAX_PUNTOS_PERFIL));
    const perfil = suave
      .filter((_, i) => i % salto === 0 || i === suave.length - 1)
      .map((m) => [+(m.d / 1000).toFixed(2), Math.round(m.ele)]);

    rutas.push({
      id: `osm-${rel.id}`,
      ref: tags.ref ?? null,
      nombre: tags.name ?? tags.ref,
      red: redDeRuta(tags),
      distanciaKm: +(distancia / 1000).toFixed(1),
      desnivelPos: Math.round(pos),
      desnivelNeg: Math.round(neg),
      altMin: Math.round(Math.min(...suave.map((m) => m.ele))),
      altMax: Math.round(Math.max(...suave.map((m) => m.ele))),
      perfil,
      partes: partes.map((p) =>
        douglasPeucker(p, TOLERANCIA_SIMPLIFICACION).map(([lng, lat]) => [
          +lng.toFixed(5),
          +lat.toFixed(5),
        ]),
      ),
      fuente: { origen: "osm", osmTipo: "relation", osmId: rel.id },
    });
    if (rutas.length % 25 === 0) {
      console.log(`  procesadas ${rutas.length} rutas... (${estadisticasCacheMDT05().celdasEnMemoria} celdas MDT05 en caché)`);
    }
  } catch (error) {
    console.warn(`  Aviso: ruta ${rel.tags?.name ?? rel.id} falló (${error.message}), se descarta`);
  }
}

rutas.sort((a, b) => (a.ref ?? a.nombre).localeCompare(b.ref ?? b.nombre, "es"));

await mkdir("public", { recursive: true });
await writeFile(
  "public/rutas.json",
  JSON.stringify({ generadoEl: new Date().toISOString(), rutas }),
);
const porRed = {};
for (const r of rutas) porRed[r.red] = (porRed[r.red] ?? 0) + 1;
console.log(`Escritas ${rutas.length} rutas en public/rutas.json`, porRed);
console.log("Caché MDT05:", estadisticasCacheMDT05());

// Generación completa: los puntos de control ya no hacen falta
await Promise.all([
  rm(CHECKPOINT, { force: true }),
  rm(CACHE_RELACIONES, { force: true }),
]);
