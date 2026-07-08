/**
 * Elevación de precisión con el MDT05 del IGN (malla de 5 m, LiDAR PNOA)
 * vía su servicio WCS 2.0, mucho más fiel que las teselas terrarium
 * (EU-DEM/SRTM, ~25-30 m) que usa el terreno 3D del mapa.
 *
 * El servicio se consulta por celdas geográficas (mismo patrón que el
 * caché de teselas terrarium): cada celda es un GeoTIFF pequeño que se
 * descarga una vez, se decodifica y se cachea en memoria y en disco
 * (.cache/mdt05, fuera del repo) para no volver a pedirla entre scripts
 * o relanzamientos.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fromArrayBuffer } from "geotiff";

const WCS = "https://servicios.idee.es/wcs-inspire/mdt";
// Elevación en ETRS89 geográficas (EPSG:4258): mismo datum que nuestras
// coordenadas OSM/GPS, sin reproyectar
const COVERAGE = "Elevacion4258_5";
const CABECERAS = { "User-Agent": "PeakTrail/0.1 (app personal de montanismo; Node.js)" };
// Grados por celda de caché (~2.2 km a estas latitudes)
const CELDA = 0.02;
const DIR_CACHE = path.resolve(".cache/mdt05");

const cacheMemoria = new Map();

function indiceCelda(valor) {
  return Math.floor(valor / CELDA);
}

async function obtenerCelda(ix, iy) {
  const clave = `${ix}_${iy}`;
  if (cacheMemoria.has(clave)) return cacheMemoria.get(clave);

  const rutaDisco = path.join(DIR_CACHE, `${clave}.tif`);
  let tiff = await readFile(rutaDisco).catch(() => null);

  if (!tiff) {
    const lonMin = ix * CELDA;
    const lonMax = lonMin + CELDA;
    const latMin = iy * CELDA;
    const latMax = latMin + CELDA;
    const url =
      `${WCS}?service=WCS&version=2.0.1&request=GetCoverage&coverageid=${COVERAGE}` +
      `&subset=Lat(${latMin.toFixed(6)},${latMax.toFixed(6)})` +
      `&subset=Long(${lonMin.toFixed(6)},${lonMax.toFixed(6)})&format=image/tiff`;

    let ultimoError;
    for (let intento = 1; intento <= 3 && !tiff; intento++) {
      try {
        const r = await fetch(url, { headers: CABECERAS });
        if (!r.ok) throw new Error(`WCS MDT05 devolvió ${r.status}`);
        tiff = Buffer.from(await r.arrayBuffer());
      } catch (error) {
        ultimoError = error;
        await new Promise((res) => setTimeout(res, 2000 * intento));
      }
    }
    if (!tiff) throw ultimoError;

    await mkdir(DIR_CACHE, { recursive: true });
    await writeFile(rutaDisco, tiff);
  }

  const ab = tiff.buffer.slice(tiff.byteOffset, tiff.byteOffset + tiff.byteLength);
  const imagen = await (await fromArrayBuffer(ab)).getImage();
  const datos = (await imagen.readRasters())[0];
  const celda = {
    datos,
    ancho: imagen.getWidth(),
    alto: imagen.getHeight(),
    bbox: imagen.getBoundingBox(), // [lonMin, latMin, lonMax, latMax]
  };
  cacheMemoria.set(clave, celda);
  return celda;
}

/** Elevación (m) del MDT05 en el punto [lng, lat]; null si el punto no tiene dato. */
export async function elevacionMDT05([lng, lat]) {
  const celda = await obtenerCelda(indiceCelda(lng), indiceCelda(lat));
  const [lonMin, latMin, lonMax, latMax] = celda.bbox;
  const px = Math.min(
    celda.ancho - 1,
    Math.max(0, Math.floor(((lng - lonMin) / (lonMax - lonMin)) * celda.ancho)),
  );
  // fila 0 = norte (latMax): la latitud decrece según avanza la fila
  const py = Math.min(
    celda.alto - 1,
    Math.max(0, Math.floor(((latMax - lat) / (latMax - latMin)) * celda.alto)),
  );
  const valor = celda.datos[py * celda.ancho + px];
  // nodata del MDT05 (fuera de España, p. ej. la vertiente francesa del
  // Pirineo): el WCS rellena con 0 en vez de un centinela negativo, y en
  // esta zona ningún punto real está al nivel del mar
  return valor <= 0 ? null : valor;
}

/**
 * Cota de un pico: máximo en una ventana pequeña alrededor del punto
 * mapeado en OSM, que no siempre coincide con el píxel exacto de la
 * cumbre (a 5 m de malla, unos pocos metros de diferencia ya cambian
 * de píxel). radioPx=2 cubre una ventana de ~25 m de lado.
 */
export async function altitudPicoMDT05([lng, lat], radioPx = 2) {
  const celda = await obtenerCelda(indiceCelda(lng), indiceCelda(lat));
  const [lonMin, latMin, lonMax, latMax] = celda.bbox;
  const px = Math.round(((lng - lonMin) / (lonMax - lonMin)) * celda.ancho);
  const py = Math.round(((latMax - lat) / (latMax - latMin)) * celda.alto);
  let max = -Infinity;
  for (let dy = -radioPx; dy <= radioPx; dy++) {
    for (let dx = -radioPx; dx <= radioPx; dx++) {
      const x = px + dx;
      const y = py + dy;
      if (x < 0 || y < 0 || x >= celda.ancho || y >= celda.alto) continue;
      const valor = celda.datos[y * celda.ancho + x];
      if (valor > 0 && valor > max) max = valor;
    }
  }
  return max === -Infinity ? null : max;
}

export function estadisticasCacheMDT05() {
  return { celdasEnMemoria: cacheMemoria.size };
}
