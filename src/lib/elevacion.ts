/**
 * Muestreo de elevación en el navegador sobre las teselas terrarium
 * (Mapzen/AWS), las mismas que alimentan el terreno 3D del mapa. Réplica
 * en cliente del muestreo que hace scripts/generar-rutas.mjs en Node.
 */

const ZOOM = 12;
const PASO_MUESTREO_M = 50;
const UMBRAL_DESNIVEL_M = 5;
const MAX_PUNTOS_PERFIL = 220;

const cacheTeselas = new Map<string, Promise<ImageData>>();

function obtenerTesela(x: number, y: number): Promise<ImageData> {
  const clave = `${x}/${y}`;
  let promesa = cacheTeselas.get(clave);
  if (!promesa) {
    promesa = (async () => {
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${x}/${y}.png`;
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error(`Tesela de elevación ${clave}: ${respuesta.status}`);
      const imagen = await createImageBitmap(await respuesta.blob());
      const lienzo = document.createElement("canvas");
      lienzo.width = lienzo.height = 256;
      const ctx = lienzo.getContext("2d")!;
      ctx.drawImage(imagen, 0, 0);
      return ctx.getImageData(0, 0, 256, 256);
    })();
    cacheTeselas.set(clave, promesa);
    promesa.catch(() => cacheTeselas.delete(clave));
  }
  return promesa;
}

export async function elevacionEn([lng, lat]: [number, number]): Promise<number> {
  const n = 2 ** ZOOM;
  const xf = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const datos = await obtenerTesela(Math.floor(xf), Math.floor(yf));
  const px = Math.min(255, Math.floor((xf % 1) * 256));
  const py = Math.min(255, Math.floor((yf % 1) * 256));
  const i = (py * 256 + px) * 4;
  return datos.data[i] * 256 + datos.data[i + 1] + datos.data[i + 2] / 256 - 32768;
}

const R_TIERRA = 6371000;
function haversine([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(a));
}

function remuestrear(linea: [number, number][], paso: number): [number, number][] {
  const puntos: [number, number][] = [linea[0]];
  let restante = paso;
  for (let i = 1; i < linea.length; i++) {
    let previo = linea[i - 1];
    const actual = linea[i];
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

export interface MetricasLinea {
  distanciaKm: number;
  desnivelPos: number;
  desnivelNeg: number;
  altMin: number;
  altMax: number;
  perfil: [number, number][];
}

export async function medirLinea(
  linea: [number, number][],
): Promise<MetricasLinea> {
  const puntos = remuestrear(linea, PASO_MUESTREO_M);
  const elevaciones = await Promise.all(puntos.map(elevacionEn));

  let distancia = 0;
  const muestras = puntos.map((p, i) => {
    if (i > 0) distancia += haversine(puntos[i - 1], p);
    return { d: distancia, ele: elevaciones[i] };
  });

  const suave = muestras.map((m, i) => ({
    d: m.d,
    ele:
      (muestras[Math.max(0, i - 1)].ele +
        m.ele +
        muestras[Math.min(muestras.length - 1, i + 1)].ele) /
      3,
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
    .map((m) => [+(m.d / 1000).toFixed(2), Math.round(m.ele)] as [number, number]);

  return {
    distanciaKm: +(distancia / 1000).toFixed(1),
    desnivelPos: Math.round(pos),
    desnivelNeg: Math.round(neg),
    altMin: Math.round(Math.min(...suave.map((m) => m.ele))),
    altMax: Math.round(Math.max(...suave.map((m) => m.ele))),
    perfil,
  };
}
