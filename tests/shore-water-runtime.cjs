// Self-contained browser regression: node tests/shore-water-runtime.cjs
// Uses local Chrome; never submits a letter or host credentials to a service.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('/Users/cassini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
let sharp;
try { sharp = require('sharp'); }
catch (_) { sharp = require('/Users/cassini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'); }

const root = path.resolve(__dirname, '..');
const output = process.env.SHORE_WATER_QA_DIR || '/tmp/shore-water-qa';
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.json':'application/json', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const probes = {
  message: { sky:[.25,.30], rock:[.20,.92], water:[.25,.70] },
  harbor: { sky:[.25,.30], person:[.24,.64], dock:[.40,.84], boat:[.365,.55], water:[.46,.64] }
};

async function serve() {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/water-qa-away') {
        response.writeHead(200, { 'Content-Type':'text/html' });
        response.end('<!doctype html><title>Water test navigation</title><p>Return to the shore.</p>');
        return;
      }
      const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!filename.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
      const body = await fs.readFile(filename);
      response.writeHead(200, { 'Content-Type':MIME[path.extname(filename)] || 'application/octet-stream' });
      response.end(body);
    } catch (_) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, base:`http://127.0.0.1:${server.address().port}` };
}

// Capture only requested frames, immediately after the draw. WebGL's default
// drawing buffer may be cleared by presentation before a later page.evaluate.
function instrumentation({ forceCanvas }) {
  const nativeContext = HTMLCanvasElement.prototype.getContext;
  const qa = window.__shoreWaterQA = { request:null, last:null };
  if (forceCanvas) HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    if (type === 'webgl' && this.dataset.waterScene) return null;
    return nativeContext.call(this, type, ...args);
  };
  function capture(context, gl) {
    const canvas = context.canvas;
    if (!qa.request || !canvas.dataset.waterScene) return;
    const { width, height } = canvas;
    const rgba = new Uint8Array(width * height * 4);
    if (gl) context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, rgba);
    else rgba.set(context.getImageData(0, 0, width, height).data);
    const at = (x,y) => {
      const ix = Math.min(width - 1, Math.max(0, Math.round(x)));
      const iy = Math.min(height - 1, Math.max(0, Math.round(y)));
      const start = ((gl ? height - 1 - iy : iy) * width + ix) * 4;
      return Array.from(rgba.subarray(start, start + 4));
    };
    const host = canvas.parentElement, image = host.querySelector('img');
    const box = image.getBoundingClientRect(), bounds = host.getBoundingClientRect();
    const style = getComputedStyle(image), position = style.objectPosition.split(/\s+/).map(parseFloat);
    const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const imageWidth = image.naturalWidth * scale, imageHeight = image.naturalHeight * scale;
    const geometry = {
      x:box.left - bounds.left + (box.width - imageWidth) * position[0] / 100,
      y:box.top - bounds.top + (box.height - imageHeight) * position[1] / 100,
      width:imageWidth, height:imageHeight,
      box:{ x:box.left - bounds.left, y:box.top - bounds.top, width:box.width, height:box.height }
    };
    const sx = width / bounds.width, sy = height / bounds.height;
    const requested = Object.fromEntries(Object.entries(qa.request.probes).map(([name,[u,v]]) => {
      const x = geometry.x + u * imageWidth, y = geometry.y + v * imageHeight;
      return [name, { visible:x >= 0 && x < bounds.width && y >= 0 && y < bounds.height, rgba:at(x*sx,y*sy), source:[u,v] }];
    }));
    const samples = [];
    for (let y = 0; y < height; y += Math.max(1,Math.floor(height/40)))
      for (let x = 0; x < width; x += Math.max(1,Math.floor(width/48))) samples.push(at(x,y));
    const belowImage = at(width * .5, (geometry.box.y + geometry.box.height + 12) * sy);
    qa.last = { renderer:canvas.dataset.renderer, samples, probes:requested, geometry, belowImage, width, height };
    qa.request = null;
  }
  const draw = WebGLRenderingContext.prototype.drawArrays;
  WebGLRenderingContext.prototype.drawArrays = function(...args) { const result = draw.apply(this,args); capture(this,true); return result; };
  const drawImage = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function(...args) {
    const result = drawImage.apply(this,args);
    if (this.globalCompositeOperation === 'destination-in') capture(this,false);
    return result;
  };
}

async function pixels(page, scene, extra = {}) {
  await page.evaluate(points => { __shoreWaterQA.last = null; __shoreWaterQA.request = { probes:points }; }, { ...probes[scene], ...extra });
  await page.waitForFunction(() => !!__shoreWaterQA.last, null, { timeout:5000 });
  return page.evaluate(() => __shoreWaterQA.last);
}
async function frame(page) { return Number(await page.locator('canvas[data-water-scene]').getAttribute('data-water-frame')); }
async function running(page) {
  await page.waitForFunction(() => document.querySelector('canvas[data-water-scene]')?.dataset.waterState === 'running', null, { timeout:10000 });
}
async function frozen(page, label) {
  await page.waitForFunction(() => document.querySelector('canvas[data-water-scene]')?.dataset.waterState === 'paused');
  // Let resize/intersection observers settle independently of animation.
  await page.waitForTimeout(100);
  const before = await frame(page); await page.waitForTimeout(450);
  assert.equal(await frame(page), before, label + ' must stop drawing water frames');
}
async function resumes(page, label) {
  const before = await frame(page); await running(page);
  await page.waitForFunction(count => Number(document.querySelector('canvas[data-water-scene]').dataset.waterFrame) > count + 2, before);
  assert.ok(await frame(page) > before + 2, label + ' must restart water frames');
}
function assertWaterPixels(first, second, label) {
  let water = 0, changed = 0;
  first.samples.forEach((rgba,index) => {
    const after = second.samples[index];
    if (rgba[3] > 32 && after[3] > 32) {
      water++;
      if (rgba.slice(0,3).some((value,channel) => value !== after[channel])) changed++;
    }
  });
  assert.ok(water > 20, label + ': the water overlay needs nontransparent pixels');
  assert.ok(changed >= Math.max(4,water*.005), `${label}: water must visibly change over time (${changed}/${water} sampled pixels)`);
  for (const [name,probe] of Object.entries(second.probes)) {
    assert.ok(probe.visible, label + ': source probe ' + name + ' must be visible in this crop');
    if (name === 'water') assert.ok(probe.rgba[3] > 180, label + ': unobstructed sea must be rendered');
    else if (name !== 'fade') assert.ok(probe.rgba[3] <= 3, `${label}: ${name} must be excluded from the water overlay (${probe.rgba})`);
  }
  return { water, changed };
}
async function checkControls(page, scene) {
  if (scene === 'message') {
    await page.locator('#bText').fill('A water rendering check.');
    await page.locator('#bName').fill('Water QA');
    assert.equal(await page.locator('#bText').inputValue(),'A water rendering check.');
    assert.equal(await page.locator('#bName').inputValue(),'Water QA');
  } else {
    await page.locator('#loginPanel').waitFor({ state:'visible' });
    await page.locator('#hostEmail').fill('water-qa@example.invalid');
    await page.locator('#hostPassword').fill('local-rendering-check');
    assert.equal(await page.locator('#hostEmail').inputValue(),'water-qa@example.invalid');
    assert.equal(await page.locator('#hostPassword').inputValue(),'local-rendering-check');
  }
  assert.equal(await page.locator('canvas[data-water-scene]').evaluate(canvas => getComputedStyle(canvas).pointerEvents),'none');
}
async function checkLifecycle(page, scene, base, label) {
  if (scene === 'message') await page.evaluate(() => Sky.setCalm(true));
  else await page.locator('#harborCalm').click();
  await frozen(page,'Calm mode');
  if (scene === 'message') await page.evaluate(() => Sky.setCalm(false));
  else await page.locator('#harborCalm').click();
  await resumes(page,'Leaving calm mode');
  console.log(`[shore-water] ${label}: calm pause/resume passed`);

  await page.emulateMedia({ reducedMotion:'reduce' }); await frozen(page,'Reduced motion');
  await page.emulateMedia({ reducedMotion:'no-preference' }); await resumes(page,'Restoring motion preference');
  console.log(`[shore-water] ${label}: reduced-motion pause/resume passed`);

  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide',{ persisted:true })));
  await frozen(page,'Persisted pagehide');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow',{ persisted:true })));
  await resumes(page,'Persisted pageshow');
  console.log(`[shore-water] ${label}: persisted page lifecycle passed`);

  // Native history return can use BFCache or reload depending on Chrome policy.
  // The synthetic persisted pair above specifically exercises the BFCache path.
  const shoreURL = page.url();
  await page.goto(base + '/water-qa-away');
  await page.goBack({ waitUntil:'commit', timeout:15000 });
  await page.waitForURL(shoreURL,{ waitUntil:'commit', timeout:15000 });
  await running(page);
  await resumes(page,'History return');
  console.log(`[shore-water] ${label}: native history return passed`);
}

async function checkFilePreview(browser, scene) {
  const label = `${scene}-desktop-file-preview`;
  console.log(`[shore-water] ${label}: starting`);
  const context = await browser.newContext({ viewport:{ width:1440,height:960 }, deviceScaleFactor:1, reducedMotion:'no-preference' });
  try {
    await context.route('**/*', route => new URL(route.request().url()).protocol === 'file:' ? route.continue() : route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root,scene === 'message' ? 'message.html' : 'inbox.html')).href);
    await running(page);
    const water = page.locator('canvas[data-water-scene]');
    assert.equal(await water.getAttribute('data-renderer'),'canvas',label + ': local image must use the Canvas fallback');
    const beforeFrame = await frame(page);
    // Local-image canvases are tainted. Browser screenshots remain available;
    // isolate the overlay to compare its pixels without reading the canvas.
    const isolation = await page.addStyleTag({ content:'html,body { background:transparent !important; } body * { visibility:hidden !important; } canvas[data-water-scene] { visibility:visible !important; }' });
    const first = await water.screenshot({ omitBackground:true });
    await page.waitForTimeout(1100);
    const second = await water.screenshot({ omitBackground:true });
    await isolation.evaluate(style => style.remove());
    assert.ok(await frame(page) > beforeFrame + 2,label + ': fallback must continue advancing frames');
    const a = await sharp(first).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
    const b = await sharp(second).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
    assert.deepEqual(a.info,b.info,label + ': screenshot dimensions must stay stable');
    let waterPixels = 0, changed = 0;
    for (let offset = 0; offset < a.data.length; offset += 4) {
      if (a.data[offset+3] > 32 && b.data[offset+3] > 32) {
        waterPixels++;
        if (a.data[offset] !== b.data[offset] || a.data[offset+1] !== b.data[offset+1] || a.data[offset+2] !== b.data[offset+2]) changed++;
      }
    }
    assert.ok(waterPixels > 100,label + ': fallback must paint visible water');
    assert.ok(changed > 20,label + ': local-file water pixels must move');
    await page.screenshot({ path:path.join(output,label + '.png'), fullPage:true });
    await checkControls(page,scene);
    assert.deepEqual(errors,[],label + ': no uncaught browser errors');
    console.log(`[shore-water] ${label}: passed`);
    return { label, renderer:'canvas', waterPixels, changed };
  } finally { await context.close(); }
}

async function main() {
  await fs.mkdir(output,{ recursive:true });
  const { server,base } = await serve();
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ executablePath:chrome, headless:true, ignoreDefaultArgs:['--disable-back-forward-cache'], args:['--enable-webgl','--enable-unsafe-swiftshader'] });
    for (const forceCanvas of [false,true]) for (const mobile of [false,true]) for (const scene of ['message','harbor']) {
      const size = mobile ? { width:390,height:844 } : { width:1440,height:960 };
      const label = `${scene}-${mobile?'mobile':'desktop'}-${forceCanvas?'canvas':'webgl'}`;
      console.log(`[shore-water] ${label}: starting`);
      const context = await browser.newContext({ viewport:size, deviceScaleFactor:1, reducedMotion:'no-preference' });
      try {
        // Keep the test local even if production config includes a message API.
        await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
        await context.addInitScript(instrumentation,{ forceCanvas });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/' + (scene === 'message' ? 'message.html' : 'inbox.html'));
        await running(page);
        const renderer = await page.locator('canvas[data-water-scene]').getAttribute('data-renderer');
        assert.equal(renderer, forceCanvas ? 'canvas' : 'webgl', label + ': expected renderer');
        const first = await pixels(page,scene);
        await page.waitForTimeout(1100);
        const second = await pixels(page,scene,mobile && scene === 'harbor' ? { fade:[.495,.85] } : {});
        await page.screenshot({ path:path.join(output,label + '.png'), fullPage:true });
        const movement = assertWaterPixels(first,second,label);
        console.log(`[shore-water] ${label}: moving pixels and object masks passed`);
        if (mobile && scene === 'harbor') {
          assert.equal(second.belowImage[3],0,label + ': mobile overlay must end at the background image box');
          assert.ok(second.probes.fade.rgba[3] > 5 && second.probes.fade.rgba[3] < 220,label + ': mobile overlay must fade with the masked background');
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),label + ': no horizontal overflow');
        if (!mobile) await checkLifecycle(page,scene,base,label);
        await checkControls(page,scene);
        assert.deepEqual(errors,[],label + ': no uncaught browser errors');
        results.push({ label, renderer, canvas:[second.width,second.height], ...movement });
        console.log(`[shore-water] ${label}: passed`);
      } finally { await context.close(); }
    }
    for (const scene of ['message','harbor']) results.push(await checkFilePreview(browser,scene));
    console.log(JSON.stringify({ passed:true, results, screenshots:output },null,2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
