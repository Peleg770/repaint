import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('icons', { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const r = Math.round(size * 0.18);
  const fontSize = Math.floor(size * 0.58);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#6366f1"/>
    <text x="${size / 2}" y="${size / 2 + size * 0.08}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" font-family="serif">🎨</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`icons/icon${size}.png`);
  console.log(`icons/icon${size}.png ✓`);
}
