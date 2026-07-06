# PeakTrail 🏔️

App de montañismo del Pirineo aragonés: ibones, tresmiles, refugios y rutas GR/PR/SL sobre un mapa 2.5D, para uso compartido con un grupo cerrado de amigos.

El plan completo de desarrollo está en [planning.md](planning.md). Estado actual: **Hito 0 completado** (estructura del proyecto, preparación de Firebase, listo para desplegar).

## Stack

- **Next.js 15 + TypeScript + TailwindCSS 4**
- **Firebase** (Auth + Firestore) — SDK integrado, pendiente de crear el proyecto
- **MapLibre GL JS** (Hito 1) con cartografía del IGN (PNOA + MDT)
- Despliegue en **Vercel**

## Desarrollo en GitHub Codespaces

El repo incluye configuración de devcontainer, así que basta con:

1. En GitHub: **Code → Codespaces → Create codespace on main**. Las dependencias se instalan solas (`npm install` automático).
2. En la terminal del Codespace:
   ```bash
   npm run dev
   ```
3. Codespaces reenvía el puerto 3000 y abre la vista previa automáticamente.

## Desarrollo local

```bash
npm install
npm run dev   # http://localhost:3000
```

## Configurar Firebase (pendiente, requiere tu cuenta)

1. Crea un proyecto en la [consola de Firebase](https://console.firebase.google.com/) (ej. `peaktrail`).
2. Activa **Authentication** (proveedor Email/Password o Google) y **Firestore** (modo producción, región `europe-west1` o similar).
3. Añade una **app web** al proyecto y copia su configuración.
4. Copia `.env.example` a `.env.local` y rellena los valores. En Codespaces puedes definirlos también como *Codespaces secrets* del repositorio.

La app compila y funciona sin estas claves; solo son necesarias cuando empecemos a usar Auth/Firestore (Hito 2 en adelante).

## Desplegar en Vercel (pendiente, requiere tu cuenta)

1. En [vercel.com](https://vercel.com/new), importa el repositorio `PeakTrail` desde GitHub.
2. Vercel detecta Next.js automáticamente; no hace falta configuración extra.
3. Cuando Firebase esté configurado, añade las variables `NEXT_PUBLIC_FIREBASE_*` en **Settings → Environment Variables**.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servir el build |
| `npm run lint` | Linter |

## Atribución de datos

La cartografía y los modelos del terreno provienen del **© Instituto Geográfico Nacional** (IGN/CNIG) y los senderos de **© OpenStreetMap contributors**. La atribución debe permanecer visible en el mapa.
