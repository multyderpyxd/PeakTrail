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

## 5. Próximo paso inmediato

Empezar por el **Hito 0**: crear el repositorio, montar Next.js + TypeScript + Tailwind, conectar Firebase y desplegar en Vercel. Es la base sobre la que se apoya todo lo demás, y es un hito pequeño y rápido de completar con Claude Code para coger impulso.