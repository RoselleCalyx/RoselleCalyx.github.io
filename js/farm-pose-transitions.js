/* Pose changes fade one complete painted silhouette into the next. The outgoing
   gait is frozen before setPose/place changes its frames; the incoming art stays
   live, including distance-driven feet and reaction canvases. */
(function () {
  const DURATION = 280;
  const ART = '.animal-sprite, .walk-sprite, .jump-sprite, .pose-sprite, .reaction-art';
  const records = new WeakMap(), active = new Set();
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const jumpReactions = new Set(['happy-hop', 'binky', 'pounce']);
  // Copy only presentation, without the original classes: ancestor pose rules
  // must never change a frozen frame. Percentage dimensions preserve its anchor.
  const presentation = ['object-fit', 'object-position', 'background-image',
    'background-size', 'background-position', 'background-repeat', 'transform',
    'transform-origin', 'filter', 'clip-path', 'mask-image', 'mask-size',
    'mask-position', 'mask-repeat', '-webkit-mask-image', '-webkit-mask-size',
    '-webkit-mask-position', '-webkit-mask-repeat', 'mix-blend-mode'];
  const quiet = () => preference.matches || document.body.classList.contains('farm-reduced-motion') || document.body.classList.contains('farm-calm');

  function visibleMode(el) {
    const c = el.classList;
    if (c.contains('jump-ready') && (c.contains('leaping') || [...jumpReactions].some(k => c.contains('react-' + k)))) return 'jump';
    if (c.contains('reaction-ready')) return 'reaction';
    if (c.contains('walk-ready') && (c.contains('walking') || c.contains('hopping'))) return 'walk';
    const pose = el.dataset.pose;
    return pose && pose !== 'walk' ? pose : 'sit';
  }
  function nextMode(a, pose) {
    const c = a.el.classList, kind = a.reaction && a.reaction.kind;
    if (c.contains('jump-ready') && (a.state === 'hop' || jumpReactions.has(kind))) return 'jump';
    if (c.contains('reaction-ready') && kind && kind !== 'nap' && kind !== 'shake') return 'reaction';
    if (c.contains('walk-ready') && a.state === 'walk') return 'walk';
    return pose === 'walk' ? 'sit' : pose;
  }
  function layer() {
    const node = document.createElement('div');
    node.className = 'pose-transition-layer';
    return node;
  }
  function frozenArt(source, opacity) {
    const node = source.cloneNode(false), style = getComputedStyle(source);
    node.className = 'pose-transition-art';
    node.removeAttribute('id'); node.removeAttribute('data-pose');
    node.removeAttribute('style'); node.setAttribute('aria-hidden', 'true');
    presentation.forEach(property => node.style.setProperty(property, style.getPropertyValue(property)));
    node.style.opacity = opacity;
    if (source instanceof HTMLCanvasElement) node.getContext('2d').drawImage(source, 0, 0);
    return node;
  }
  function captureMode(record, mode) {
    const node = layer(), live = record.live;
    const append = (source, opacity = 1) => { if (source && opacity > 0) node.append(frozenArt(source, opacity)); };
    if (mode === 'walk' || mode === 'jump') {
      const blend = Math.max(0, Math.min(1, Number(getComputedStyle(record.a.el).getPropertyValue(mode === 'walk' ? '--gait-blend' : '--jump-blend')) || 0));
      append(live.querySelector('.' + mode + '-sprite:not(.' + mode + '-sprite-next)'), 1 - blend);
      append(live.querySelector('.' + mode + '-sprite-next'), blend);
    } else if (mode === 'reaction') append(live.querySelector('.reaction-art'));
    else append(live.querySelector(mode === 'sit' ? '.animal-sprite' : `.pose-sprite[data-pose="${mode}"]`));
    return node;
  }
  function copyFrozen(source) {
    const copy = source.cloneNode(true);
    const originals = source.querySelectorAll('canvas'), copies = copy.querySelectorAll('canvas');
    originals.forEach((canvas, i) => copies[i].getContext('2d').drawImage(canvas, 0, 0));
    return copy;
  }
  function capture(record) {
    if (!record.old) return captureMode(record, record.mode);
    // A second request starts from the exact blend currently on screen, not an
    // opaque old pose. Keep normalized weights when transitions are interrupted.
    const node = layer(), old = copyFrozen(record.old), incoming = captureMode(record, record.mode);
    old.className = 'pose-transition-layer';
    incoming.style.opacity = record.live.style.opacity;
    node.append(old, incoming);
    return node;
  }
  function finishRecord(record) {
    cancelAnimationFrame(record.frame);
    record.frame = 0;
    if (record.old) record.old.remove();
    record.old = null;
    record.live.style.removeProperty('opacity');
    record.a.el.classList.remove('pose-changing');
    record.mode = visibleMode(record.a.el);
    active.delete(record);
  }
  function start(record, mode) {
    if (quiet() || record.suppressed || !record.a.el.isConnected || record.a.el.getBoundingClientRect().width === 0) {
      finishRecord(record); record.mode = mode; return;
    }
    const old = capture(record);
    if (!old.childElementCount) { finishRecord(record); record.mode = mode; return; }
    cancelAnimationFrame(record.frame);
    if (record.old) record.old.remove();
    old.classList.add('pose-transition-old');
    old.style.opacity = '1';
    record.old = old; record.mode = mode;
    record.live.after(old);
    record.live.style.opacity = '0';
    record.a.el.classList.add('pose-changing');
    active.add(record);
    const started = performance.now();
    const tick = now => {
      if (quiet() || !record.a.el.isConnected) { finishRecord(record); return; }
      const t = Math.min(1, Math.max(0, (now - started) / DURATION));
      const weight = t * t * (3 - 2 * t);
      record.live.style.opacity = String(weight);
      old.style.opacity = String(1 - weight);
      if (t === 1) finishRecord(record);
      else record.frame = requestAnimationFrame(tick);
    };
    record.frame = requestAnimationFrame(tick);
  }
  function install(a) {
    let record = records.get(a.el);
    if (record) return record;
    const bob = a.el.querySelector('.bob');
    if (!bob) return null;
    const live = document.createElement('div');
    live.className = 'pose-live';
    // Water ripples and bite treats stay outside this isolated art group.
    [...bob.children].filter(node => node.matches(ART)).forEach(node => live.append(node));
    bob.prepend(live);
    record = { a, live, mode: visibleMode(a.el), frame: 0, old: null, suppressed: false };
    records.set(a.el, record);
    new MutationObserver(() => {
      const mode = visibleMode(a.el);
      if (mode === record.mode) return;
      // A pose hook and place/reaction drawing run synchronously together. Let
      // their final live target settle without restarting that same fade.
      if (record.old || record.suppressed) record.mode = mode;
      else start(record, mode);
    }).observe(a.el, { attributes: true, attributeFilter: ['class', 'data-pose'] });
    return record;
  }
  function before(a, pose) {
    const initial = !a.el.dataset.pose, record = install(a);
    if (!record) return;
    const mode = nextMode(a, pose);
    if (initial) record.mode = mode;
    else if (mode !== record.mode) start(record, mode);
  }
  function finish(a) {
    const record = records.get(a.el);
    if (record) finishRecord(record);
  }
  function cancel(a) {
    const record = records.get(a.el);
    if (!record) return;
    finishRecord(record);
    record.suppressed = true;
    // A habitat relocation can synchronously replace classes, position and pose.
    // Suppress its observer too, so no water-masked silhouette crosses habitats.
    requestAnimationFrame(() => { record.suppressed = false; record.mode = visibleMode(a.el); });
  }
  const finishActive = () => { if (quiet()) [...active].forEach(finishRecord); };
  preference.addEventListener('change', finishActive);
  new MutationObserver(finishActive).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.FarmPoseTransitions = { before, finish, cancel, duration: DURATION };
})();
