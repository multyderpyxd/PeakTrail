import type { Ruta } from "@/types/rutas";

/**
 * Métricas derivadas de una ruta: tiempo estimado de marcha (función de
 * Tobler aplicada por tramos al perfil de elevación) y valoración MIDE
 * estimada automáticamente. Al depender del perfil, ambas responden al
 * sentido de la marcha (una ruta invertida da otro tiempo y otro esfuerzo).
 */

/** Velocidad de marcha de Tobler (km/h) para una pendiente dh/dx. */
function velocidadTobler(pendiente: number): number {
  return 6 * Math.exp(-3.5 * Math.abs(pendiente + 0.05));
}

export function tiempoEstimadoHoras(perfil: [number, number][]): number {
  let horas = 0;
  for (let i = 1; i < perfil.length; i++) {
    const dxKm = perfil[i][0] - perfil[i - 1][0];
    if (dxKm <= 0) continue;
    // Pendiente acotada a ±50%: los saltos de altitud entre tramos
    // discontinuos del trazado darían velocidades casi nulas y el
    // tiempo se dispararía (p. ej. 6,6e+29 h)
    const pendiente = Math.max(
      -0.5,
      Math.min(0.5, (perfil[i][1] - perfil[i - 1][1]) / 1000 / dxKm),
    );
    horas += dxKm / velocidadTobler(pendiente);
  }
  return horas;
}

export function formatearHoras(horas: number): string {
  const totalMin = Math.round((horas * 60) / 5) * 5;
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (!h) return `${min} min`;
  return min ? `${h} h ${min} min` : `${h} h`;
}

export interface Mide {
  medio: number;
  itinerario: number;
  desplazamiento: number;
  esfuerzo: number;
}

/**
 * Estimación automática de la valoración MIDE (1-5 por apartado).
 * El esfuerzo sigue la escala oficial por horas de marcha efectiva; medio,
 * itinerario y desplazamiento son heurísticas prudentes para senderos
 * balizados GR/PR/SL, afinadas con la altitud alcanzada. Es orientativa:
 * la ficha lo declara como estimación.
 */
export function midePorRuta(ruta: Ruta, horas: number): Mide {
  return {
    medio: ruta.altMax >= 2800 ? 4 : ruta.altMax >= 2200 ? 3 : 2,
    itinerario: 2, // sendas señalizadas con marcas de continuidad
    desplazamiento: ruta.altMax >= 2400 ? 3 : 2,
    esfuerzo: horas < 1 ? 1 : horas < 3 ? 2 : horas < 6 ? 3 : horas < 10 ? 4 : 5,
  };
}

export const APARTADOS_MIDE: { clave: keyof Mide; sigla: string; nombre: string }[] = [
  { clave: "medio", sigla: "M", nombre: "Severidad del medio" },
  { clave: "itinerario", sigla: "I", nombre: "Orientación en el itinerario" },
  { clave: "desplazamiento", sigla: "D", nombre: "Dificultad en el desplazamiento" },
  { clave: "esfuerzo", sigla: "E", nombre: "Cantidad de esfuerzo" },
];
