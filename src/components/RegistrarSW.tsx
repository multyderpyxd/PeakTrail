"use client";

import { useEffect } from "react";

/** Registra el Service Worker (public/sw.js) para instalabilidad y caché offline. */
export function RegistrarSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin conexión en el primer registro o navegador sin soporte: no es fatal.
      });
    }
  }, []);
  return null;
}
