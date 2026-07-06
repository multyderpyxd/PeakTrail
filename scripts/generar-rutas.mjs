/**
 * Genera public/rutas.json con las rutas de senderismo (GR/PR/SL) del
 * Pirineo aragonés a partir de las relaciones route=hiking de OpenStreetMap
 * dentro de la provincia de Huesca:
 *
 *   1. Descarga las relaciones con geometría por lotes (una petición por red).
 *   2. Cose los tramos (ways) de cada relación en líneas continuas.
 *   3. Muestrea la elevación cada 50 m sobre teselas terrarium (Mapzen/AWS),
 *      la misma fuente que usa el terreno 3D del mapa.
 *   4. Calcula distancia, desniveles (con histéresis de 5 m), altitudes
 *      mínima/máxima y un perfil de elevación compacto.
 *   5. Simplifica la geometría (Douglas-Peucker) para pintarla en el mapa.
 *
 * Uso: npm run rutas:generar
 */

import { writeFile, mkdir } from "node:fs/promises";
import { PNG } from "pngjs";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const CABECERAS = {
  "User-Agent": "PeakTrail/0.1 (app personal de montanismo; Node.js)",
  Accept: "application/json",
};

// Una petición por red para no agotar el tiempo de Overpass
const REDES = [
  ["nwn", "iwn"], // GR de red nacional e internacional (GR-11, HRP...)
  ["rwn"], // PR
  ["lwn"], // SL y senderos locales
];

const PASO_MUESTREO_M = 50;
// Fracción mínima del trazado en la mitad pirenaica (lat >= 42.3): deja fuera
// caminos de larga distancia de tierra baja que solo rozan la provincia
const LATITUD_PIRINEO = 42.3;
const FRACCION_MINIMA_PIRINEO = 0.6;
const ZOOM_DEM = 12;
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

// ---------- elevación (teselas terrarium) ----------

const cacheTeselas = new Map();

async function tesela(z, x, y) {
  const clave = `${z}/${x}/${y}`;
  if (!cacheTeselas.has(clave)) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    const r = await fetch(url, { headers: CABECERAS });
    if (!r.ok) throw new Error(`Tesela DEM ${clave}: ${r.status}`);
    const png = PNG.sync.read(Buffer.from(await r.arrayBuffer()));
    cacheTeselas.set(clave, png);
  }
  return cacheTeselas.get(clave);
}

async function elevacion([lng, lat]) {
  const n = 2 ** ZOOM_DEM;
  const xf = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const png = await tesela(ZOOM_DEM, Math.floor(xf), Math.floor(yf));
  const px = Math.min(255, Math.floor((xf % 1) * 256));
  const py = Math.min(255, Math.floor((yf % 1) * 256));
  const i = (py * 256 + px) * 4;
  const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  return r * 256 + g + b / 256 - 32768;
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

const relaciones = [];
for (const redes of REDES) {
  const filtroRed = redes.map((r) => `"${r}"`).join("|") &&
    `["network"~"^(${redes.join("|")})$"]`;
  const consulta = `
[out:json][timeout:300];
area["boundary"="administrative"]["admin_level"="6"]["name"="Huesca"]->.hu;
relation["route"="hiking"]${filtroRed}(area.hu);
out geom;
`;
  console.log(`Descargando red ${redes.join("+")} de Overpass...`);
  const r = await fetch(OVERPASS, {
    method: "POST",
    headers: CABECERAS,
    body: new URLSearchParams({ data: consulta }),
  });
  if (!r.ok) throw new Error(`Overpass devolvió ${r.status}`);
  const { elements } = await r.json();
  relaciones.push(...elements);
  console.log(`  ${elements.length} relaciones`);
}

const rutas = [];
for (const rel of relaciones) {
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
      muestras.push({ d: distancia, ele: await elevacion(puntos[i]) });
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
  if (rutas.length % 25 === 0) console.log(`  procesadas ${rutas.length} rutas...`);
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
console.log(`Teselas DEM descargadas: ${cacheTeselas.size}`);
