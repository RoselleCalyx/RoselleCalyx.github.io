// NODE_PATH=<bundled node_modules> node tests/voyager-layout-runtime.cjs
// Browser zoom reduces the CSS viewport: 1024x768 at 150% is 683x512.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const base = process.env.VOYAGER_PREVIEW_URL || 'http://127.0.0.1:4173';
const out = '/tmp/voyager-layout-qa';
const sizes = [
  [1440, 960], [1280, 800], [1024, 768], [900, 650], [760, 650],
  [701, 700], [700, 700], [390, 844], [320, 568], [844, 390], [640, 480],
  [683, 512], [512, 384]
].map(([width, height]) => ({ width, height, textScale: 1 }));
sizes.push({ width: 390, height: 844, textScale: 2 }, { width: 683, height: 512, textScale: 2 });

// Range rectangles represent real rendered text lines, rather than the empty
// space in a wide container. Only the timeline is intentionally clipped in x.
async function layout(page) {
  return page.evaluate(() => {
    const rect = r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > .75 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > .75;
    const rendered = e => {
      if (e.closest('.sr-only,[hidden],[aria-hidden="true"]')) return false;
      const s = getComputedStyle(e);
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 && e.getClientRects().length > 0;
    };
    const groups = ['.v-topline', '.v-story', '.v-scene-caption', '.v-tools', '.v-dock'];
    const lines = [];
    for (const group of groups) {
      const root = document.querySelector(group);
      if (!root || !rendered(root)) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, e = node.parentElement;
        if (!node.textContent.trim() || !rendered(e)) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        const rail = e.closest('.v-timeline')?.getBoundingClientRect();
        for (const raw of range.getClientRects()) {
          const r = rect(raw);
          if (rail) { r.left = Math.max(r.left, rail.left); r.right = Math.min(r.right, rail.right); }
          if (r.right - r.left < .5 || r.bottom - r.top < .5) continue;
          lines.push({ ...r, group, label: `${e.id || e.className || e.tagName}: ${node.textContent.trim().slice(0, 60)}` });
        }
      }
    }
    const textOverlaps = [];
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      if (intersects(lines[i], lines[j])) textOverlaps.push([lines[i], lines[j]]);
    }
    const buttonOverlaps = [];
    for (const selector of ['.v-tools button', '.v-dock-head button']) {
      const buttons = [...document.querySelectorAll(selector)].filter(rendered)
        .map(e => ({ ...rect(e.getBoundingClientRect()), label: e.id }));
      for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
        if (intersects(buttons[i], buttons[j])) buttonOverlaps.push([buttons[i], buttons[j]]);
      }
    }
    const title = document.getElementById('vTitle'), titleBox = title.getBoundingClientRect();
    const titleClips = [];
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const range = document.createRange(); range.selectNodeContents(walker.currentNode);
      for (const r of range.getClientRects()) {
        if (r.left < titleBox.left - 1 || r.right > titleBox.right + 1 || r.top < titleBox.top - 1 || r.bottom > titleBox.bottom + 1)
          titleClips.push({ ancestor: 'title', text: walker.currentNode.textContent, rect: rect(r), box: rect(titleBox) });
        for (let e = title.parentElement; e && e !== document.documentElement; e = e.parentElement) {
          const s = getComputedStyle(e), b = e.getBoundingClientRect();
          // Page scrolling is allowed. A hidden/clip ancestor may not cut a title.
          if ((/hidden|clip/.test(s.overflowX) && (r.left < b.left - 1 || r.right > b.right + 1)) ||
              (/hidden|clip/.test(s.overflowY) && (r.top < b.top - 1 || r.bottom > b.bottom + 1)))
            titleClips.push({ ancestor: e.id || e.className, text: walker.currentNode.textContent, rect: rect(r), box: rect(b) });
        }
      }
    }
    const header = document.getElementById('site-header').getBoundingClientRect();
    const top = document.querySelector('.v-topline').getBoundingClientRect();
    const outsideMain = lines.filter(r => r.left < -1 || r.right > innerWidth + 1);
    return {
      textOverlaps, buttonOverlaps, titleClips, outsideMain,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      headerOverlap: top.top < header.bottom - 1,
      chapter: document.getElementById('voyager').dataset.stop
    };
  });
}

async function checkDialog(page, id) {
  const dialog = page.locator(`#${id}`);
  assert.equal(await dialog.evaluate(e => e.open), true, `${id} opens`);
  const initial = await dialog.evaluate(e => {
    const close = e.querySelector('.v-close').getBoundingClientRect(), box = e.getBoundingClientRect();
    return {
      closeVisible: close.left >= 0 && close.top >= 0 && close.right <= innerWidth + 1 && close.bottom <= innerHeight + 1,
      inViewport: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
      horizontalOverflow: e.scrollWidth > e.clientWidth + 1,
      scrollNeeded: e.scrollHeight > e.clientHeight + 1,
      overflowY: getComputedStyle(e).overflowY
    };
  });
  assert.ok(initial.closeVisible, `${id} close button stays visible: ${JSON.stringify(initial)}`);
  assert.ok(initial.inViewport, `${id} stays inside the viewport: ${JSON.stringify(initial)}`);
  assert.equal(initial.horizontalOverflow, false, `${id} content has no accidental horizontal overflow`);
  if (initial.scrollNeeded) {
    assert.ok(/auto|scroll/.test(initial.overflowY), `${id} overflowing content can scroll`);
    const end = await dialog.evaluate(e => { e.scrollTop = e.scrollHeight; return { top: e.scrollTop, max: e.scrollHeight - e.clientHeight }; });
    assert.ok(end.top > 0 && Math.abs(end.top - end.max) <= 1, `${id} scrolls to its final paragraph`);
  }
  if (id === 'vMap') {
    const lastStop = dialog.locator('.v-chapter [data-stop="beyond"]');
    await lastStop.scrollIntoViewIfNeeded();
    assert.ok(await lastStop.evaluate(e => {
      const r = e.getBoundingClientRect(), d = e.closest('dialog').getBoundingClientRect();
      return r.top >= d.top - 1 && r.bottom <= d.bottom + 1;
    }), 'the last chapter is reachable within the journey map');
  } else {
    const note = dialog.locator('#vArtNote');
    await note.scrollIntoViewIfNeeded();
    assert.ok(await note.evaluate(e => {
      const r = e.getBoundingClientRect(), d = e.closest('dialog').getBoundingClientRect();
      return r.bottom <= d.bottom + 1;
    }), 'the last field note is reachable');
  }
  await dialog.evaluate(e => { e.scrollTop = 0; });
  await dialog.locator('.v-close').click();
  assert.equal(await dialog.evaluate(e => e.open), false, `${id} closes`);
}

async function main() {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let checks = 0, chapterCount = 0;
    for (const size of sizes) {
      const name = `${size.width}x${size.height}${size.textScale > 1 ? '-root-text-200' : ''}`;
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(`${base}/voyager.html#departure`);
      await page.waitForFunction(() => window.VOYAGER_STOPS && document.getElementById('voyager').dataset.stop === 'departure');
      await page.evaluate(() => document.fonts.ready);
      if (size.textScale > 1) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const ids = await page.evaluate(() => VOYAGER_STOPS.map(s => s.id));
      chapterCount = ids.length; assert.equal(ids.length, 19);
      for (const id of ids) {
        await page.evaluate(id => { location.hash = id; window.scrollTo({ top: 0, behavior: 'instant' }); }, id);
        await page.waitForFunction(id => document.getElementById('voyager').dataset.stop === id, id);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const state = await layout(page), context = `${name} / ${id}`;
        assert.deepEqual(state.textOverlaps, [], `${context}: text overlaps`);
        assert.deepEqual(state.buttonOverlaps, [], `${context}: button groups overlap`);
        assert.deepEqual(state.titleClips, [], `${context}: title is clipped`);
        assert.deepEqual(state.outsideMain, [], `${context}: text escapes the viewport horizontally`);
        assert.equal(state.horizontalOverflow, false, `${context}: horizontal page overflow`);
        assert.equal(state.headerOverlap, false, `${context}: identity overlaps the fixed header`);
        checks++;
      }
      await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
      await page.locator('#vMapOpen').click();
      await checkDialog(page, 'vMap');
      await page.locator('#vJournalOpen').click();
      await checkDialog(page, 'vJournal');
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, chapterCount, viewportCount: sizes.length, layoutChecks: checks, errors, screenshots: out }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
