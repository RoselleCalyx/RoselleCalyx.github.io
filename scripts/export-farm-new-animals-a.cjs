// Pack imagegen atlases into the farm's existing idle, sleep and six-frame formats.
// Usage: NODE_PATH=<bundled node_modules> node scripts/export-farm-new-animals-a.cjs redpanda.png raccoon.png fennec.png
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { cells } = require('./export-farm-motion.cjs');
const root = path.resolve(__dirname, '..');
const species = ['redpanda', 'raccoon', 'fennec'];

function scaleFor(list, size, baseline) {
  return Math.min(size * .84 / Math.max(...list.map(c => c.box.width)),
    (baseline - size * .04) / Math.max(...list.map(c => c.box.height)));
}

async function render(cell, size, baseline, scale) {
  const width = Math.round(cell.box.width * scale);
  const height = Math.round(cell.box.height * scale);
  const input = await sharp(cell.input).resize(width, height).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
    .composite([{ input, left: Math.round((size - width) / 2), top: baseline - height }])
    .png().toBuffer();
}

async function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length !== 3) throw new Error('Provide redpanda, raccoon and fennec eight-figure atlas paths');
  const out = path.join(root, 'assets/farm');
  const sourceDir = path.join(out, 'new-animals/source');
  await Promise.all(['poses', 'walk', 'new-animals/source'].map(dir => fs.mkdir(path.join(out, dir), { recursive: true })));
  const preview = [], manifest = { generatedWith: 'built-in imagegen', species: [] };
  for (let i = 0; i < species.length; i++) {
    const name = species[i], source = path.join(sourceDir, `${name}.png`);
    if (path.resolve(inputs[i]) !== source) await fs.copyFile(inputs[i], source);
    const poses = await cells(source, 4, 2);
    const idle = await render(poses[0], 320, 301, scaleFor([poses[0]], 320, 301));
    const sleep = await render(poses[1], 384, 360, scaleFor([poses[1]], 384, 360));
    const walk = poses.slice(2), walkScale = scaleFor(walk, 384, 360);
    const frames = await Promise.all(walk.map(c => render(c, 384, 360, walkScale)));
    await sharp(idle).webp({ quality: 88, alphaQuality: 100 }).toFile(path.join(out, `${name}.webp`));
    await sharp(sleep).webp({ quality: 86, alphaQuality: 100 }).toFile(path.join(out, `poses/${name}-sleep.webp`));
    await sharp({ create: { width: 384 * 6, height: 384, channels: 4, background: '#00000000' } })
      .composite(frames.map((input, j) => ({ input, left: j * 384, top: 0 })))
      .webp({ quality: 86, alphaQuality: 100 }).toFile(path.join(out, `walk/${name}.webp`));
    preview.push({ input: await sharp(idle).resize(384).png().toBuffer(), left: 0, top: i * 384 });
    preview.push({ input: sleep, left: 384, top: i * 384 });
    frames.forEach((input, j) => preview.push({ input, left: (j + 2) * 384, top: i * 384 }));
    const assets = [];
    for (const rel of [`${name}.webp`, `poses/${name}-sleep.webp`, `walk/${name}.webp`]) {
      const meta = await sharp(path.join(out, rel)).metadata();
      const stat = await fs.stat(path.join(out, rel));
      assets.push({ path: `assets/farm/${rel}`, width: meta.width, height: meta.height, alpha: meta.hasAlpha, bytes: stat.size });
    }
    manifest.species.push({ name, source: `assets/farm/new-animals/source/${name}.png`, frames: 6,
      idleBaseline: 301, motionBaseline: 360, extractedBoxes: poses.map(p => p.box), walkScale, assets });
  }
  const contact = await sharp({ create: { width: 384 * 8, height: 384 * 3, channels: 4, background: '#f3efe3' } })
    .composite(preview).png().toBuffer();
  await sharp(contact).resize(1536).webp({ quality: 90 }).toFile(path.join(out, 'new-animals/contact-a.webp'));
  await fs.writeFile(path.join(out, 'new-animals/manifest-a.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest.species.map(s => ({ name: s.name, assets: s.assets })), null, 2));
}

module.exports = { render, scaleFor };
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
