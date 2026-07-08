# Notas de mejoras pendientes

Consideraciones apuntadas durante el desarrollo para retomarlas más adelante
(sobre todo en el Hito 10 de pulido). No son bugs: la funcionalidad actual es
correcta; esto es margen de mejora.

## Importación de Strava

- ~~**Importación incremental**~~: hecha en el Hito 19 (caché local en
  `src/lib/actividades.ts` con `ultimaEpoca` y `after=` al API; solo se
  emparejan las actividades nuevas).
- ~~**Emparejar también los planes propios**~~: hecho en el Hito 19 (tipo
  `plan` en realizados, cobertura 70 %/250 m como las rutas, marca «hecha»
  en la lista del planificador).
- **Histórico completo la primera vez**: el tope de 5 páginas puede dejar
  fuera actividades antiguas de cuentas muy activas. Primera importación con
  paginación extendida y control del límite de peticiones (100/15 min),
  con avisos de progreso.
- **Fidelidad de la traza**: se usa `summary_polyline` (simplificada). Para
  casos límite (un ibón a ~150 m justos, rutas con muchos zigzags) se podría
  pedir la actividad detallada o sus streams — más fidelidad a cambio de una
  petición extra por actividad dudosa.
- **Calibrar umbrales con salidas reales**: 150 m (elemento), 250 m y 70 %
  de cobertura (ruta) son razonables sobre papel; ajustarlos cuando el grupo
  haya importado salidas de verdad y se vean falsos positivos/negativos.
- **Cumbres con criterio de cota**: pasar a <150 m de un pico marca el pico
  aunque no se llegara a la cumbre (p. ej. cresteando por debajo). Con los
  streams de altitud de la actividad se podría exigir además haber alcanzado
  la cota del pico menos un margen.
- **Deportes que cuentan**: la lista `DEPORTES_MONTANA` es fija (a pie +
  travesía). Decidir si la BTT cuenta para rutas y hacer la lista
  configurable si hay discrepancia en el grupo.
- **Tokens multi-dispositivo**: los tokens viven en localStorage del
  dispositivo; en otro dispositivo hay que reconectar. Podrían guardarse en
  Firestore (colección propia por uid, protegida por reglas) para conectar
  una sola vez.
- **Webhooks de Strava**: importación automática al subir una actividad,
  sin pulsar el botón. Requiere endpoint de suscripción con verificación y
  algo de estado en servidor; valorar si compensa para ~10 usuarios.
- **Filtros de la capa «Mis actividades»**: filtrar las trazas por año o por
  deporte, y un modo «mapa de calor» (opacidad acumulada) cuando haya muchas
  salidas solapadas por las mismas sendas.
- **Actividades del grupo**: hoy la capa es por dispositivo (localStorage).
  Compartir las trazas con el grupo exigiría guardarlas en Firestore y
  decidir la cuestión de privacidad (cada uno elige si publica las suyas).

## Fotos y social (Hito 10)

- **Almacenamiento de fotos**: van como data-URL JPEG (~200 KB) dentro de
  documentos de Firestore porque Firebase Storage exige plan Blaze en
  proyectos nuevos. Funciona para el grupo, pero cada carga de galería
  descarga las fotos enteras (no hay miniaturas separadas) y consume cuota
  de lecturas. Migrar a un almacén de objetos gratuito (Cloudflare R2,
  Supabase Storage) o a Blaze con presupuesto 0 cuando pese.
- **Miniaturas**: guardar una versión pequeña (~20 KB) junto a la grande
  para que la rejilla de la galería no descargue los originales.
- **Comentarios/fotos en vivo**: se cargan al abrir la ficha (getDocs);
  con onSnapshot se verían llegar sin reabrir.

## Rutas (Hito 13)

- **Rutas de largo recorrido ajenas al Pirineo**: el filtro «fracción del
  trazado en la mitad pirenaica» usa un único corte de latitud (el más
  permisivo de las tres comunidades) y admite algunas rutas de paso por la
  zona pero centradas en otra región (Camino de Santiago, Camino de las
  Asturias, GR-99 del Ebro, Camí de l'Últim Càtar...). Datos correctos, pero
  no encajan en «rutas del Pirineo». Afinar con un corte de latitud por
  longitud (banda que sigue la cresta) o un tope de distancia total.

## Estadísticas (Hito 14)

- **Reparto por comarca**: el Hito 14 reparte «Por comunidad» (Aragón,
  Navarra, Cataluña) en el panel de progreso, con el campo `comunidad` que
  ya se asigna en la generación del catálogo y las rutas. Pendiente afinar
  a un nivel más útil de verdad: la comarca (división real en OSM,
  `admin_level=7`), para poder agrupar por zonas con sentido de montaña
  (Sobrarbe, Ribagorza, Pallars Sobirà...) en vez de solo por comunidad
  autónoma. Es una mejora sustancial (nueva consulta a Overpass, asignar
  cada elemento/ruta a su comarca, desglose de dos niveles en el panel) que
  se hará como hito futuro — anotado como Hito 22 en `planning.md`.

## Planificador (Hito 17)

- ~~**Insertar un punto en mitad de la ruta**~~: hecho en la mejora
  post-Hito 17 (pulsar sobre la línea inserta el punto en el tramo correcto,
  con Turf `nearestPointOnLine`).
- **Perfil propio de BRouter**: el enrutado usa el perfil estándar
  `hiking-mountain` del servidor público. BRouter admite perfiles a medida
  (penalizar sac_scale alto, preferir senderos balizados GR/PR); si el grupo
  quiere afinar el criterio, se puede subir un perfil propio o autoalojar
  BRouter (gratuito, un jar + datos por región).
- **Usar la elevación que ya devuelve BRouter**: cada vértice llega con cota
  (SRTM). Hoy se descarta y el perfil se muestrea aparte con terrarium
  (uniforme para tramos rectos e importados); usarla ahorraría peticiones de
  teselas en trazados largos por senderos.
- **Editar una traza importada**: al importar un GPX la traza se conserva
  íntegra como un único segmento salida→llegada (caché sembrada); si se
  arrastra un extremo, ese tramo se recalcula (recto/senderos) y se pierde la
  geometría original. Suficiente para ver/guardar/exportar, pero no para
  editar finamente lo importado. Se podría trocear el GPX en varios waypoints
  con Douglas-Peucker si se quiere editarlo por tramos.
- **Reordenar arrastrando la lista**: las flechas ↑↓ del panel bastan para
  pocos puntos; con muchos, un arrastrar-y-soltar de la lista sería más ágil.

## Meteo (Hito 15)

- **Meteo por hora / por tramo de ruta**: hoy es la previsión diaria en un
  único punto (el elemento, o el punto medio de la ruta). Para rutas largas
  que cruzan cotas muy distintas, una previsión por tramos o por franjas
  horarias del día de salida daría más información.

## Fichas enriquecidas (Hito 20)

- **Wikipedia sin Wikidata**: si un elemento trae `wikipedia` en OSM pero no
  `wikidata` (solo 1 de ~3000 picos en Aragón en la muestra), hoy no se
  resuelve y la ficha se queda sin descripción. Se podría resolver en la
  generación (una consulta extra a la API de Wikipedia para sacar el QID),
  pero no compensaba el coste para un caso tan raro; revisar si el porcentaje
  sube al ampliar a collados/refugios.
  - **Cobertura por tipo**: hoy ~27 % de los elementos traen `wikidata`
  (picos 2.155, ibones 248, collados 223, refugios 53). Los picos «menores»
  sin artículo se quedan sin ficha enriquecida — es una limitación de qué
  etiqueta el propio OSM, no del código; iría mejorando sola con el tiempo
  a medida que la comunidad de OSM/Wikidata añada más enlaces.
- **Caché de imágenes**: las fotos de Wikipedia se cargan directo desde
  `upload.wikimedia.org` en cada apertura de ficha; si pesa, se podría
  cachear la URL (no la imagen) en el catálogo para ahorrar la ida y vuelta
  a Wikidata, a costa de que quede desactualizada hasta la próxima
  regeneración.

## Catálogo (fase 2)

- **Sitios de interés adicionales**: miradores (`tourism=viewpoint`),
  cascadas (`waterfall=yes`), cuevas y simas (`natural=cave_entrance`),
  ermitas… como nuevos tipos del catálogo. Acordado en el re-planning de
  julio de 2026 dejarlo para después de la fase 2; sondear recuentos en
  Overpass y decidir qué tipos compensan cuando toque.

## Búsqueda y UX (Hito 10)

- **Priorizar coincidencias por prefijo** en el buscador (hoy es
  «contiene», por orden del índice) y quizá tolerancia a erratas.
- **Persistir preferencias de vista** (ambiente elegido, topónimos,
  filtros) en localStorage entre sesiones.
