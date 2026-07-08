# Plan de desarrollo — App de Montañismo del Pirineo Aragonés

## 0. Contexto y decisiones de partida

| Decisión | Elección |
|---|---|
| Ámbito geográfico inicial | Pirineo aragonés (ibones, tresmiles, refugios, rutas GR/PR/SL) |
| Fuente de datos | Datos abiertos: IGN (relieve, ortofoto, hidrografía) + OpenStreetMap (senderos, rutas) |
| Objetivo principal | Uso compartido con un grupo cerrado de ~10 amigos, no producto público masivo |
| Filosofía | Igual que en tus otros proyectos: iterativo, funcional antes que perfecto, sin dependencias de pago innecesarias |

Esto es clave porque **cambia bastante las decisiones técnicas** respecto a construir "una Strava para todo el mundo": no necesitas escalar a miles de usuarios ni bases de datos geoespaciales industriales. Puedes permitirte simplicidad.

---

## 1. Stack tecnológico propuesto (con alternativas)

### Frontend + mapa
- **Next.js + TypeScript + TailwindCSS** — consistente con tu forma habitual de trabajar.
- **MapLibre GL JS** para el mapa 2.5D. Es el motor open-source (fork de Mapbox GL JS), gratuito, sin límites de uso, y soporta terreno 3D real (`terrain-RGB`) con exageración vertical, hillshade, pitch/bearing — exactamente el efecto "2.5D de calidad" que buscas, y sin depender de un proveedor de pago.

### Datos de relieve y cartografía (la parte que da la "calidad gráfica")
- **IGN (Instituto Geográfico Nacional) / CNIG**: ofrece gratis y sin restricciones:
  - **PNOA** — ortofoto aérea de alta resolución.
  - **MDT05 / MDT25** — Modelo Digital del Terreno (elevación), suficiente para generar tiles `terrain-RGB` propios con muy buena resolución en el Pirineo.
  - **BTN25** — cartografía topográfica vectorial (incluye hidrografía, donde aparecen los ibones, refugios, etc.).
  - Servicios WMS/WMTS listos para consumir directamente, sin necesidad de procesar nada al principio.
- Esto te da una calidad de mapeo específica del Pirineo muy superior a usar un proveedor genérico global, y es gratis.

### Rutas de senderismo
- **OpenStreetMap vía Overpass API**: el Pirineo aragonés está bien cubierto en OSM, con relaciones `route=hiking` que incluyen GR-11, PR y SL locales. Es la fuente más práctica para no tener que trazar rutas a mano.
- Complementado con carga manual para ibones/picos concretos que quieras curar tú mismo con más detalle (fotos, notas personales, etc.).

### Backend / base de datos
- **Firebase** (Firestore + Cloud Functions + Auth) como opción por defecto, ya que es un entorno que conoces bien y a esta escala (unos cientos de elementos, ~10 usuarios) no vas a notar sus limitaciones geoespaciales.
- Alternativa a considerar si más adelante quieres consultas espaciales más potentes (ej. "rutas que pasan cerca de este punto"): **Supabase** (Postgres + extensión PostGIS). Más potente para geodatos, pero es una herramienta nueva para ti. Mi recomendación: **empieza con Firebase** y migra solo si realmente lo necesitas.

### Autenticación y "grupo de amigos"
- Firebase Auth con lista cerrada de invitación (no registro público).

### Despliegue
- Vercel (frontend) + Firebase (backend), ambos con capa gratuita más que suficiente para 10 usuarios.

---

## 2. Modelo de datos (conceptual)

- **Elemento geográfico** (tipo: montaña / ibón / refugio / collado): nombre, coordenadas, altitud, descripción, fotos, fuente de datos.
- **Ruta**: geometría (línea GPX/GeoJSON), elementos que conecta, distancia, desnivel positivo/negativo, perfil de elevación, tiempo estimado, dificultad (MIDE, ver Hito 5).
- **Usuario**: perfil, amigos/grupo.
- **Actividad realizada**: usuario + ruta o elemento + fecha + origen (marcado manual o importado de Strava).

---

## 3. Hitos de desarrollo

Cada hito está pensado para abordarse con Claude Code como una o pocas sesiones de trabajo, con un entregable comprobable al final.

### Hito 0 — Cimientos del proyecto
- Repositorio, estructura Next.js + TypeScript + Tailwind.
- Configuración de Firebase (proyecto, Auth, Firestore).
- Despliegue "hola mundo" en Vercel.
- **Entregable**: web vacía desplegada y accesible.

### Hito 1 — Mapa base 2.5D de calidad
- Integrar MapLibre GL JS con terreno 3D usando ortofoto PNOA + MDT del IGN (convertido a terrain-RGB).
- Estilo de mapa propio (colores, hillshade, exageración de relieve).
- Controles de navegación (inclinación, rotación, zoom).
- **Entregable**: mapa navegable en 2.5D del Pirineo aragonés, con buen aspecto visual, sin datos todavía.

### Hito 2 — Modelo de datos y catálogo inicial
- Esquema de datos en Firestore (elementos: montañas, ibones, refugios).
- Script de importación: BTN25 (IGN) para hidrografía/refugios + lista curada de tresmiles y ibones conocidos del Pirineo aragonés.
- **Entregable**: catálogo de ~50-100 elementos cargado en la base de datos.

### Hito 3 — Visualización interactiva de elementos
- Renderizar marcadores/iconos diferenciados por tipo sobre el mapa.
- Panel/popup con ficha de información (altitud, descripción, fotos).
- Filtros por tipo de elemento.
- **Entregable**: mapa navegable con elementos clicables y fichas informativas.

### Hito 4 — Rutas: geometría y ficha técnica
- Importar rutas de senderismo desde OSM (Overpass API) para la zona.
- Renderizar trazado sobre el mapa.
- Perfil de elevación (gráfico distancia vs. altitud).
- **Entregable**: rutas visibles y seleccionables, con su perfil.

### Hito 5 — Tiempo estimado y dificultad (MIDE)
- Cálculo de tiempo estimado con una función reconocida (Tobler / Naismith modificado) a partir de distancia + desnivel.
- Clasificación de dificultad siguiendo el **método MIDE** (el estándar usado por las federaciones de montaña españolas, incluida la aragonesa), en vez de inventar una escala propia.
- **Entregable**: cada ruta muestra distancia, desnivel, tiempo estimado y dificultad MIDE.

### Hito 6 — Planificador de rutas propio
- Selección de puntos en el mapa para trazar una ruta personalizada.
- Opción de "enganchar" a senderos existentes de OSM o trazado libre.
- Guardado de rutas planificadas por el usuario.
- **Entregable**: puedes diseñar y guardar tu propia ruta combinando elementos del catálogo.

### Hito 7 — Cuentas, grupo de amigos y registro de "realizado"
- Login con Firebase Auth, lista cerrada de invitación para tu grupo.
- Marcar montañas/ibones/rutas como realizadas, con fecha y notas.
- Vista de progreso personal (cuántos tresmiles hechos, etc.) y del grupo.
- **Entregable**: cada amigo puede entrar, ver el mapa y marcar lo que ha hecho.

### Hito 8 — Integración con Strava
- OAuth2 con la API de Strava (dentro de los límites gratuitos, sobrados para 10 usuarios).
- Importar actividades pasadas y futuras.
- Emparejar automáticamente una actividad de Strava con una ruta/elemento del catálogo (por proximidad geográfica) para marcarla como realizada sin esfuerzo manual.
- **Entregable**: conectas tu cuenta de Strava y tus actividades relevantes aparecen marcadas solas.

### Hito 9 — PWA y uso offline en montaña
- Convertir la app en PWA instalable.
- Cacheo de mapas/tiles de zonas descargadas para consulta sin cobertura (muy relevante en el Pirineo).
- **Entregable**: puedes abrir rutas ya visitadas/descargadas sin conexión.

### Hito 10 — Pulido visual, social y despliegue final
- Fotos y galería por elemento, temas de mapa (día/niebla/nieve), mejoras de UX.
- Funciones sociales ligeras dentro del grupo (comentarios, ranking de picos hechos).
- Revisión de rendimiento y despliegue definitivo.
- **Entregable**: versión "1.0" pulida para uso real con tu grupo.

---

## 4. Notas técnicas específicas

- **Fórmula de tiempo estimado**: función de Tobler `W = 6 · e^(-3.5·|pendiente+0.05|)` km/h da resultados más realistas que Naismith puro en terreno de montaña con pendientes variables; es sencilla de implementar por tramos del GPX.
- **MIDE**: valora Severidad del Medio, Orientación, Dificultad en el Desplazamiento y Cantidad de Esfuerzo — es información que ya viene en muchas fichas de la Federación Aragonesa de Montañismo y puedes reutilizar como referencia para calibrar tu propio cálculo automático.
- **Límites de la API de Strava**: 100 peticiones/15 min y 1000/día en la app gratuita — de sobra para 10 usuarios.
- Recuerda: los datos del IGN son gratuitos pero requieren atribución ("© Instituto Geográfico Nacional") visible en el mapa.

## 5. Fase 2 — Plan de mejora (julio de 2026)

Definida en la sesión de re-planning tras completar la fase 1 (hitos 0–8 y 10; el 9, PWA/offline, sigue aplazado). Decisiones de alcance tomadas:

- El catálogo pasa de «tresmiles» a **todos los picos con nombre y cota** de OSM; la densidad se resuelve en la interfaz con un filtro de altitud, no recortando datos en el script.
- El ámbito geográfico se amplía del Pirineo aragonés a **todo el Pirineo peninsular** (navarro, aragonés y catalán), tanto en catálogo como en rutas.
- Los sitios de interés adicionales (miradores, cascadas, cuevas, ermitas…) quedan apuntados en `notas-mejoras.md` para más adelante.
- Recuentos de referencia en OSM (Huesca, lat ≥ 42,3): 1.779 picos con nombre y cota (153 ≥ 3.000 m, 366 de 2.500–2.999, 355 de 2.000–2.499, 905 < 2.000) y 497 collados/puertos con nombre.

### Hito 11 — UI ordenada con desplegables
- Panel «Capas y filtros» desplegable que agrupa los filtros de catálogo y de redes de senderos; cerrado, la fila superior queda en marca + buscador + sesión.
- Persistir las preferencias de vista (filtros, ambiente, topónimos) en localStorage.
- **Entregable**: mapa despejado con los filtros en un panel plegable; las preferencias sobreviven a la recarga.

### Hito 12 — Catálogo total: picos por altura y collados
- Ingerir todos los picos con nombre y cota y los collados con nombre, ampliando el ámbito a Navarra y Cataluña.
- Collado como cuarto tipo del mapa: color propio, marcador (el glifo ya existe en el set) y filtro.
- Deslizador de rango de altitud en el panel de capas; prioridad de colisión y zoom mínimo por bandas para gobernar la densidad.
- **Entregable**: la gran mayoría de picos y collados del Pirineo en el mapa, navegable sin saturación.

### Hito 13 — Rutas ampliadas y fidelidad MDT05
- Ampliar `rutas:generar` al Pirineo navarro y catalán; incorporar también las rutas sin red y las internacionales (iwn).
- Recalcular perfiles, desniveles y cotas del catálogo con el MDT05 del IGN (5 m) descargado durante el script; el terreno 3D visual sigue con terrarium.
- **Entregable**: más rutas y perfiles/tiempos/MIDE más fieles.

### Hito 14 — Estadísticas de realización
- Rediseño del panel de progreso con apartados dedicados: por tipo y banda de altitud, evolución temporal, comparativa del grupo, pendientes.
- Mejoras visuales y funcionales con gráficos propios en SVG, coherentes con el set de iconos.
- **Entregable**: panel de estadísticas con secciones propias, útil para ver qué falta y qué ha logrado el grupo.

### Hitos 15–21 — mejoras acordadas, en hitos pequeños
Separadas a propósito en hitos cortos para implementarlas con calma, por orden de valor/esfuerzo:

- **Hito 15 — Meteo en las fichas**: previsión de 7 días por elemento (Open-Meteo, gratuito y sin clave): temperatura en cota, viento, precipitación y cota de nieve.
- **Hito 16 — Compartir y buscar**: la URL codifica el elemento/ruta abierto (enlaces que abren la ficha directamente) y buscador con prioridad por prefijo y tolerancia a erratas.
- **Hito 17 — GPX**: exportar rutas del catálogo y planes propios; importar un GPX al planificador.
- **Hito 18 — Explorador del catálogo**: vista de lista ordenable (altitud, nombre, hechos/pendientes) complementaria al mapa.
- **Hito 19 — Strava, segunda ronda**: importación incremental con `after=`, emparejar también los planes propios y calibrar umbrales con salidas reales.
- **Hito 20 — Fichas enriquecidas**: descripción y foto libre desde Wikidata/Wikipedia para los picos que traen la etiqueta en OSM.
- **Hito 21 — Social, segunda ronda**: miniaturas de fotos para la galería y comentarios/fotos en vivo con onSnapshot.

### Hito 22 — Estadísticas por comarca (mejora sustancial, futura)
El Hito 14 reparte el catálogo y las rutas por comunidad autónoma (campo
`comunidad`, asignado en la generación). Pendiente un reparto más fino por
comarca (división político-administrativa real en OSM, `admin_level=7`
en Aragón/Navarra/Cataluña) para que apartados como «dónde me queda
Monte Perdido» sean posibles. Requiere: consultar los límites de comarca en
Overpass, asignar cada elemento y ruta a la suya (las rutas largas pueden
cruzar varias, igual que con la comunidad), regenerar catálogo y rutas, y
un desglose de dos niveles (comunidad → comarca) en el panel de progreso.

El Hito 9 (PWA/offline) queda en la recámara para cuando la app pase a uso real en el monte.