/**
 * Rasterize the SVG icon sources into the PNGs Expo expects.
 *
 *   pnpm node assets/source/build-icons.mjs
 *
 * Sources:
 *   assets/source/icon.svg                   -> icon.png (1024×1024, full design)
 *   assets/source/icon-foreground.svg        -> android-icon-foreground.png
 *   assets/source/icon-background.svg        -> android-icon-background.png
 *   assets/source/icon-monochrome.svg        -> android-icon-monochrome.png
 *   assets/source/icon.svg (1200×1200)       -> splash-icon.png  (transparent
 *                                                background; just the K)
 *   assets/source/icon.svg (64×64)           -> favicon.png
 *
 * Splash uses a transparent variant so app.json's splash background color
 * shows through; we render from icon.svg with the background rect dropped.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = here;
const outDir = join(here, '..', 'images');

async function render(svgPath, outPath, size) {
  const svg = await readFile(svgPath);
  const png = await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, png);
  console.log(`✓ ${outPath} (${size}×${size})`);
}

async function renderTransparentSplash(size) {
  // splash icon: foreground glyph only, no saffron background.
  const svg = await readFile(join(sourceDir, 'icon-foreground.svg'));
  const png = await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  const outPath = join(outDir, 'splash-icon.png');
  await writeFile(outPath, png);
  console.log(`✓ ${outPath} (${size}×${size}, transparent)`);
}

async function main() {
  await mkdir(outDir, { recursive: true });

  await render(join(sourceDir, 'icon.svg'),            join(outDir, 'icon.png'),                       1024);
  await render(join(sourceDir, 'icon-foreground.svg'), join(outDir, 'android-icon-foreground.png'),    1024);
  await render(join(sourceDir, 'icon-background.svg'), join(outDir, 'android-icon-background.png'),    1024);
  await render(join(sourceDir, 'icon-monochrome.svg'), join(outDir, 'android-icon-monochrome.png'),    1024);
  await renderTransparentSplash(1200);
  await render(join(sourceDir, 'icon.svg'),            join(outDir, 'favicon.png'),                    64);

  console.log('\nDone. Run `pnpm start --clear` to pick up the new assets.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
