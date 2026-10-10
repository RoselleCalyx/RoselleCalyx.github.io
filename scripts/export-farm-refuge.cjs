// Match the farm's transparent imagegen -> WebP scenery workflow.
const fs = require('node:fs/promises'), path = require('node:path'), sharp = require('sharp');
async function main() {
  const root = path.resolve(__dirname, '..');
  const source = path.join(root, 'assets/farm/scenery/source/winter-refuge-v1.png');
  if (process.argv[2]) {
    await fs.mkdir(path.dirname(source), { recursive: true });
    if (path.resolve(process.argv[2]) !== source) await fs.copyFile(process.argv[2], source);
  }
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const p = (y * info.width + x) * 4;
    // Discard only nearly invisible alpha noise outside the painted silhouette.
    if (data[p + 3] < 8) { data[p + 3] = 0; continue; }
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 <= x0 || y1 <= y0) throw Error('Missing refuge silhouette');
  const margin = 16, left = Math.max(0, x0 - margin), top = Math.max(0, y0 - margin);
  const width = Math.min(info.width, x1 + margin + 1) - left;
  const height = Math.min(info.height, y1 + margin + 1) - top;
  const target = path.join(root, 'assets/farm/scenery/winter-refuge-v1.webp');
  await sharp(data, { raw: info }).extract({ left, top, width, height })
    .resize(720).webp({ quality: 88, alphaQuality: 100 }).toFile(target);
  const meta = await sharp(target).metadata(), stat = await fs.stat(target);
  console.log(JSON.stringify({ target, width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha, bytes: stat.size }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
