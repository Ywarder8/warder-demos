#!/usr/bin/env node
/*
 * Coinhold end-to-end tests (Playwright + axe-core). Serves the app with its production headers and checks:
 *   - every view renders with no console errors, desktop and phone, light and dark
 *   - the game loop: attacks, deposits, check-in, quests, subscriptions, ledger, CSV import, budgets
 *   - security: CSP blocks injected script, XSS payloads stay text, backups can't pollute prototypes,
 *     PIN lock encrypts data at rest and slows down guessing
 *   - accessibility (axe, WCAG 2.1 AA) and speed budgets for taps and view switches
 *
 *   node apps/coinhold/tests/coinhold.test.js
 */
const { chromium } = require('playwright');
const path = require('path');
const serve = require('./serve');
const AXE = require.resolve('axe-core/axe.min.js');

let failed = 0, passed = 0;
const check = (ok, name, detail = '') => { if (ok) { passed++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } };

(async () => {
  const srv = await serve();
  const browser = await chromium.launch();
  const errors = [];
  const newPage = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, ...opts });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    // Blocked font requests and the CSP violations this suite provokes on purpose are expected.
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED|Content Security Policy/.test(m.text())) errors.push(m.text()); });
    p.on('dialog', d => { errors.push('dialog opened: ' + d.message()); d.dismiss(); });
    // Fonts are cosmetic; keep tests offline and deterministic.
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    return p;
  };
  const go = async (p, hash = '') => { await p.goto(srv.url + (hash ? '#' + hash : '')); await p.waitForSelector('#rank .xpbar, #unlockform'); };

  console.log('Views');
  const p = await newPage();
  for (const v of ['kingdom', 'realm', 'money-map', 'quests', 'advisor', 'ledger']) {
    await go(p, v);
    check(await p.locator(`nav.tabs a[href="#${v}"][aria-current="page"]`).count() === 1, `${v}: tab marked current`);
    check((await p.locator('#view').innerText()).length > 200, `${v}: content rendered`);
  }
  await go(p, 'money-map');
  check(await p.locator('.donut path').count() >= 6, 'money map: donut has a slice per category');
  check(await p.locator('#bars svg path').count() >= 12, 'money map: income/spending bars drawn');
  check(await p.locator('svg[data-cross="nw"] polyline').count() === 1, 'money map: net worth line drawn');

  await go(p, 'realm');
  check(await p.locator('#sankey svg .rib').count() >= 8, 'realm: trade routes link income streams to where money goes');
  check(await p.locator('.holding:not(.empty-h)').count() >= 3, 'realm: job, business and side-gig buildings are built');
  check((await p.locator('.holding', { hasText: 'Market' }).innerText()).includes('Profit a month'), 'realm: business shows profit after costs');
  check(await p.locator('.panel', { hasText: 'Upkeep' }).locator('tbody tr').count() >= 8, 'realm: regular bills detected');
  check((await p.locator('.credit').first().innerText()).includes('% used'), 'realm: credit card utilization shown');
  console.log('Game loop');
  await go(p, 'kingdom');
  const debtBefore = await p.locator('.stat .v').nth(3).innerText();
  const xpBefore = await p.locator('#rank .rankline span').nth(1).innerText();
  await p.click('[data-attack] >> nth=0'); await p.fill('[data-attackform] input >> nth=0', '300'); await p.click('[data-attackform] button >> nth=0');
  await p.waitForTimeout(900);
  check(await p.locator('.stat .v').nth(3).innerText() !== debtBefore, 'extra attack lowers total debt', debtBefore);
  check(await p.locator('#rank .rankline span').nth(1).innerText() !== xpBefore, 'extra attack earns XP');
  await p.click('[data-dep] >> nth=0'); await p.fill('[data-depform] input >> nth=0', '100'); await p.click('[data-depform] button >> nth=0');
  await p.waitForTimeout(300);
  check((await p.locator('.dragon').filter({ hasText: 'Emergency fund' }).innerText()).includes('$2,700'), 'deposit raises the emergency fund');
  await p.click('#checkin'); await p.waitForSelector('.modal');
  check((await p.locator('.modal').innerText()).includes('Week 4'), 'weekly check-in extends the streak');
  await p.click('.modal [data-close]');
  check(await p.locator('#checkin').isDisabled(), 'check-in can only happen once a week');
  await go(p, 'quests');
  const claimBtns = await p.locator('[data-claim]').count();
  if (claimBtns) { await p.click('[data-claim] >> nth=0'); await p.waitForTimeout(200); }
  check(await p.locator('.trophy:not(.locked)').count() >= 2, 'claiming a quest adds a trophy');
  await p.click('[data-sub][data-v="cancelled"] >> nth=0'); await p.waitForTimeout(200);
  check((await p.locator('table').first().innerText()).includes('Cancelled'), 'subscription can be marked cancelled');
  await go(p, 'ledger');
  await p.fill('#tx-desc', 'Pizzeria Uno 42'); await p.fill('#tx-amt', '23.50'); await p.click('#txform button');
  await p.waitForTimeout(200);
  check((await p.locator('#view table').first().innerText()).includes('Pizzeria Uno 42'), 'logged transaction appears in the ledger');
  check(await p.locator('#view tr', { hasText: 'Pizzeria Uno 42' }).locator('select').inputValue() === 'dining', 'category guessed from the description');
  await p.fill('#csvtext', 'Date,Description,Amount\n11/05/2026,"Starbucks, Main St",-6.25\n2026-11-06,Paycheck,2100\nbad,row,\n');
  await p.click('#csvgo'); await p.waitForTimeout(200);
  check((await p.locator('#toasts').innerText()).includes('Imported 2 transactions, skipped 1'), 'CSV import handles quotes, two date formats and bad rows');
  await p.fill('#bud-fun', '999'); await p.click('#budform button'); await p.waitForTimeout(200);
  await go(p, 'money-map');
  check((await p.locator('.upk').filter({ hasText: 'Fun' }).innerText()).includes('of $999'), 'budget change shows on the money map');
  await go(p, 'advisor');
  check(await p.locator('.move').count() >= 3, 'advisor lists moves');
  const sim1 = await p.locator('#simOut .compare > div').nth(1).innerText();
  await p.locator('#extra').fill('800'); await p.locator('#extra').dispatchEvent('input');
  check(await p.locator('#simOut .compare > div').nth(1).innerText() !== sim1, 'debt simulator reacts to the extra-payment slider');

  console.log('Security');
  const xss = '<img src=x onerror="window.__pwned=1">';
  await go(p, 'ledger');
  await p.fill('#tx-desc', xss); await p.fill('#tx-amt', '5'); await p.click('#txform button'); await p.waitForTimeout(200);
  await p.click('#restore');
  await p.fill('#restoretext', '{"__proto__":{"polluted":1},"txns":[{"id":"zz","date":"2026-11-02","desc":"<script>window.__pwned=2</script>","amount":-5,"cat":"fun"},{"date":"x","cat":"constructor"}],"debts":[{"name":"\\"><svg onload=window.__pwned=3>","balance":1e99,"apr":-5,"min":5}],"xp":"lots","budgets":{"home":"abc"}}');
  await p.click('#restorego'); await p.waitForTimeout(200);
  for (const v of ['kingdom', 'realm', 'money-map', 'quests', 'advisor', 'ledger']) { await go(p, v); await p.mouse.move(700, 450); }
  await go(p, 'kingdom'); await p.hover('.dragon-g').catch(() => {});
  check(await p.evaluate(() => !window.__pwned), 'no injected script ran (XSS payloads stay text)');
  check(await p.evaluate(() => ({}).polluted === undefined), 'restoring a backup cannot pollute Object.prototype');
  const restored = await p.evaluate(() => JSON.parse(localStorage.getItem('coinhold.v1')));
  check(restored.txns.length === 1 && restored.debts[0].balance <= 1e7 && restored.debts[0].apr === 0 && restored.xp === 0, 'restored data is validated and clamped');
  check(!/[<>]/.test(restored.debts[0].name + restored.txns[0].desc), 'angle brackets stripped from stored text');
  const cspBlocked = await p.evaluate(() => new Promise(r => { const s = document.createElement('script'); s.textContent = 'window.__inline=1'; document.head.appendChild(s); setTimeout(() => r(!window.__inline), 50); }));
  check(cspBlocked, 'Content-Security-Policy blocks inline script');
  const ext = await p.evaluate(() => fetch('https://example.com').then(() => 'reached', () => 'blocked'));
  check(ext === 'blocked', 'Content-Security-Policy blocks network calls (data cannot leave)');
  const hdr = (await p.request.get(srv.url)).headers();
  check(/frame-ancestors 'none'/.test(hdr['content-security-policy'] || '') && hdr['x-frame-options'] === 'DENY', 'served with anti-clickjacking headers');

  // PIN lock
  await go(p, 'ledger');
  await p.fill('#pin-new', '482913'); await p.fill('#pin-new2', '111111'); await p.click('#pinform button');
  check((await p.locator('#pinmsg').innerText()).includes('don’t match'), 'mismatched PINs rejected');
  await p.fill('#pin-new', '1234'); await p.fill('#pin-new2', '1234'); await p.click('#pinform button');
  check(!(await p.evaluate(() => localStorage.getItem('coinhold.v1'))).startsWith('{"enc"'), 'PIN shorter than 6 digits rejected');
  await p.fill('#pin-new', '482913'); await p.fill('#pin-new2', '482913'); await p.click('#pinform button');
  await p.waitForFunction(() => (localStorage.getItem('coinhold.v1') || '').startsWith('{"enc":1'), null, { timeout: 10000 });
  const blob = await p.evaluate(() => localStorage.getItem('coinhold.v1'));
  check(!/Pizza|Credit card|FreshMart/.test(blob), 'data is encrypted at rest (no readable text in storage)');
  await p.reload(); await p.waitForSelector('#unlockform');
  check(await p.locator('#view').innerText().then(t => !t.includes('$')), 'locked screen shows no financial numbers');
  for (let i = 0; i < 3; i++) { await p.fill('#pin-in', '00000' + i); await p.click('#unlockform button'); await p.waitForFunction(() => !document.querySelector('#unlockform button').disabled, null, { timeout: 15000 }); }
  check((await p.locator('#unlockmsg').innerText()).includes('Locked'), 'three wrong PINs trigger a lockout');
  await p.fill('#pin-in', '482913'); await p.click('#unlockform button'); await p.waitForTimeout(800);
  check(await p.locator('#unlockform').count() === 1, 'correct PIN is refused during the lockout');
  await p.evaluate(() => localStorage.removeItem('coinhold.v1.fails'));
  await p.fill('#pin-in', '482913'); await p.click('#unlockform button'); await p.waitForSelector('#rank .xpbar', { timeout: 15000 });
  check(true, 'correct PIN unlocks after the lockout ends');
  check(await p.evaluate(() => typeof window.S === 'undefined' && typeof window.cryptoKey === 'undefined'), 'app state and key are not exposed on window');

  console.log('Accessibility, layout and speed');
  const fresh = await newPage();
  for (const v of ['kingdom', 'realm', 'money-map', 'quests', 'advisor', 'ledger']) {
    await go(fresh, v);
    await fresh.addScriptTag({ path: AXE }).catch(async () => { await fresh.evaluate(require('fs').readFileSync(AXE, 'utf8')); });
    const r = await fresh.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }));
    const v2 = r.violations.filter(x => x.impact === 'critical' || x.impact === 'serious');
    check(!v2.length, `${v}: no serious accessibility violations`, v2.map(x => x.id + '(' + x.nodes.length + ')').join(', '));
  }
  // Tap-to-update latency on the real UI (rendering included).
  await go(fresh, 'kingdom');
  const tapMs = await fresh.evaluate(async () => {
    const t = performance.now(); document.querySelector('[data-min]').click();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t;
  });
  check(tapMs < 100, `tap responds in under 100ms (${tapMs.toFixed(0)}ms)`);
  const switchMs = await fresh.evaluate(async () => {
    const t = performance.now(); location.hash = '#money-map';
    await new Promise(r => setTimeout(r, 0)); await new Promise(r => requestAnimationFrame(r));
    return performance.now() - t;
  });
  check(switchMs < 150, `switching to the money map takes under 150ms (${switchMs.toFixed(0)}ms)`);
  const big = await fresh.evaluate(async () => {
    const rows = ['Date,Description,Amount']; for (let i = 0; i < 3000; i++) rows.push(`2026-${String(1 + i % 11).padStart(2, '0')}-${String(1 + i % 28).padStart(2, '0')},Shop ${i},-${(i % 90) + 1}.5`);
    location.hash = '#ledger'; await new Promise(r => setTimeout(r, 50));
    document.querySelector('#csvtext').value = rows.join('\n');
    const t = performance.now(); document.querySelector('#csvgo').click(); return performance.now() - t;
  });
  check(big < 1500, `importing 3,000 transactions takes under 1.5s (${big.toFixed(0)}ms)`);

  const phone = await newPage({ viewport: { width: 375, height: 740 }, colorScheme: 'dark' });
  for (const v of ['kingdom', 'realm', 'money-map', 'quests', 'advisor', 'ledger']) {
    await go(phone, v);
    check(!(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${v}: no sideways scrolling on a phone (dark mode)`);
  }
  const small = await phone.evaluate(() => [...document.querySelectorAll('nav a, button.btn')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 40).length);
  check(small === 0, 'every main button is at least 40px tall for easy tapping', small + ' too small');

  check(!errors.length, 'no console errors or dialogs', errors.slice(0, 5).join(' | '));
  await browser.close(); srv.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
