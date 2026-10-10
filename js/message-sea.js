/* Small, infrequent movements over the generated night-sea photograph. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let calm = false, timer, active = true;
  try { calm = localStorage.getItem('calm') === '1'; } catch (_) {}
  const effects = document.getElementById('seaEffects');
  function meteor() {
    if (reduce.matches || calm || document.hidden || !active) return;
    const m = document.createElement('i');
    m.className = 'quiet-meteor'; m.style.left = (48 + Math.random() * 36) + '%'; m.style.top = (11 + Math.random() * 15) + '%';
    effects.appendChild(m); setTimeout(() => m.remove(), 2600);
  }
  function schedule() {
    clearTimeout(timer);
    if (!calm && !reduce.matches && !document.hidden && active) timer = setTimeout(() => { meteor(); schedule(); }, 24000 + Math.random() * 22000);
  }
  function apply() {
    document.body.classList.toggle('sea-calm', calm || reduce.matches);
    document.body.classList.toggle('sea-paused', document.hidden || !active);
    effects.querySelectorAll('.quiet-meteor').forEach(x => x.remove()); schedule();
  }
  window.Sky = {
    STYLES:['realist'], LABELS:{realist:'Quiet sea'}, style:'realist', cycle(){}, meteor,
    get calm() { return calm || reduce.matches; },
    setCalm(v) { calm = !!v; try { localStorage.setItem('calm', calm ? '1' : '0'); } catch (_) {} apply(); dispatchEvent(new CustomEvent('skycalm', {detail:calm})); }
  };
  function sync() { try { calm = localStorage.getItem('calm') === '1'; } catch (_) {} apply(); }
  window.addEventListener('skycalm', event => {
    if (typeof event.detail === 'boolean' && event.detail !== calm) { calm = event.detail; apply(); }
  });
  window.addEventListener('storage', event => { if (event.key === 'calm' || event.key === null) sync(); });
  window.addEventListener('pagehide', () => { active = false; apply(); });
  window.addEventListener('pageshow', () => { active = true; sync(); });
  reduce.addEventListener('change', apply);
  document.addEventListener('visibilitychange', sync);
  apply();
})();
