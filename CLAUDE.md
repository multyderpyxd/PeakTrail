# PeakTrail — Guía para Claude Code

App de montañismo del Pirineo aragonés (ibones, tresmiles, refugios, rutas GR/PR/SL) sobre mapa 2.5D, para un grupo cerrado de ~10 amigos. El plan de desarrollo completo, con los 11 hitos, está en `planning.md` — consúltalo antes de empezar cualquier hito.

## Estado

- **Hito 0 completado**: Next.js 15 (App Router) + TypeScript + TailwindCSS 4, SDK de Firebase integrado (`src/lib/firebase.ts`, inicialización condicionada a env vars), devcontainer para Codespaces.
- **Hito 1 completado**: mapa 2.5D con MapLibre GL JS (`src/components/map/`): ortofoto PNOA y topónimos IGNBaseOrto vía WMTS del IGN, terreno 3D con teselas terrarium de Mapzen/AWS (EU-DEM/SRTM; cambiar por tubería propia MDT05 → terrain-RGB si se quiere más resolución), hillshade, cielo/niebla, controles propios (zoom, brújula, 2D/3D, topónimos) y atribución visible. Design tokens de la paleta Pirineo en `globals.css` (@theme de Tailwind 4), tipografía Fraunces + Archivo, set de iconos propio en `src/components/icons.tsx`.
- **Hito 2 completado**: modelo de datos en `src/types/catalogo.ts`; catálogo generado en `data/catalogo.json` (350 elementos: 153 tresmiles, 166 ibones, 31 refugios) vía `npm run catalogo:generar` (Overpass/OSM, provincia de Huesca, lat ≥ 42.3, con ajustes manuales en `data/curados.json`); importado a Firestore (colección `elementos`, doc id = slug, `npm run catalogo:importar`, reimportable sin duplicar). Firebase y Vercel ya configurados por el usuario.
- **Hito 3 completado**: marcadores por tipo sobre el mapa (capa de símbolos con insignias SVG rasterizadas desde los trazos compartidos de `src/components/iconos-trazos.ts`, color por tipo, prioridad de colisión por altitud), ficha lateral al hacer clic (`FichaElemento.tsx`) y filtros-leyenda por tipo con recuentos. La app lee `data/catalogo.json` estático; Firestore queda para datos de usuario (hitos 6-8).
- **Hito 4 completado**: rutas de senderismo desde OSM (`npm run rutas:generar` → `public/rutas.json`, 248 rutas: 85 GR, 130 PR, 33 SL; cose tramos, muestrea elevación del DEM terrarium cada 50 m con pngjs, calcula distancia/desniveles con histéresis de 5 m, simplifica con Douglas-Peucker y descarta rutas con <60 % del trazado en lat ≥ 42.3). Capas de línea por red con colores validados (GR #c26a3f, PR #c98500, SL #55a05e), capa invisible ancha para el clic, resaltado de la seleccionada, ficha con métricas y perfil de elevación SVG interactivo (`PerfilElevacion.tsx`, serie #3f92c9), filtros-leyenda por red.
- **Hito 5 completado**: tiempo de marcha estimado con la función de Tobler por tramos del perfil y valoración MIDE estimada (esfuerzo por la escala oficial de horas; medio/itinerario/desplazamiento heurísticos por altitud), en `src/lib/metricas-ruta.ts` y visibles en la ficha de ruta. Botón «Invertir sentido» en la ficha: voltea perfil, desniveles, extremos y recalcula tiempo/MIDE (`invertirRuta` en `src/components/map/rutas.ts`). Señales de salida (punto-anilla) y llegada (banderín) en claro sobre el trazado seleccionado, y punto azul en la ruta sincronizado con el cursor del perfil.
- **Hito 6 completado**: planificador de rutas propio (botón de trazado en los controles): clics sobre el mapa que se enganchan a senderos con el OSRM a pie de FOSSGIS (`src/lib/enrutador.ts`, con respaldo a línea recta y modo «línea recta» manual), métricas y perfil en vivo muestreando elevación en el navegador (`src/lib/elevacion.ts`, mismas teselas terrarium), deshacer/limpiar, y guardado en Firestore (colección `planes`, `src/lib/planes.ts` — sin arrays anidados: coordenadas como arrays de mapas) con listado, vista y borrado en el panel (`Planificador.tsx`). Ojo: `line-dasharray` + terreno 3D congela MapLibre (documentado en `MapView.tsx`); en dev el mapa se expone como `window.__mapa` para depurar.
- **Siguiente**: Hito 7 — cuentas (Firebase Auth con lista cerrada), marcar elementos/rutas como realizados y vista de progreso. Al introducir auth, endurecer las reglas de Firestore (ahora en modo de prueba) para `elementos` y `planes`.

## Comandos

- `npm run dev` — desarrollo (puerto 3000)
- `npm run build` — build de producción (ejecútalo antes de dar por cerrado un cambio)
- `npm run lint` — linter

## Normas de diseño gráfico (obligatorias)

El acabado visual debe parecer diseñado por una persona, no generado por IA:

1. **PROHIBIDOS los emojis** en cualquier parte de la interfaz, textos de la app, iconografía o placeholders. Sin excepciones.
2. **Iconos propios en SVG**: crea un set de iconos original (pico, ibón, refugio, collado, ruta, etc.) como componentes React con SVG inline, con trazo y estilo coherentes entre sí. No uses librerías de iconos genéricas (Heroicons, Font Awesome, Lucide…) ni emojis como iconos.
3. **Identidad visual original**: paleta propia inspirada en el Pirineo (roca, hielo, pino, ocres) definida como design tokens; nada de gradientes morado-azul genéricos, glassmorphism por defecto, ni composiciones tipo landing de plantilla (hero centrado + tres cards con iconos).
4. **Tipografía deliberada**: elige y justifica las fuentes; no dejar la tipografía por defecto en pantallas acabadas.
5. Ilustraciones, texturas y elementos decorativos: generados a medida en SVG propio, coherentes con el set de iconos.

## Convenciones

- Idioma de la interfaz y del contenido: español.
- Commits con mensajes en español, autoría `multyderpyxd@gmail.com` (ya configurado en el repo).
- Atribución obligatoria y visible en el mapa: «© Instituto Geográfico Nacional» y «© OpenStreetMap contributors».
- Sin dependencias de pago; todo dentro de capas gratuitas (IGN, OSM, Firebase, Vercel).
