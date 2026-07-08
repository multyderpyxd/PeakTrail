/**
 * Service Worker de PeakTrail, escrito a mano (sin Workbox/next-pwa): las
 * necesidades de caché aquí son concretas (shell de navegación, JSON del
 * catálogo/rutas, teselas de mapa) y no requieren ese aparataje. La descarga
 * explícita de un "pack" de teselas para una ruta/plan/actividad vive en la
 * página (src/lib/descargas.ts), no aquí: usa la misma Cache Storage API
 * directamente, sin postMessage.
 *
 * Nombres de caché: los que llevan versión (shell/datos) se purgan al
 * activar una versión nueva; peaktrail-teselas y peaktrail-teselas-packs NO
 * llevan versión y nunca se tocan aquí — sobreviven a actualizaciones del
 * propio Service Worker y solo se borran por acción del usuario.
 */

const CACHE_VERSION = "v1";
const CACHE_SHELL = `peaktrail-shell-${CACHE_VERSION}`;
const CACHE_DATOS = `peaktrail-datos-${CACHE_VERSION}`;
const CACHE_TESELAS = "peaktrail-teselas";
const CACHE_TESELAS_PACKS = "peaktrail-teselas-packs";

const RUTAS_DATOS = ["/catalogo.json", "/rutas.json"];

self.addEventListener("install", (evento) => {
  self.skipWaiting();
  evento.waitUntil(
    caches.open(CACHE_SHELL).then((cache) => cache.add("/")),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter(
            (nombre) =>
              (nombre.startsWith("peaktrail-shell-") && nombre !== CACHE_SHELL) ||
              (nombre.startsWith("peaktrail-datos-") && nombre !== CACHE_DATOS),
          )
          .map((nombre) => caches.delete(nombre)),
      );
      await self.clients.claim();
    })(),
  );
});

function esTeselaMapa(url) {
  return (
    (url.hostname === "www.ign.es" && url.pathname.startsWith("/wmts/")) ||
    url.hostname === "s3.amazonaws.com"
  );
}

/** Cache-first con refresco en segundo plano (no bloquea la respuesta). */
async function staleWhileRevalidate(peticion, nombreCache) {
  const cache = await caches.open(nombreCache);
  const enCache = await cache.match(peticion);
  const enRed = fetch(peticion)
    .then((respuesta) => {
      if (respuesta.ok) cache.put(peticion, respuesta.clone());
      return respuesta;
    })
    .catch(() => undefined);
  return enCache ?? (await enRed) ?? Response.error();
}

/** Cache-first puro: si está en caché no se revalida (teselas ráster casi estáticas). */
async function cacheFirst(peticion, nombreCache) {
  const cache = await caches.open(nombreCache);
  const enCache = await cache.match(peticion);
  if (enCache) return enCache;
  const respuesta = await fetch(peticion);
  if (respuesta.ok) cache.put(peticion, respuesta.clone());
  return respuesta;
}

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  if (evento.request.mode === "navigate") {
    evento.respondWith(staleWhileRevalidate(evento.request, CACHE_SHELL));
    return;
  }

  if (url.origin === self.location.origin && RUTAS_DATOS.includes(url.pathname)) {
    evento.respondWith(staleWhileRevalidate(evento.request, CACHE_DATOS));
    return;
  }

  if (esTeselaMapa(url)) {
    evento.respondWith(
      (async () => {
        const packs = await caches.open(CACHE_TESELAS_PACKS);
        const enPack = await packs.match(evento.request);
        if (enPack) return enPack;
        return cacheFirst(evento.request, CACHE_TESELAS);
      })(),
    );
  }
});
