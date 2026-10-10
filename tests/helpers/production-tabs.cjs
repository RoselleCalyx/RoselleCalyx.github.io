const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the production listeners without unrelated page chrome or renderers.
// Fixtures provide only DOM primitives; keyboard behavior stays in common.js.
const source = fs.readFileSync(path.join(__dirname, '../../js/common.js'), 'utf8');
const start = source.indexOf('/* ---------- keyboard tabs ---------- */');
const end = source.indexOf('/* ---------- toast ---------- */', start);
const focusStart = source.indexOf('const focus = (el) =>');
const focusEnd = source.indexOf('function lockPageScroll()', focusStart);
module.exports = function productionTabs(context) {
  vm.runInNewContext(source.slice(start, end) + source.slice(focusStart, focusEnd) + '\n globalThis.__tabs = tabs;', context);
  return context.__tabs;
};
