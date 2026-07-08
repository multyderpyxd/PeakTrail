/**
 * Geometría compartida entre el muestreo de elevación (elevacion.ts) y el
 * cálculo de teselas a descargar para sin cobertura (teselas.ts): ambos
 * necesitan remuestrear una línea a un paso fijo y convertir lng/lat a
 * coordenadas de tesela.
 */

const R_TIERRA = 6371000;

export function haversine(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(a));
}

export function remuestrear(
  linea: [number, number][],
  paso: number,
): [number, number][] {
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

/** Coordenadas de tesela (fraccionarias, en rejilla web mercator) de un punto a un zoom dado. */
export function teselaFraccional(
  [lng, lat]: [number, number],
  zoom: number,
): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x, y };
}
