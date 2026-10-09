// Export imagegen atlases as ground-aligned runtime assets. Requires sharp.
// Usage: NODE_PATH=<bundled node_modules> node scripts/export-farm-motion.cjs walk.png poses.png rest.png
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const CELL = 384, BASELINE = 360;
const species = ['snowcat', 'rabbit', 'panda', 'fox', 'shiba', 'hedgehog', 'duckling', 'penguin'];

async function cells(file, cols, rows) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Imagegen arranges figures in a grid but can let a nose or tail cross a
  // cell boundary. Isolate complete connected figures BEFORE making cells.
  const N = info.width * info.height, labels = new Int32Array(N), queue = new Int32Array(N), components = [];
  let id = 0;
  for (let p = 0; p < N; p++) {
    if (labels[p] || data[p * 4 + 3] < 80) continue;
    id++; let first = 0, last = 1, x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
    queue[0] = p; labels[p] = id;
    while (first < last) {
      const q = queue[first++], x = q % info.width, y = Math.floor(q / info.width);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      const neighbours = [x > 0 ? q - 1 : -1, x < info.width - 1 ? q + 1 : -1, y > 0 ? q - info.width : -1, y < info.height - 1 ? q + info.width : -1];
      for (const k of neighbours) if (k >= 0 && !labels[k] && data[k * 4 + 3] >= 80) { labels[k] = id; queue[last++] = k; }
    }
    components.push({ id, size: last, x0, x1, y0, y1 });
  }
  const figures = components.sort((a, b) => b.size - a.size).slice(0, cols * rows).sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  if (figures.length !== cols * rows || figures.some(c => c.size < 5000)) throw new Error('Missing complete figures in atlas');
  const result = [];
  for (let row = 0; row < rows; row++) {
    const group = figures.slice(row * cols, (row + 1) * cols).sort((a, b) => a.x0 - b.x0);
    for (const c of group) {
      const left = Math.max(0, c.x0 - 3), top = Math.max(0, c.y0 - 3);
      const width = Math.min(info.width, c.x1 + 4) - left, height = Math.min(info.height, c.y1 + 4) - top;
      const pixels = Buffer.alloc(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const gx = x + left, gy = y + top, p = gy * info.width + gx;
        let keep = labels[p] === c.id;
        // Preserve the antialiased fur edge, excluding fragments from neighbours.
        if (!keep && data[p * 4 + 3] > 0 && data[p * 4 + 3] < 80) {
          for (let dy = -3; dy <= 3 && !keep; dy++) for (let dx = -3; dx <= 3 && !keep; dx++) {
            if (gx + dx >= 0 && gx + dx < info.width && gy + dy >= 0 && gy + dy < info.height && labels[(gy + dy) * info.width + gx + dx] === c.id) keep = true;
          }
        }
        if (keep) data.copy(pixels, (y * width + x) * 4, p * 4, p * 4 + 4);
      }
      const input = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
      result.push({ input, box: { width, height } });
    }
  }
  return result;
}
async function render(cell, scale) {
  const width = Math.round(cell.box.width * scale), height = Math.round(cell.box.height * scale);
  const input = await sharp(cell.input).resize(width, height).png().toBuffer();
  return sharp({ create: { width: CELL, height: CELL, channels: 4, background: '#00000000' } })
    .composite([{ input, left: Math.round((CELL - width) / 2), top: BASELINE - height }]).png().toBuffer();
}
function scaleFor(list) {
  return Math.min(CELL * .84 / Math.max(...list.map(c => c.box.width)),
    (BASELINE - 24) / Math.max(...list.map(c => c.box.height)));
}
async function main() {
  const [walk, poses, rest] = process.argv.slice(2);
  if (!rest) throw new Error('Provide walk, poses and rest atlas paths');
  const out = path.join(root, 'assets/farm/poses');
  await fs.mkdir(out, { recursive: true });
  await fs.mkdir(path.join(out, 'source'), { recursive: true });
  for (const [source, name] of [[walk,'snowcat-walk-v2.png'],[poses,'snowcat-postures.png'],[rest,'resting-animals.png']]) {
    const target = path.join(out,'source',name);
    if (path.resolve(source) !== target) await fs.copyFile(source,target);
  }
  const frames = await cells(walk, 4, 2), scale = scaleFor(frames);
  const rendered = await Promise.all(frames.map(c => render(c, scale)));
  await sharp({ create: { width: CELL * 8, height: CELL, channels: 4, background: '#00000000' } })
    .composite(rendered.map((input, i) => ({ input, left: i * CELL, top: 0 })))
    .webp({ quality: 86, alphaQuality: 100 }).toFile(path.join(root, 'assets/farm/walk/snowcat-v2.webp'));
  const postureCells = await cells(poses, 2, 2), postureScale = scaleFor(postureCells);
  for (let i = 0; i < postureCells.length; i++) {
    const buffer = await render(postureCells[i], postureScale);
    await sharp(buffer).webp({ quality: 86, alphaQuality: 100 }).toFile(path.join(out, `snowcat-${['stand', 'sleep', 'stretch', 'sniff'][i]}.webp`));
  }
  const rests = await cells(rest, 4, 2);
  for (let i = 0; i < rests.length; i++) {
    // Each species has its own scale; all poses keep a common ground anchor.
    const buffer = await render(rests[i], scaleFor([rests[i]]));
    if (i > 0) await sharp(buffer).webp({ quality: 86, alphaQuality: 100 }).toFile(path.join(out, `${species[i]}-sleep.webp`));
  }
  const cream = { create: { width: CELL * 4, height: CELL * 5, channels: 4, background: '#f4f0e5' } };
  const preview = rendered.map((input, i) => ({ input, left: (i % 4) * CELL, top: Math.floor(i / 4) * CELL }));
  for (let i = 0; i < postureCells.length; i++) preview.push({ input: await render(postureCells[i], postureScale), left: i * CELL, top: CELL * 2 });
  for (let i = 0; i < rests.length; i++) preview.push({ input: await render(rests[i], scaleFor([rests[i]])), left: (i % 4) * CELL, top: CELL * (3 + Math.floor(i / 4)) });
  const contact = await sharp(cream).composite(preview).png().toBuffer();
  await sharp(contact).resize(1024).webp({ quality: 88 }).toFile(path.join(root, 'docs/farm-motion-contact-sheet.webp'));
  const manifest = { generatedWith:'built-in imagegen', cell:{width:CELL,height:CELL}, groundBaselinePx:BASELINE, quality:86, alphaQuality:100, assets:[] };
  for (const name of (await fs.readdir(out)).filter(f=>f.endsWith('.webp'))) {
    const meta = await sharp(path.join(out,name)).metadata(), stat = await fs.stat(path.join(out,name));
    manifest.assets.push({path:name,width:meta.width,height:meta.height,bytes:stat.size});
  }
  await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const walkManifestPath = path.join(root,'assets/farm/walk/manifest.json');
  const walkManifest = JSON.parse(await fs.readFile(walkManifestPath,'utf8'));
  walkManifest.integrationStatus = 'integrated; distance-driven runtime in js/farm-motion.js; revised eight-frame snowcat-v2 active';
  walkManifest.revisions = [{species:'snowcat',path:'snowcat-v2.webp',frames:8,width:CELL*8,height:CELL,baselinePx:BASELINE,quality:86,alphaQuality:100,bytes:(await fs.stat(path.join(root,'assets/farm/walk/snowcat-v2.webp'))).size,source:'../poses/source/snowcat-walk-v2.png'}];
  await fs.writeFile(walkManifestPath,JSON.stringify(walkManifest,null,2)+'\n');
  console.log('Exported 8 walk frames, 4 cat postures, 7 other resting animals; baseline 360/384.');
}
module.exports={cells,render,scaleFor};
if(require.main===module)main().catch(e => { console.error(e); process.exitCode = 1; });
