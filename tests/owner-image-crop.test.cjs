const test = require('node:test');
const assert = require('node:assert/strict');
const { cropGeometry, dragPosition, headerDimensions, validateSourceSize } = require('../js/owner-images.js');
const nearly = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} differs from ${expected}`);

test('portrait crop uses the same centered source area for preview and export without stretching', () => {
  const crop = cropGeometry(400, 300, 3 / 4);
  assert.deepEqual(crop, { sx: 87.5, sy: 0, sw: 225, sh: 300, width: 225, height: 300 });
  nearly(crop.sw / crop.sh, crop.width / crop.height);
});

test('zoom and edge positioning stay entirely inside the source image', () => {
  for (const ratio of [0.1, 3 / 4, 1, 4 / 3, 16 / 9, 10]) {
    for (const zoom of [1, 1.5, 4]) for (const x of [0, .5, 1]) for (const y of [0, .5, 1]) {
      const crop = cropGeometry(4032, 3024, ratio, zoom, x, y);
      assert.ok(crop.sx >= 0 && crop.sy >= 0);
      assert.ok(crop.sx + crop.sw <= 4032.000001 && crop.sy + crop.sh <= 3024.000001);
      nearly(crop.sw / crop.sh, ratio);
      assert.ok(crop.width <= 2048 && crop.height <= 2048);
      assert.ok(Math.abs(crop.width / crop.height - ratio) <= 1 / crop.height + ratio / crop.height);
    }
  }
});

test('original proportions retain the whole image at the default zoom and never upscale', () => {
  assert.deepEqual(cropGeometry(200, 100, 2), { sx: 0, sy: 0, sw: 200, sh: 100, width: 200, height: 100 });
  assert.deepEqual(cropGeometry(6000, 4000, 1.5), { sx: 0, sy: 0, sw: 6000, sh: 4000, width: 2048, height: 1365 });
});

test('dragging the displayed picture right moves the selected source left, with edge clamping', () => {
  const crop = cropGeometry(400, 300, 3 / 4);
  const position = dragPosition(crop, 400, 300, 225, 300, .5, .5, 50, 20);
  nearly(position.x, .5 - 50 / 175); nearly(position.y, .5);
  assert.equal(dragPosition(crop, 400, 300, 225, 300, .5, .5, 1000, 0).x, 0);
  assert.equal(dragPosition(crop, 400, 300, 225, 300, .5, .5, -1000, 0).x, 1);
});

test('zoomed drag uses frame coordinates and can move vertically without blank margins', () => {
  const crop = cropGeometry(400, 300, 1, 2);
  const position = dragPosition(crop, 400, 300, 300, 300, .5, .5, 30, -30);
  nearly(position.x, .44); nearly(position.y, .6);
});

test('invalid source dimensions are rejected and control values cannot escape valid ranges', () => {
  for (const dimensions of [[0, 3, 1], [3, -1, 1], [3, 2, 0], [3, 2, NaN], [Infinity, 2, 1]]) assert.throws(() => cropGeometry(...dimensions), /Invalid crop/);
  assert.deepEqual(cropGeometry(400, 300, 1, 99, -1, 10), cropGeometry(400, 300, 1, 4, 0, 1));
});


test('common raster headers reveal oversized dimensions before a bitmap is allocated', () => {
  const png = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.write('IHDR', 12); png.writeUInt32BE(9000, 16); png.writeUInt32BE(7000, 20);
  assert.deepEqual(headerDimensions(png), { width:9000, height:7000 }); assert.throws(() => validateSourceSize(9000, 7000), /too large/);
  const jpeg = Buffer.from([255,216,255,192,0,8,8,3,32,4,176,3]);
  assert.deepEqual(headerDimensions(jpeg), { width:1200, height:800 });
  const gif = Buffer.alloc(10); gif.write('GIF89a'); gif.writeUInt16LE(600, 6); gif.writeUInt16LE(800, 8);
  assert.deepEqual(headerDimensions(gif), { width:600, height:800 });
  assert.equal(headerDimensions(Buffer.alloc(3)), null); assert.equal(headerDimensions(jpeg.subarray(0, 10)), null);
  assert.doesNotThrow(() => validateSourceSize(8000, 4000)); assert.throws(() => validateSourceSize(16385, 1), /too large/);
});

test('extended, lossless and lossy WebP headers are read without interpreting file contents as code', () => {
  const webp = (kind, data) => { const bytes = Buffer.alloc(20 + data.length); bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WEBP', 8); bytes.write(kind, 12); bytes.writeUInt32LE(data.length, 16); data.copy(bytes, 20); return bytes; };
  const extended = Buffer.alloc(10); extended.writeUIntLE(1199, 4, 3); extended.writeUIntLE(799, 7, 3);
  const lossless = Buffer.alloc(5); lossless[0] = 47; lossless.writeUInt32LE(1199 | 799 << 14, 1);
  const lossy = Buffer.from([0,0,0,157,1,42,176,4,32,3]);
  for (const [kind, data] of [['VP8X',extended],['VP8L',lossless],['VP8 ',lossy]]) assert.deepEqual(headerDimensions(webp(kind, data)), { width:1200, height:800 });
});
