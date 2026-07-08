/**
 * Elevación de respaldo con teselas terrarium (Mapzen/AWS Open Data,
 * cobertura europea) para los tramos que el MDT05 del IGN no cubre por no
 * ser territorio español: rutas transfronterizas como el HRP, el GR-10 o
 * variantes que cruzan al lado francés del Pirineo.
 */

import { PNG } from "pngjs";

const CABECERAS = { "User-Agent": "PeakTrail/0.1 (app personal de montanismo; Node.js)" };
const ZOOM_DEM = 12;

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

export async function elevacionTerrarium([lng, lat]) {
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
