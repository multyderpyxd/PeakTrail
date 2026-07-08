"use client";

import { useEffect, useState } from "react";

/**
 * Estado de conectividad del navegador (`navigator.onLine` + eventos
 * online/offline), para que las funciones que exigen red en vivo (meteo,
 * Wikipedia, enrutado con BRouter/OSRM, sincronizar Strava) puedan mostrar
 * un aviso de "sin conexión" en vez de un fetch fallido sin explicación.
 * No es una garantía perfecta (un wifi cautivo cuenta como "online"), pero
 * cubre el caso real de estar en el monte sin cobertura.
 */
export function useConexion(): boolean {
  const [enLinea, setEnLinea] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );

  useEffect(() => {
    function alConectar() {
      setEnLinea(true);
    }
    function alDesconectar() {
      setEnLinea(false);
    }
    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);
    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
    };
  }, []);

  return enLinea;
}
