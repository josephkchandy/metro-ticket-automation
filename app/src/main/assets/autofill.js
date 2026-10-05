(function () {
  const wait = message => ({state: 'wait', message});
  const halt = message => ({state: 'halt', message});
  if (location.protocol !== 'https:' || location.hostname !== 'prutech.org' || location.pathname !== '/KMRL/') {
    return halt('Automation stopped outside the booking page.');
  }
  if (!document.body || document.readyState === 'loading') return wait('Waiting for the booking page…');
  if (/Link Expired|Permission Denied/i.test(document.body.innerText || '')) {
    return halt('This link has expired or is unavailable. Request a fresh link.');
  }
  const now = Date.now();
  const s = window.__metroSN || (window.__metroSN = {phase: 0, started: now, nextAction: 0});
  if (now - s.started > 90000) return halt('Station form timed out. You can finish manually below.');
  const clean = text => (text || '').replace(/\s+/g, ' ').trim();
  const visible = el => !!el && el.isConnected && el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden' && el.getAttribute('aria-hidden') !== 'true';
  const enabled = el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';

  function fieldName(el) {
    const labels = (el.getAttribute('aria-labelledby') || '').split(/\s+/)
      .map(id => document.getElementById(id)).filter(Boolean).map(label => label.textContent);
    const wrapper = el.closest('mat-form-field');
    const label = wrapper && wrapper.querySelector('mat-label');
    return [el.getAttribute('formcontrolname'), el.getAttribute('name'), el.getAttribute('aria-label'),
      el.getAttribute('placeholder'), label && label.textContent, ...labels]
      .filter(Boolean).join(' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }
  function fields() {
    const selects = Array.from(document.querySelectorAll('mat-select')).filter(visible);
    let entry = selects.filter(el => /\b(from|entry|origin|source)\b/.test(fieldName(el)));
    let exit = selects.filter(el => /\b(to|exit|destination)\b/.test(fieldName(el)));
    if (entry.length === 1 && exit.length === 1 && entry[0] !== exit[0]) return [entry[0], exit[0]];
    // The observed form has exactly two station mat-selects and native journey selects.
    // Do not guess by position when an extra unrecognized material select is present.
    if (selects.length === 2 && entry.length <= 1 && exit.length <= 1) {
      const from = entry[0] || (exit[0] === selects[0] ? selects[1] : selects[0]);
      const to = exit[0] || selects.find(el => el !== from);
      if (from !== to) return [from, to];
    }
    return [];
  }
  function value(el) {
    const text = el.querySelector('.mat-select-value-text, .mat-mdc-select-value-text');
    return clean(text ? text.textContent : el.textContent);
  }
  function panelFor(el) {
    const ids = clean(el.getAttribute('aria-controls') || el.getAttribute('aria-owns')).split(/\s+/);
    for (const id of ids) {
      const panel = document.getElementById(id);
      if (visible(panel)) return panel;
    }
    // Older material versions may omit the association while the overlay is opening.
    // Never select an option from some other field's known panel.
    if (ids.some(Boolean)) return null;
    const panels = Array.from(document.querySelectorAll('.mat-select-panel, .mat-mdc-select-panel, [role="listbox"]')).filter(visible);
    return panels.length === 1 ? panels[0] : null;
  }
  function choose(el, name) {
    if (!enabled(el) || now < s.nextAction) return;
    if (el.getAttribute('aria-expanded') !== 'true') {
      // Angular Material binds opening to the inner trigger, not the mat-select host.
      const trigger = el.querySelector('.mat-select-trigger, .mat-mdc-select-trigger') || el;
      el.scrollIntoView({block: 'center'});
      s.nextAction = now + 1000;
      trigger.click();
      return;
    }
    const panel = panelFor(el);
    if (!panel) return;
    const option = Array.from(panel.querySelectorAll('mat-option, [role="option"]')).find(el => {
      const text = el.querySelector('.mat-option-text, .mdc-list-item__primary-text');
      return enabled(el) && clean(text ? text.textContent : el.textContent) === name;
    });
    if (option) {
      option.scrollIntoView({block: 'nearest'});
      s.nextAction = now + 1500; // Let Angular commit the selection and refresh the other list.
      option.click();
    }
  }
  const [entry, exit] = fields();
  if (!entry || !exit) {
    s.stableSince = null;
    return wait('Waiting for the station fields…');
  }
  const correct = value(entry) === 'Kadavanthra' && value(exit) === 'S N Junction';
  if (s.phase >= 3) {
    if (!correct) return halt('Route changed after fare lookup. Please review before booking.');
    const book = Array.from(document.querySelectorAll('button')).find(el =>
      visible(el) && clean(el.textContent) === 'Book Ticket');
    if (book) {
      s.phase = 4;
      return {state: 'ready', message: 'Route filled. Review the fare, then tap Book Ticket and approve payment yourself.'};
    }
    return wait('Waiting for fare…');
  }
  // Re-read both controls each tick: asynchronously replacing the exit list can clear it.
  if (value(entry) !== 'Kadavanthra') {
    s.phase = 0; s.stableSince = null;
    choose(entry, 'Kadavanthra');
    return wait('Selecting Kadavanthra…');
  }
  if (value(exit) !== 'S N Junction') {
    s.phase = 1; s.stableSince = null;
    choose(exit, 'S N Junction');
    return wait('Selecting S N Junction…');
  }
  s.phase = 2;
  if (!enabled(entry) || !enabled(exit) || now < s.nextAction) return wait('Confirming the selected stations…');
  const type = document.getElementById('travelType'), count = document.getElementById('passengerCount');
  if (!enabled(type) || !enabled(count)) return wait('Waiting for journey options…');
  for (const [control, desired] of [[type, 'One Way'], [count, '1']]) {
    const option = Array.from(control.options || []).find(el => clean(el.textContent) === desired);
    if (!option) return wait('Waiting for journey options…');
    if (control.value !== option.value) {
      control.value = option.value;
      control.dispatchEvent(new Event('change', {bubbles: true}));
      s.stableSince = null;
      s.nextAction = now + 1000;
      return wait('Setting one passenger, one way…');
    }
  }
  if (s.stableEntry !== entry || s.stableExit !== exit || s.stableSince == null) {
    s.stableEntry = entry; s.stableExit = exit; s.stableSince = now;
    return wait('Confirming the selected stations…');
  }
  if (now - s.stableSince < 1000) return wait('Confirming the selected stations…');
  const fare = Array.from(document.querySelectorAll('button')).find(el =>
    enabled(el) && clean(el.textContent) === 'Get Fare');
  if (!fare) return wait('Waiting for fare lookup…');
  s.phase = 3; // Set before clicking: a slow response must never produce duplicate requests.
  fare.click();
  return wait('Getting current fare…');
})();
