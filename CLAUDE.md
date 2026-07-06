# PeakTrail — Guía para Claude Code

App de montañismo del Pirineo aragonés (ibones, tresmiles, refugios, rutas GR/PR/SL) sobre mapa 2.5D, para un grupo cerrado de ~10 amigos. El plan de desarrollo completo, con los 11 hitos, está en `planning.md` — consúltalo antes de empezar cualquier hito.

## Estado

- **Hito 0 completado**: Next.js 15 (App Router) + TypeScript + TailwindCSS 4, SDK de Firebase integrado (`src/lib/firebase.ts`, inicialización condicionada a env vars), devcontainer para Codespaces.
- **Pendiente del Hito 0** (requiere cuentas del usuario): crear proyecto Firebase y rellenar `.env.local` (plantilla en `.env.example`); importar el repo en Vercel.
- **Siguiente**: Hito 1 — mapa 2.5D con MapLibre GL JS + terreno del IGN (PNOA + MDT).

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
