/**
 * Rasteriza src/app/icon.svg (icono propio del Hito 10) a los PNG que exige
 * el manifest de PWA: variantes "any" (icono completo, con su fondo) y
 * variantes "maskable" (solo el glifo, reescalado y centrado sobre un
 * lienzo sólido, para sobrevivir al recorte circular de Android).
 *
 * Uso: npm run iconos:generar
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.join(import.meta.dirname, "..");
const SVG_ORIGEN = path.join(RAIZ, "src/app/icon.svg");
const DESTINO = path.join(RAIZ, "public/iconos");
const FONDO = "#16130f";

async function main() {
  await mkdir(DESTINO, { recursive: true });
  const svg = await readFile(SVG_ORIGEN, "utf8");

  // Variantes "any": el SVG completo (ya trae su propio fondo redondeado).
  for (const tam of [192, 512]) {
    await sharp(Buffer.from(svg))
      .resize(tam, tam)
      .png()
      .toFile(path.join(DESTINO, `icon-${tam}.png`));
  }
  await sharp(Buffer.from(svg))
    .resize(180, 180)
    .png()
    .toFile(path.join(RAIZ, "src/app/apple-icon.png"));

  // Variantes "maskable": solo el glifo (sin el <rect> de fondo redondeado),
  // reescalado al 72 % y centrado sobre un lienzo sólido cuadrado, para que
  // el recorte circular de los launchers Android no corte las puntas.
  const soloGlifo = svg.replace(/<rect[^>]*\/>/, "");
  for (const tam of [192, 512]) {
    const ladoGlifo = Math.round(tam * 0.72);
    const glifoPng = await sharp(Buffer.from(soloGlifo))
      .resize(ladoGlifo, ladoGlifo)
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: tam,
        height: tam,
        channels: 4,
        background: FONDO,
      },
    })
      .composite([{ input: glifoPng, gravity: "center" }])
      .png()
      .toFile(path.join(DESTINO, `icon-maskable-${tam}.png`));
  }

  console.log(`Iconos generados en ${path.relative(RAIZ, DESTINO)}/ y src/app/apple-icon.png`);
}

main();
