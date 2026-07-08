import type { Metadata, Viewport } from "next";
import { Archivo, Fraunces } from "next/font/google";
import { RegistrarSW } from "@/components/RegistrarSW";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "PeakTrail — Pirineo Aragonés",
  description:
    "Mapa 2.5D, rutas, picos, collados e ibones del Pirineo para nuestro grupo de montaña.",
};

export const viewport: Viewport = {
  themeColor: "#16130f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${archivo.variable} ${fraunces.variable}`}>
      <body className="antialiased">
        <RegistrarSW />
        {children}
      </body>
    </html>
  );
}
