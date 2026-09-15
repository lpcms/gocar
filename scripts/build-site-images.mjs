/**
 * Build the responsive WebP variants of the site's large imagery.
 *
 * The originals under public/images/site are kept untouched - the media
 * library and the EN/UA alt text are keyed by their paths - and next to each
 * one this writes `<name>-640.webp`, `<name>-1024.webp` and a top variant at
 * the original width capped to 1920. Pages reference them through
 * src/lib/site-images.ts, whose table of top widths must match what this
 * prints.
 *
 * Mobile Lighthouse measured these files at up to 964 KiB each (15.09.2026);
 * a phone now downloads the 640 or 1024 variant instead.
 *
 * Usage: node scripts/build-site-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join(process.cwd(), 'public', 'images', 'site');
const FILES = [
  'faq-hero.png',
  'faq-cta.png',
  'cta-banner.png',
  'about-cta.png',
  'about-hero.jpg',
  'contact-hero.jpg',
  '404-hero.png',
  'home-why-car.webp',
  'home-cta-car.webp',
  'car-detail-hero.jpg'
];
const SMALL = [640, 1024];
const TOP = 1920;
const QUALITY = 78;

for (const name of FILES) {
  const source = path.join(DIR, name);
  const stem = name.replace(/\.[^.]+$/, '');
  const meta = await sharp(source).metadata();
  const width = meta.width ?? TOP;
  const widths = [...SMALL.filter((w) => w < width), Math.min(width, TOP)];
  const report = [];
  for (const w of widths) {
    const out = path.join(DIR, `${stem}-${w}.webp`);
    await sharp(source).resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(out);
    report.push(`${w}w ${Math.round(fs.statSync(out).size / 1024)}KiB`);
  }
  const before = Math.round(fs.statSync(source).size / 1024);
  process.stdout.write(`${name.padEnd(22)} ${before}KiB -> ${report.join(', ')}\n`);
}
