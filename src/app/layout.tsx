import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PeakTrail — Pirineo Aragonés",
  description:
    "Mapa 2.5D, rutas, ibones y tresmiles del Pirineo aragonés para nuestro grupo de montaña.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
