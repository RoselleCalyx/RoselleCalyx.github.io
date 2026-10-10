// Package original imagegen art as transparent farm runtime sprites.
// Crop/resize/pack only; no generated or repainted artwork.
// Usage: NODE_PATH=<bundled node_modules> node scripts/export-farm-new-animals-b.cjs wolf-atlas.png crocodile-atlas.png
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { cells } = require('./export-farm-motion.cjs');
const root = path.resolve(__dirname, '..');
const CELL = 384, BASELINE = 360;

function fitScale(figures, size, baseline) {
  return Math.min(size * .84 / Math.max(...figures.map(f => f.box.width)),
    (baseline - size * .065) / Math.max(...figures.map(f => f.box.height)));
}
async function render(figure, scale, size = CELL, baseline = BASELINE) {
  const width = Math.round(figure.box.width * scale);
  const height = Math.round(figure.box.height * scale);
  const input = await sharp(figure.input).resize(width, height).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
    .composite([{ input, left: Math.round((size - width) / 2), top: baseline - height }]).png().toBuffer();
}
async function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length !== 2) throw new Error('Provide wolf and crocodile atlas paths');
  const source = path.join(root, 'assets/farm/source');
  const pose = path.join(root, 'assets/farm/poses');
  const walk = path.join(root, 'assets/farm/walk');
  await Promise.all([source, pose, walk].map(p => fs.mkdir(p, { recursive: true })));
  const previews = [];
  for (const [index, species] of ['wolf', 'crocodile'].entries()) {
    const sourcePath = path.join(source, species + '-atlas.png');
    if (path.resolve(inputs[index]) !== sourcePath) await fs.copyFile(inputs[index], sourcePath);
    const atlas = await cells(sourcePath, 4, 2);
    const idle = await render(atlas[0], fitScale([atlas[0]], 320, 301), 320, 301);
    const sleep = await render(atlas[1], fitScale([atlas[1]], CELL, BASELINE));
    const motion = atlas.slice(2), scale = fitScale(motion, CELL, BASELINE);
    const frames = await Promise.all(motion.map(f => render(f, scale)));
    await sharp(idle).webp({quality: 88, alphaQuality: 100}).toFile(path.join(root, 'assets/farm/' + species + '.webp'));
    await sharp(sleep).webp({quality: 88, alphaQuality: 100}).toFile(path.join(pose, species + '-sleep.webp'));
    await sharp({ create: { width: CELL * 6, height: CELL, channels: 4, background: '#00000000' } })
      .composite(frames.map((input, i) => ({input, left: CELL * i, top: 0})))
      .webp({quality: 88, alphaQuality: 100}).toFile(path.join(walk, species + '.webp'));
    previews.push(await sharp(idle).resize(CELL,CELL).png().toBuffer(), sleep, ...frames);
    console.log(species + ': idle 320x320, sleep 384x384, six motion frames 2304x384; common motion scale ' + scale.toFixed(4));
  }
  const contact = await sharp({ create: { width: CELL * 4, height: CELL * 4, channels: 4, background: '#f4f0e5' } })
    .composite(previews.map((input, i) => ({ input, left: (i % 4) * CELL, top: Math.floor(i / 4) * CELL })))
    .png().toBuffer();
  await sharp(contact).resize(1024).webp({quality: 90}).toFile(path.join(source, 'new-animals-b-contact-sheet.webp'));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { fitScale, render };
