/**
 * Rasterize the mascot icon into the PNGs Expo expects.
 *
 *   pnpm node assets/source/build-icons.mjs
 *
 * Source:
 *   assets/images/icon.jpg                        (mascot, transparent edges)
 *
 * Outputs (all written to assets/images/):
 *   icon.png                       (1024, mascot on cream — iOS)
 *   android-icon-foreground.png    (1024, mascot scaled to safe zone, transparent)
 *   android-icon-background.png    (1024, solid cream)
 *   android-icon-monochrome.png    (1024, mascot silhouette black on transparent)
 *   splash-icon.png                (1200, mascot transparent for splash)
 *   favicon.png                    (64, downscaled icon.png)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(here, '..', 'images');
const sourceJpg = join(imagesDir, 'icon.jpg');

const BG = { r: 245, g: 235, b: 217, alpha: 1 }; // #F5EBD9 cream/linen

/**
 * The source JPG has a checkered "transparent" graphic baked in.
 * We need to detect the actual transparent regions vs. the checker
 * pattern. Inspecting the file: this is a non-transparent JPEG with
 * the checker drawn as solid pixels. Sharp can't recover transparency
 * from a baked-in checker, so we treat it like a regular image —
 * BUT we'll detect and replace the checker pattern with the chosen
 * background color by sampling the dominant non-character region.
 *
 * Approach: render the mascot at a high quality crop, knock out the
 * checker by detecting the two checker shades and replacing both with
 * the cream background. We do this with a per-pixel scan (sharp's raw
 * extract).
 */
async function knockoutChecker(srcBuffer) {
  const img = sharp(srcBuffer);
  const meta = await img.metadata();
  const { width, height } = meta;

  const raw = await img.raw().toBuffer({ resolveWithObject: true });
  const data = Buffer.from(raw.data); // mutable copy
  const channels = raw.info.channels;

  // Checker pixels are NEUTRAL grayscale (R≈G≈B within ±3) and bright (>195).
  // The mascot's cream face is warmer: (242, 241, 223) — R-B diff ≈ 19.
  // The mascot's saffron body has a huge R-B spread. The outline is dark.
  function isChecker(r, g, b) {
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    const chroma = maxC - minC;
    return chroma <= 4 && minC >= 195;
  }

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isChecker(r, g, b)) {
      data[i] = BG.r;
      data[i + 1] = BG.g;
      data[i + 2] = BG.b;
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png();
}

async function makeTransparentMascot(srcBuffer) {
  const img = sharp(srcBuffer).ensureAlpha();
  const meta = await img.metadata();
  const { width, height } = meta;

  const raw = await img.raw().toBuffer({ resolveWithObject: true });
  const data = Buffer.from(raw.data);
  const channels = raw.info.channels;

  function isChecker(r, g, b) {
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    const chroma = maxC - minC;
    return chroma <= 4 && minC >= 195;
  }

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isChecker(r, g, b)) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png();
}

async function makeMonochrome(transparentBuffer) {
  // Convert any non-transparent pixel to opaque black, keep alpha.
  const img = sharp(transparentBuffer);
  const meta = await img.metadata();
  const { width, height } = meta;
  const raw = await img.raw().toBuffer({ resolveWithObject: true });
  const data = Buffer.from(raw.data);
  const channels = raw.info.channels;

  for (let i = 0; i < data.length; i += channels) {
    if (data[i + 3] > 16) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    } else {
      data[i + 3] = 0;
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png();
}

async function fitOntoCanvasBuffer(imageBuffer, canvasSize, scaleFraction, bg) {
  const trimmed = await sharp(imageBuffer).trim().toBuffer();
  const target = Math.round(canvasSize * scaleFraction);
  const resized = await sharp(trimmed)
    .resize(target, target, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(imagesDir, { recursive: true });
  const srcBuffer = await readFile(sourceJpg);

  // 1. iOS icon — mascot on cream, full bleed.
  const iosBuf = await (await knockoutChecker(srcBuffer)).png().toBuffer();
  const iosOut = await fitOntoCanvasBuffer(iosBuf, 1024, 0.92, BG);
  await writeFile(join(imagesDir, 'icon.png'), iosOut);
  console.log('✓ icon.png (1024 cream)');

  // 2. Android foreground — mascot transparent, 65% safe zone scale.
  const transparentMascot = await (await makeTransparentMascot(srcBuffer))
    .png()
    .toBuffer();
  const fgOut = await fitOntoCanvasBuffer(transparentMascot, 1024, 0.65, {
    r: 0, g: 0, b: 0, alpha: 0,
  });
  await writeFile(join(imagesDir, 'android-icon-foreground.png'), fgOut);
  console.log('✓ android-icon-foreground.png');

  // 3. Android background — solid cream.
  await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: BG },
  })
    .png()
    .toFile(join(imagesDir, 'android-icon-background.png'));
  console.log('✓ android-icon-background.png');

  // 4. Android monochrome — silhouette.
  const monoBuf = await (await makeMonochrome(transparentMascot)).png().toBuffer();
  const monoOut = await fitOntoCanvasBuffer(monoBuf, 1024, 0.65, {
    r: 0, g: 0, b: 0, alpha: 0,
  });
  await writeFile(join(imagesDir, 'android-icon-monochrome.png'), monoOut);
  console.log('✓ android-icon-monochrome.png');

  // 5. Splash — transparent mascot, 1200.
  const splashOut = await fitOntoCanvasBuffer(transparentMascot, 1200, 0.55, {
    r: 0, g: 0, b: 0, alpha: 0,
  });
  await writeFile(join(imagesDir, 'splash-icon.png'), splashOut);
  console.log('✓ splash-icon.png');

  // 6. Favicon — downscale icon.png.
  await sharp(join(imagesDir, 'icon.png'))
    .resize(64, 64, { fit: 'cover' })
    .png()
    .toFile(join(imagesDir, 'favicon.png'));
  console.log('✓ favicon.png');

  console.log('\nDone. Run `pnpm start --clear` to pick up the new assets.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
