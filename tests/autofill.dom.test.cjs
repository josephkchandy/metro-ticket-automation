// DOM event/timing regressions. Layout rectangles are mocked; these are not device tests.
const {JSDOM} = require('jsdom');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const assert = require('node:assert/strict');
const script = readFileSync(join(__dirname, '../app/src/main/assets/autofill.js'), 'utf8');

function setup(config) {
  window.clock = 0;
  Date.now = () => window.clock;
  const jobs = [];
  const schedule = (delay, run) => jobs.push({at: window.clock + delay, run});
  window.advance = () => {
    window.clock += 500;
    let due;
    while ((due = jobs.find(job => job.at <= window.clock))) {
      jobs.splice(jobs.indexOf(due), 1); due.run();
    }
  };
  window.counts = {fare: 0, book: 0, opens: 0, selections: 0};
  let rerendered = false;
  function station(kind, id, hidden = false) {
    const field = document.createElement('mat-select');
    field.id = id;
    if (!config.unlabelled) field.setAttribute('formcontrolname', 'selectedStation' + (kind === 'entry' ? 'From' : 'To'));
    field.setAttribute('aria-expanded', 'false');
    field.style.display = hidden ? 'none' : 'block';
    field.innerHTML = '<div class="mat-select-trigger"><span class="mat-select-value-text"></span><span>arrow_drop_down</span></div>';
    if (config.disabledUntil) {
      field.setAttribute('aria-disabled', 'true');
      schedule(config.disabledUntil, () => field.setAttribute('aria-disabled', 'false'));
    }
    // This intentionally models Angular Material's inner-trigger click binding.
    field.querySelector('.mat-select-trigger').addEventListener('click', () => {
      if (field.getAttribute('aria-disabled') === 'true') return;
      window.counts.opens++;
      if (field.getAttribute('aria-expanded') === 'true') {
        field.setAttribute('aria-expanded', 'false');
        document.getElementById(id + '-panel')?.remove(); return;
      }
      document.querySelectorAll('[role="listbox"]').forEach(panel => panel.remove());
      field.setAttribute('aria-expanded', 'true');
      field.setAttribute('aria-controls', id + '-panel');
      const panel = document.createElement('div');
      panel.id = id + '-panel'; panel.setAttribute('role', 'listbox');
      document.body.append(panel);
      schedule(config.optionsDelay || 0, () => {
        if (!panel.isConnected) return;
        for (const name of ['Aluva', 'Kadavanthra', 'S N Junction']) {
          const option = document.createElement('mat-option');
          option.setAttribute('role', 'option'); option.style.display = 'block';
          option.innerHTML = '<span class="mat-option-text">' + name + '</span>';
          panel.append(option);
          option.addEventListener('click', () => {
            if (option.getAttribute('aria-disabled') === 'true') return;
            window.counts.selections++;
            field.setAttribute('aria-expanded', 'false'); panel.remove();
            schedule(config.commitDelay || 0, () => {
              if (!field.isConnected) return;
              field.querySelector('.mat-select-value-text').textContent = name;
              if (kind === 'entry' && config.rerenderExit && !rerendered) {
                rerendered = true;
                schedule(3200, () => {
                  const old = document.querySelector('[formcontrolname="selectedStationTo"]');
                  if (old) old.replaceWith(station('exit', 'mat-select-94'));
                });
              }
            });
          });
        }
      });
    });
    return field;
  }
  function showForm() {
    const container = document.createElement('section');
    const entry = station('entry', config.legacyIds ? 'mat-select-0' : 'mat-select-40');
    const exit = station('exit', config.legacyIds ? 'mat-select-2' : 'mat-select-58');
    container.append(...(config.reverse ? [exit, entry] : [entry, exit]));
    if (config.hiddenDuplicate) container.prepend(station('entry', 'mat-select-0', true));
    if (config.ambiguous) container.append(station('unknown', 'mat-select-76'));
    container.insertAdjacentHTML('beforeend', '<select id="travelType"><option value="one">One Way</option><option value="round" selected>Round Trip</option></select><select id="passengerCount"><option>1</option><option selected>2</option></select><button id="fare">Get Fare</button>');
    document.body.append(container);
    container.querySelector('#fare').addEventListener('click', () => {
      window.counts.fare++;
      window.submittedRoute = Array.from(container.querySelectorAll('mat-select'))
        .filter(field => field.style.display !== 'none')
        .map(field => field.querySelector('.mat-select-value-text').textContent);
      schedule(2500, () => {
        const book = document.createElement('button'); book.textContent = 'Book Ticket';
        book.addEventListener('click', () => window.counts.book++); container.append(book);
      });
    });
  }
  document.body.innerHTML = '<style>mat-select,mat-option{display:block;padding:4px} .mat-select-trigger{padding:4px}</style>';
  if (config.formDelay) schedule(config.formDelay, showForm); else showForm();
}

(async () => {
  let dom;
  try {
    // No resources or scripts are loaded from the network. Only the local helper runs.
    const page = {
      async goto(url) {
        if (dom) dom.window.close();
        dom = new JSDOM('<!doctype html><html><body></body></html>', {url, runScripts: 'outside-only'});
        Object.defineProperty(dom.window.document, 'readyState', {value: 'complete'});
        Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', {get() {return this.textContent;}});
        dom.window.HTMLElement.prototype.scrollIntoView = function () {};
        dom.window.HTMLElement.prototype.getClientRects = function () {
          for (let el = this; el; el = el.parentElement) {
            if (dom.window.getComputedStyle(el).display === 'none') return [];
          }
          return [{}];
        };
      },
      async evaluate(code, argument) {
        const source = typeof code === 'string' ? code : '(' + code.toString() + ')(' + JSON.stringify(argument) + ')';
        const result = dom.window.eval(source);
        return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
      }
    };
    async function fixture(config = {}, host = 'prutech.org') {
      await page.goto(`https://${host}/KMRL/#/manage/ticket/Ab12Cd34`);
      await page.evaluate(setup, config);
      await page.evaluate(() => { delete window.__metroSN; });
    }
    async function tick() { await page.evaluate(() => window.advance()); return page.evaluate(script); }
    async function finish() {
      let result;
      for (let i = 0; i < 180; i++) {
        result = await tick();
        if (result.state !== 'wait') break;
      }
      assert.equal(result.state, 'ready', result.message);
      const resultCounts = await page.evaluate(() => window.counts);
      assert.equal(resultCounts.fare, 1); assert.equal(resultCounts.book, 0);
      const route = await page.evaluate(() => window.submittedRoute.slice().sort());
      assert.deepEqual(route, ['Kadavanthra', 'S N Junction']);
      assert.deepEqual(await page.evaluate(() => [document.getElementById('travelType').value, document.getElementById('passengerCount').value]), ['one', '1']);
      for (let i = 0; i < 8; i++) assert.equal((await tick()).state, 'ready');
      assert.equal((await page.evaluate(() => window.counts)).fare, 1);
    }
    await fixture({legacyIds: true});
    await page.evaluate(() => document.getElementById('mat-select-0').click());
    assert.equal(await page.evaluate(() => window.counts.opens), 0, 'host clicks must not open the fixture');
    await finish();
    await fixture({reverse: true, hiddenDuplicate: true, formDelay: 2500, disabledUntil: 1000, optionsDelay: 1800, commitDelay: 900, rerenderExit: true});
    await finish();
    await fixture({unlabelled: true, optionsDelay: 750}); await finish();
    await fixture({unlabelled: true, ambiguous: true});
    for (let i = 0; i < 20; i++) assert.equal((await tick()).state, 'wait');
    assert.equal((await page.evaluate(() => window.counts)).fare, 0);
    await page.evaluate(() => {window.clock = 91001;});
    assert.equal((await tick()).state, 'halt');
    await fixture({}, 'evil.org'); assert.equal((await tick()).state, 'halt');
    await fixture(); await page.evaluate(() => {document.body.append('Link Expired');});
    assert.equal((await tick()).state, 'halt');
    await fixture(); await finish();
    await page.evaluate(() => {document.querySelector('[formcontrolname="selectedStationFrom"] .mat-select-value-text').textContent = 'Aluva';});
    assert.equal((await tick()).state, 'halt');
    console.log('DOM regressions passed: trigger-only event binding, generated IDs, reversed fields, delayed/disabled controls, delayed options, committed values, exit re-render, hidden duplicates, ambiguous fields, timeout, host/expiry/route checks, single fare request and no purchase clicks. Layout is mocked; device behavior still needs confirmation.');
  } finally { if (dom) dom.window.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
