/**
 * Cliente Overpass compartido por los scripts de generación (catálogo y
 * rutas): mismo servidor principal con espejo de respaldo y reintentos,
 * porque el servidor público satura con frecuencia en consultas grandes.
 */

const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export async function consultarOverpass(consulta, etiqueta) {
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

/** Comunidades del Pirineo peninsular por código ISO (admin_level 4) y la
 * latitud mínima que deja fuera el llano de cada una. `clave` es el valor
 * que se guarda en los datos (campo `comunidad` de elementos y rutas). */
export const ZONAS_PIRINEO = [
  { nombre: "Aragón", clave: "aragon", iso: "ES-AR", latMinima: 42.3 },
  { nombre: "Navarra", clave: "navarra", iso: "ES-NC", latMinima: 42.6 },
  { nombre: "Cataluña", clave: "cataluna", iso: "ES-CT", latMinima: 42.1 },
];
