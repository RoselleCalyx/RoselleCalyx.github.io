/* Private messages, an explicit email route, and a quiet bottle landing. */
(function () {
  const {esc, ICON} = window.Site;
  const $ = id => document.getElementById(id);
  const form = $('bottleForm'), text = $('bText'), count = $('bCount'), status = $('bStatus');
  const bottle = $('heroBottle'), effects = $('seaEffects'), scene = $('nightSea');
  const submit = form.querySelector('[type="submit"]');
  const tabs = [...document.querySelectorAll('.shore-tabs [role="tab"]')];
  let sending = false, casting = false;
  let submission = null, turnstileToken = '', widgetId = null;
  const needsChallenge = MessageDelivery.mode === 'cloudflare' && !!SITE.turnstileSiteKey;
  Backend.guard(form);
  function activate(tab, focus = false) {
    tabs.forEach(x => { const active = x === tab; x.classList.toggle('active', active); x.setAttribute('aria-selected', String(active)); x.tabIndex = active ? 0 : -1; });
    $('writePane').hidden = tab.dataset.tab !== 'write'; $('readPane').hidden = tab.dataset.tab !== 'read';
    if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activate(t));
    t.addEventListener('keydown', e => {
      let index;
      if (e.key === 'ArrowRight') index = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') index = (i + tabs.length - 1) % tabs.length;
      if (e.key === 'Home') index = 0;
      if (e.key === 'End') index = tabs.length - 1;
      if (index !== undefined) { e.preventDefault(); activate(tabs[index], true); }
    });
  });
  const delivery = () => form.elements.delivery.value;
  function routeChanged() {
    const mail = delivery() === 'email';
    const anonymousLabel = form.querySelector('.shore-anon');
    if (anonymousLabel) { anonymousLabel.hidden = mail; anonymousLabel.style.display = mail ? 'none' : ''; }
    $('bName').disabled = !mail && $('bAnon').checked;
    $('contactField').hidden = mail; $('bContact').disabled = mail || $('bAnon').checked;
    $('bChallenge').hidden = mail || !needsChallenge;
    $('sendLabel').textContent = mail ? 'Open mail app' : 'Send the bottle';
    $('deliveryNote').textContent = mail ? 'Open the draft in your mail app, then press Send. Your email address will be visible to Chen.'
      : MessageDelivery.enabled ? 'Messages are private and are not published here.' : 'Bottle delivery is not connected yet. Choose email to send a message.';
    status.textContent = ''; status.dataset.error = 'false';
  }
  form.querySelectorAll('[name="delivery"]').forEach(x => x.addEventListener('change', routeChanged)); routeChanged();
  text.addEventListener('input', () => { count.textContent = `${text.value.length} / 500`; });
  $('bAnon').addEventListener('change', () => {
    $('bName').disabled = $('bAnon').checked;
    if ($('bAnon').checked) { $('bName').value = ''; $('bContact').value = ''; }
    routeChanged();
  });
  function say(message, error = false) { status.textContent = message; status.dataset.error = String(error); }
  if (needsChallenge) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
    script.onload = () => { widgetId = window.turnstile.render('#bChallenge', {
      sitekey:SITE.turnstileSiteKey, theme:'dark', size:'flexible', action:'message',
      callback:token => { turnstileToken = token; },
      'expired-callback':() => { turnstileToken = ''; },
      'error-callback':() => { turnstileToken = ''; say('Verification failed. Try again.', true); }
    }); };
    script.onerror = () => say('Verification could not load. Choose email or try again.', true);
    document.head.appendChild(script);
  }
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (sending) return;
    const rawText = text.value, msg = rawText.trim();
    if (msg.length < 2) { say('Write at least two characters.', true); text.focus(); return; }
    if (!$('bContact').disabled && $('bContact').value && !$('bContact').checkValidity()) { say('Please check your reply email, or leave it empty.', true); $('bContact').focus(); return; }
    const name = delivery() === 'email' || !$('bAnon').checked ? $('bName').value.trim() : '';
    if (delivery() === 'email') {
      if (!SITE.email) { say('The email route is unavailable right now.', true); return; }
      const subject = 'Message from ' + (name || 'a visitor');
      const body = msg + '\n\n' + (name || 'a visitor');
      location.href = 'mailto:' + SITE.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      say('Press Send in your mail app to finish.'); return;
    }
    if (!MessageDelivery.enabled) { say('Bottle delivery is not connected yet. Your text is still on this page. Choose email to send a message.', true); return; }
    if (needsChallenge && !turnstileToken) { say('Please complete the small verification before sending.', true); return; }
    const problem = Backend.check(form, 'bottle');
    if (problem) { say(problem, true); return; }
    sending = true; submit.disabled = true; say('Sending…');
    try {
      const contact = $('bContact').value.trim(), key = JSON.stringify({name,contact,text:msg});
      if (!submission || submission.key !== key) submission = {key, id:crypto.randomUUID()};
      const result = await MessageDelivery.submit({name, contact, text:msg, submissionId:submission.id,
        website:form.querySelector('[name="website"]')?.value || '', turnstileToken});
      if (!result.ok) { say('Delivery could not be confirmed. Your text is still on this page. Try again.', true); return; }
      Backend.stamp('bottle'); submission = null;
      const unchanged = text.value === rawText;
      if (unchanged) { text.value = ''; count.textContent = '0 / 500'; }
      else count.textContent = `${text.value.length} / 500`;
      const delivered = result.transport === 'form' ? 'Message submitted.' : 'Message sent to Chen’s private inbox.';
      say(unchanged ? delivered : delivered.replace(/^Message/, 'Previous message') + ' Your current text has not been sent.'); castBottle();
    } catch (_) { say('Delivery could not be confirmed. Your text is still on this page. Try again.', true); }
    finally {
      sending = false; submit.disabled = false;
      if (needsChallenge && widgetId !== null) { turnstileToken = ''; window.turnstile.reset(widgetId); }
    }
  });
  function ripple(x, y) {
    if (Sky.calm) return;
    for (let i = 0; i < 3; i++) {
      const r = document.createElement('i'); r.className = 'sea-ripple'; r.style.left = x + 'px'; r.style.top = y + 'px';
      r.style.animationDelay = i * .24 + 's'; effects.appendChild(r); setTimeout(() => r.remove(), 3600);
    }
  }
  async function castBottle() {
    if (casting) return;
    casting = true;
    const sr = scene.getBoundingClientRect();
    if (sr.width <= 760 && scrollY > 20) window.scrollTo({top:0,behavior:Sky.calm ? 'instant' : 'smooth'});
    const w = bottle.offsetWidth, h = bottle.offsetHeight;
    const x = bottle.offsetLeft, y = bottle.offsetTop;
    const landingX = sr.width * (sr.width <= 760 ? .64 : .37), landingY = sr.height * .77;
    const ghost = document.createElement('img'); ghost.src = bottle.src; ghost.alt = ''; ghost.className = 'cast-bottle';
    ghost.style.width = w + 'px'; ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; effects.appendChild(ghost); bottle.style.opacity = '0';
    try {
      if (Sky.calm) { ghost.remove(); await new Promise(resolve => setTimeout(resolve, 180)); }
      else {
        const dx = landingX - x - w / 2, dy = landingY - y - h * .78;
        const fly = ghost.animate([
          {transform:'translate(0,0) rotate(-26deg) scale(1)', offset:0},
          {transform:`translate(${dx * .42}px,${dy * .42 - sr.height * .15}px) rotate(19deg) scale(.68)`, offset:.43},
          {transform:`translate(${dx}px,${dy}px) rotate(83deg) scale(.23)`, offset:1}
        ], {duration:1750, easing:'cubic-bezier(.25,.35,.5,1)', fill:'forwards'});
        await fly.finished; ripple(landingX, landingY);
        const drift = ghost.animate([
          {transform:`translate(${dx}px,${dy}px) rotate(83deg) scale(.23)`,opacity:.85},
          {transform:`translate(${dx + sr.width * .045}px,${dy - 4}px) rotate(89deg) scale(.20)`,opacity:.6,offset:.45},
          {transform:`translate(${dx + sr.width * .095}px,${dy - 10}px) rotate(85deg) scale(.15)`,opacity:0}
        ], {duration:6200, easing:'ease-in-out',fill:'forwards'}); await drift.finished;
      }
    } catch (_) { /* resize/navigation can interrupt an animation */ }
    finally { ghost.remove(); bottle.style.opacity = '1'; casting = false; }
  }
  const shared = window.BOTTLES || [];
  $('bottleList').innerHTML = shared.map((b,i) => `<li><button type="button" data-i="${i}">${ICON.bottle}<span>${esc(b.from || 'A stranger')}<small>${esc(b.date || '')}</small><span class="ex">${esc(b.text)}</span></span></button></li>`).join('') || '<li>No bottles on the shore tonight.</li>';
  function openBottle(b) {
    if (!b) return;
    Site.modal(`<div class="unrolled"><p class="kicker">Shared note · ${esc(b.date || '')}</p><div>${esc(b.text)}</div><div class="sig">${esc(b.from || 'A stranger')}</div>${b.reply ? `<div class="reply">${esc(b.reply)}</div>` : ''}</div>`,{className:'shore-modal'});
  }
  $('bottleList').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) openBottle(shared[Number(b.dataset.i)]); });
  $('pickBottle').addEventListener('click', () => openBottle(shared[Math.floor(Math.random() * shared.length)]));
})();
