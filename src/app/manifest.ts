import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PeakTrail — Pirineo",
    short_name: "PeakTrail",
    description:
      "Mapa 2.5D, rutas, picos, collados e ibones del Pirineo para nuestro grupo de montaña.",
    start_url: "/",
    display: "standalone",
    background_color: "#16130f",
    theme_color: "#16130f",
    orientation: "portrait-primary",
    icons: [
      { src: "/iconos/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/iconos/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/iconos/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
