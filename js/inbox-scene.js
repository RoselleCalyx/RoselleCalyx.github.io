(() => {
  'use strict';

  const harbor = document.getElementById('inboxHarbor');
  const canvas = document.getElementById('inboxSky');
  if (!harbor || !canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const control = document.getElementById('harborCalm');
  const label = control && control.querySelector('.harbor-motion-label');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const random = (min, max) => min + Math.random() * (max - min);
  let calm = false;
  try { calm = localStorage.getItem('calm') === '1'; } catch (_) {}

  let width = 0;
  let height = 0;
  let density = 1;
  let timer = 0;
  let frame = 0;
  let meteor = null;
  let mounted = false;
  let resizeObserver = null;

  const isStill = () => calm || reducedMotion.matches;
  const canMove = () => mounted && !document.hidden && !isStill() && width > 0 && height > 0;

  function clearSky() {
    context.clearRect(0, 0, width, height);
  }

  function stop() {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    timer = 0;
    frame = 0;
    meteor = null;
    clearSky();
  }

  function resize() {
    const bounds = harbor.getBoundingClientRect();
    width = Math.max(0, bounds.width);
    height = Math.max(0, bounds.height);
    density = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    context.setTransform(density, 0, 0, density, 0, 0);
    // A changed crop should begin with an empty sky, rather than teleport a trail.
    stop();
    schedule(true);
  }

  function updateControl() {
    const still = isStill();
    document.body.classList.toggle('harbor-calm', still);
    document.documentElement.classList.toggle('harbor-calm', still);
    document.body.classList.toggle('harbor-paused', document.hidden || !mounted);
    if (!control) return;
    control.setAttribute('aria-pressed', String(still));
    control.disabled = reducedMotion.matches;
    const text = reducedMotion.matches ? 'Quiet sky' : calm ? 'Resume sky' : 'Calm sea';
    if (label) label.textContent = text;
    control.setAttribute('aria-label', reducedMotion.matches
      ? 'Motion reduced to match your system preference'
      : calm ? 'Resume sea shimmer and meteors' : 'Pause sea shimmer and meteors');
    control.title = reducedMotion.matches ? 'Following the system’s reduced motion preference' : text;
  }

  function applyPreference() {
    updateControl();
    stop();
    schedule(true);
  }

  function schedule(first) {
    clearTimeout(timer);
    timer = 0;
    if (!canMove()) return;
    timer = setTimeout(() => {
      timer = 0;
      if (!canMove()) return;
      startMeteor();
    }, first ? random(4000, 8000) : random(15000, 30000));
  }

  function pointAt(m, progress) {
    const inverse = 1 - progress;
    return {
      x: inverse * inverse * m.x0 + 2 * inverse * progress * m.cx + progress * progress * m.x1,
      y: inverse * inverse * m.y0 + 2 * inverse * progress * m.cy + progress * progress * m.y1,
    };
  }

  function startMeteor() {
    const narrow = width < 700;
    const length = Math.min(width * random(narrow ? 0.17 : 0.2, narrow ? 0.25 : 0.28), height * 0.32);
    const x0 = width * random(narrow ? 0.91 : 0.57, narrow ? 0.98 : 0.73);
    const y0 = height * random(narrow ? 0.07 : 0.025, narrow ? 0.105 : 0.065);
    const angle = random(narrow ? 0.58 : 0.34, narrow ? 0.76 : 0.48);
    const x1 = Math.max(width * 0.055, x0 - length * Math.cos(angle));
    const y1 = Math.min(height * (narrow ? 0.20 : 0.15), y0 + length * Math.sin(angle));
    meteor = {
      x0, y0, x1, y1,
      cx: (x0 + x1) / 2,
      cy: (y0 + y1) / 2 + random(-2, 3),
      duration: random(1700, 2300),
      started: performance.now(),
      size: Math.min(1.25, Math.max(0.65, width / 1300)),
    };
    frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    if (!canMove() || !meteor) {
      stop();
      return;
    }
    const m = meteor;
    const progress = Math.max(0, (now - m.started) / m.duration);
    clearSky();
    if (progress >= 1) {
      meteor = null;
      schedule(false);
      return;
    }

    const enter = Math.min(1, progress / 0.14);
    const leave = Math.min(1, (1 - progress) / 0.34);
    const opacity = Math.sin(enter * Math.PI / 2) * leave * leave;
    const headProgress = progress * (0.88 + 0.12 * progress);
    const tailProgress = Math.max(0, headProgress - Math.min(0.46, progress * 0.66));
    const head = pointAt(m, headProgress);
    const segments = 38;
    let previous = pointAt(m, tailProgress);

    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    // Each strand tapers into darkness, with a pale, slightly curved wake.
    for (let i = 1; i <= segments; i++) {
      const fraction = i / segments;
      const point = pointAt(m, tailProgress + (headProgress - tailProgress) * fraction);
      const strength = opacity * Math.pow(fraction, 1.9);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.lineWidth = (0.3 + fraction * 2.0) * m.size;
      context.strokeStyle = `rgba(154,192,235,${strength * 0.13})`;
      context.stroke();
      context.lineWidth = (0.12 + fraction * 0.78) * m.size;
      context.strokeStyle = fraction > 0.88
        ? `rgba(255,233,202,${strength * 0.68})`
        : `rgba(215,230,250,${strength * 0.5})`;
      context.stroke();
      previous = point;
    }

    const radius = 7.5 * m.size;
    const glow = context.createRadialGradient(head.x, head.y, 0, head.x, head.y, radius);
    glow.addColorStop(0, `rgba(255,244,224,${opacity * 0.7})`);
    glow.addColorStop(0.18, `rgba(255,216,169,${opacity * 0.34})`);
    glow.addColorStop(0.48, `rgba(176,213,249,${opacity * 0.07})`);
    glow.addColorStop(1, 'rgba(176,213,249,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(head.x, head.y, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = `rgba(255,247,230,${opacity * 0.82})`;
    context.beginPath();
    context.arc(head.x, head.y, 0.8 * m.size, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    frame = requestAnimationFrame(draw);
  }

  function toggleCalm() {
    if (reducedMotion.matches) return;
    calm = !calm;
    try { localStorage.setItem('calm', calm ? '1' : '0'); } catch (_) {}
    applyPreference();
    window.dispatchEvent(new CustomEvent('skycalm', { detail: calm }));
  }

  function onSkyCalm(event) {
    if (typeof event.detail !== 'boolean' || event.detail === calm) return;
    calm = event.detail;
    applyPreference();
  }

  function onStorage(event) {
    if (event.key !== 'calm' && event.key !== null) return;
    try { calm = localStorage.getItem('calm') === '1'; } catch (_) { return; }
    applyPreference();
  }

  function onVisibility() {
    updateControl();
    stop();
    schedule(true);
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    try { calm = localStorage.getItem('calm') === '1'; } catch (_) {}
    if (control) control.addEventListener('click', toggleCalm);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('storage', onStorage);
    window.addEventListener('skycalm', onSkyCalm);
    reducedMotion.addEventListener('change', applyPreference);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(harbor);
    }
    updateControl();
    resize();
  }

  function unmount() {
    mounted = false;
    document.body.classList.add('harbor-paused');
    stop();
    if (control) control.removeEventListener('click', toggleCalm);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', resize);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('skycalm', onSkyCalm);
    reducedMotion.removeEventListener('change', applyPreference);
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
  }

  window.addEventListener('pagehide', unmount);
  window.addEventListener('pageshow', event => {
    if (event.persisted) mount();
  });
  mount();
})();
