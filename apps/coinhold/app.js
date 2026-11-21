// Coinhold: a personal finance game. No dependencies, no network calls; data stays in this browser.
(() => {
'use strict';
/* ---------- constants ---------- */
const CATS = {
  home: { name: 'Home & bills', slot: 1 }, dining: { name: 'Dining out', slot: 2 }, groceries: { name: 'Groceries', slot: 3 },
  transport: { name: 'Transport', slot: 4 }, shopping: { name: 'Shopping', slot: 5 }, health: { name: 'Health & other', slot: 6 },
  subs: { name: 'Subscriptions', slot: 7 }, fun: { name: 'Fun', slot: 8 },
  debt: { name: 'Debt payments' }, save: { name: 'Savings & investing' }, income: { name: 'Income' }
};
const SPEND = ['home', 'dining', 'groceries', 'transport', 'shopping', 'health', 'subs', 'fun'];
const ESSENTIAL = ['home', 'groceries', 'transport', 'health'];
const DISCRETIONARY = ['dining', 'shopping', 'fun'];
const TITLES = ['Peasant', 'Farmhand', 'Merchant', 'Squire', 'Knight', 'Baron', 'Earl', 'Duke', 'Prince', 'Monarch'];
const KEY = 'coinhold.v1';
const ICON = {
  flame: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-4-1-6 1-9.5Z" fill="#eb6834"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5Z" fill="var(--royal)"/></svg>',
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="var(--gold-fill)"/><circle cx="12" cy="12" r="6" fill="none" stroke="#b8830c" stroke-width="1.5"/></svg>',
  ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--good-fill)"/><path d="M4.5 8.2 7 10.5l4.5-5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  warn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 15 14H1Z" fill="var(--warn)"/><path d="M8 6v3.5M8 11.5v.5" stroke="#1b1505" stroke-width="1.8" stroke-linecap="round"/></svg>',
  over: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--crit-fill)"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  sword: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14.5 3H21v6.5L10 20.5 3.5 14Z"/><path d="M6 17l-3 3M8 13l3 3"/></svg>',
  scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>',
  wall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 21V8h3V5h3v3h6V5h3v3h3v13Z"/><path d="M3 14h18M9 14v7M15 14v7"/></svg>',
  seed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 21V11"/><path d="M12 11C12 6 8 4 4 4c0 4 2 7 8 7ZM12 13c0-4 3-6 8-6 0 4-3 6-8 6Z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 20h18M6 16v-5M11 16V7M16 16v-8M21 4l-5 4-5-3-5 4"/></svg>',
  plate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>'
};

/* ---------- utils ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const uid = () => Math.random().toString(36).slice(2, 10);
const round2 = n => Math.round(n * 100) / 100;
const money = (n, dec = 0) => {
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? '−$' : '$') + s;
};
const pct = n => (isFinite(n) ? Math.round(n * 100) : 0) + '%';
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthOf = ds => ds.slice(0, 7);
const daysIn = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
const monthName = (m, long) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: long ? 'long' : 'short', year: long ? 'numeric' : undefined }); };
const addMonths = (m, k) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
function isoWeek(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((date - yStart) / 864e5 + 1) / 7);
  return date.getUTCFullYear() * 100 + wk;
}
function weekIndex(ds) { const [y, m, d] = ds.split('-').map(Number); return Math.floor((Date.UTC(y, m - 1, d) / 864e5 + 3) / 7); }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- input hardening ---------- */
const MAX_TXNS = 20000, MAX_TEXT = 80, MAX_AMT = 1e7;
const clampNum = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0; };
const cleanText = (s, fallback = '') => { s = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, MAX_TEXT); return s || fallback; };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, ID_RE = /^[a-z0-9]{1,16}$/;
// Rebuilds state from untrusted input (a restored backup or stored data) field by field, so nothing unexpected
// (extra keys, __proto__, scripts in strings, absurd numbers) can get in.
function sanitizeState(o) {
  if (!o || typeof o !== 'object') throw new Error('not an object');
  const out = emptyState();
  out.sample = o.sample === true;
  const id = v => (typeof v === 'string' && ID_RE.test(v)) ? v : uid();
  if (Array.isArray(o.txns)) out.txns = o.txns.slice(0, MAX_TXNS).filter(t => t && typeof t.date === 'string' && DATE_RE.test(t.date) && CATS[t.cat] && Object.hasOwn(CATS, t.cat))
    .map(t => ({ id: id(t.id), date: t.date, desc: cleanText(t.desc, 'Transaction'), amount: round2(clampNum(t.amount, -MAX_AMT, MAX_AMT)), cat: t.cat, ...(t.extra === true ? { extra: true } : {}) }));
  if (Array.isArray(o.accounts)) out.accounts = o.accounts.slice(0, 50).filter(a => a && typeof a === 'object')
    .map(a => ({ id: id(a.id), name: cleanText(a.name, 'Account'), kind: a.kind === 'invest' ? 'invest' : 'emergency', balance: round2(clampNum(a.balance, -MAX_AMT, MAX_AMT)) }));
  if (Array.isArray(o.debts)) out.debts = o.debts.slice(0, 50).filter(d => d && typeof d === 'object')
    .map(d => { const b = round2(clampNum(d.balance, 0, MAX_AMT)); return { id: id(d.id), name: cleanText(d.name, 'Debt'), balance: b, start: Math.max(b, round2(clampNum(d.start, 0, MAX_AMT))), apr: clampNum(d.apr, 0, 100), min: clampNum(d.min, 0, MAX_AMT) }; });
  if (Array.isArray(o.history)) out.history = o.history.slice(-240).filter(h => h && /^\d{4}-\d{2}$/.test(h.month)).map(h => ({ month: h.month, nw: Math.round(clampNum(h.nw, -1e9, 1e9)) }));
  if (o.budgets && typeof o.budgets === 'object') SPEND.forEach(c => out.budgets[c] = clampNum(o.budgets[c], 0, MAX_AMT));
  out.xp = Math.round(clampNum(o.xp, 0, 1e7));
  if (o.claimed && typeof o.claimed === 'object') for (const k of Object.keys(o.claimed).slice(0, 500)) if (/^[a-z0-9_-]{1,40}$/i.test(k) && DATE_RE.test(o.claimed[k])) out.claimed[k] = o.claimed[k];
  if (o.subs && typeof o.subs === 'object') for (const k of Object.keys(o.subs).slice(0, 200)) { const v = o.subs[k]; if ((v === 'keep' || v === 'cancelled') && k !== '__proto__') out.subs[cleanText(k)] = v; }
  const st = o.streak || {};
  out.streak = { count: Math.round(clampNum(st.count, 0, 1e4)), last: Number.isInteger(st.last) ? st.last : null, shields: Math.round(clampNum(st.shields, 0, 2)), total: Math.round(clampNum(st.total, 0, 1e5)) };
  out.extraPaid = clampNum(o.extraPaid, 0, 1e9); out.manualCount = Math.round(clampNum(o.manualCount, 0, 1e7)); out.invested = o.invested === true;
  return out;
}

/* ---------- storage: plain, or AES-GCM encrypted behind a PIN ---------- */
let storageOK = true, cryptoKey = null, lockedBlob = null;
const hasCrypto = !!(window.crypto && crypto.subtle && window.isSecureContext !== false);
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
function load() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && o.enc === 1) { lockedBlob = o; return null; }
    return sanitizeState(o);
  } catch { storageOK = false; return null; }
}
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 120); }
async function flushSave() {
  if (!S) return;
  try {
    if (cryptoKey) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(JSON.stringify(S)));
      localStorage.setItem(KEY, JSON.stringify({ enc: 1, salt: lockedSalt, iv: b64(iv), ct: b64(ct) }));
    } else localStorage.setItem(KEY, JSON.stringify(S));
  } catch { storageOK = false; }
}
let lockedSalt = null;
async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  cryptoKey = await deriveKey(pin, salt); lockedSalt = b64(salt);
  await flushSave();
}
async function removePin() { cryptoKey = null; lockedSalt = null; await flushSave(); }
function failState() { try { return JSON.parse(localStorage.getItem(KEY + '.fails')) || { n: 0, until: 0 }; } catch { return { n: 0, until: 0 }; } }
async function tryUnlock(pin) {
  const f = failState();
  if (Date.now() < f.until) return `Too many tries. Wait ${Math.ceil((f.until - Date.now()) / 1000)} seconds.`;
  try {
    const key = await deriveKey(pin, unb64(lockedBlob.salt));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(lockedBlob.iv) }, key, unb64(lockedBlob.ct));
    S = sanitizeState(JSON.parse(new TextDecoder().decode(pt)));
    cryptoKey = key; lockedSalt = lockedBlob.salt; lockedBlob = null;
    try { localStorage.removeItem(KEY + '.fails'); } catch {}
    return null;
  } catch {
    f.n++; if (f.n >= 3) f.until = Date.now() + Math.min(300000, 15000 * 2 ** (f.n - 3));
    try { localStorage.setItem(KEY + '.fails', JSON.stringify(f)); } catch {}
    return f.n >= 3 ? 'Wrong PIN. Locked for a little while to stop guessing.' : 'Wrong PIN. Try again.';
  }
}
function lockNow() {
  if (!cryptoKey) return;
  flushSave().then(() => {
    try { lockedBlob = JSON.parse(localStorage.getItem(KEY)); } catch {}
    S = null; cryptoKey = null; aggCache.clear(); closeModal(); renderLock();
  });
}
// Auto-lock after 5 minutes without input, and when the tab is hidden for 5 minutes.
let idleT = null, hiddenAt = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (cryptoKey && hiddenAt && Date.now() - hiddenAt > 300000) lockNow(); });
function bumpIdle() { if (!cryptoKey) return; clearTimeout(idleT); idleT = setTimeout(lockNow, 300000); }
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, bumpIdle, { passive: true }));

/* ---------- sample kingdom ---------- */
function sampleState() {
  const r = rng(11);
  const pick = a => a[Math.floor(r() * a.length)];
  const today = todayStr();
  const cur = monthOf(today), curDay = Number(today.slice(8));
  const months = []; for (let k = -5; k <= 0; k++) months.push(addMonths(cur, k));
  const txns = [];
  const add = (m, d, desc, amt, cat) => {
    d = Math.min(d, daysIn(m));
    if (m === cur && d > curDay) return;
    txns.push({ id: uid(), date: `${m}-${pad(d)}`, desc, amount: round2(amt), cat });
  };
  months.forEach((m, i) => {
    add(m, 1, 'Rent', -1450, 'home'); add(m, 1, 'Iron Gym membership', -45, 'subs');
    add(m, 3, 'Paycheck', 2100, 'income'); add(m, 17, 'Paycheck', 2100, 'income');
    if (i % 2 === 1) add(m, 24, 'Freelance design job', 180 + Math.round(r() * 220), 'income');
    add(m, 4, 'Transfer to emergency fund', -200, 'save'); add(m, 18, 'Brokerage deposit', -150, 'save');
    add(m, 5, 'Car insurance', -128, 'transport');
    add(m, 6, 'Netflix', -15.49, 'subs'); add(m, 11, 'Spotify', -11.99, 'subs'); add(m, 14, 'Cloud storage', -2.99, 'subs'); add(m, 22, 'StreamMax', -12.99, 'subs');
    add(m, 8, 'Internet', -70, 'home'); add(m, 12, 'Electric bill', -(88 + r() * 45), 'home'); add(m, 20, 'Phone plan', -55, 'home');
    add(m, 10, 'Car loan payment', -310, 'debt'); add(m, 15, 'Credit card payment', -150, 'debt'); add(m, 25, 'Student loan payment', -160, 'debt');
    [2, 9, 16, 23, 30].forEach(d => add(m, d, pick(['FreshMart', 'Green Basket', 'FreshMart', 'Corner Grocer']), -(85 + r() * 60), 'groceries'));
    [4, 11, 18, 26].forEach(d => add(m, d, 'Gas station', -(40 + r() * 16), 'transport'));
    const dn = 6 + Math.floor(r() * 4);
    for (let k = 0; k < dn; k++) add(m, 1 + Math.floor(r() * 28), pick(['Taco Loco', 'Pho Bar', 'Burger Den', 'Sushi Go', 'Coffee House', 'Pizza Night']), -(14 + r() * 48), 'dining');
    for (let k = 0; k < 2 + Math.floor(r() * 2); k++) add(m, 1 + Math.floor(r() * 28), pick(['Online order', 'Target run', 'Shoe store', 'Home goods']), -(25 + r() * 115), 'shopping');
    for (let k = 0; k < 2 + Math.floor(r() * 2); k++) add(m, 1 + Math.floor(r() * 28), pick(['Movie tickets', 'Concert', 'Bowling', 'Game purchase']), -(18 + r() * 60), 'fun');
    add(m, 1 + Math.floor(r() * 28), pick(['Pharmacy', 'Haircut', 'Gift']), -(15 + r() * 45), 'health');
  });
  const accounts = [
    { id: uid(), name: 'Emergency fund', kind: 'emergency', balance: 2600 },
    { id: uid(), name: 'Brokerage account', kind: 'invest', balance: 5400 }
  ];
  const debts = [
    { id: uid(), name: 'Credit card', balance: 3400, start: 4800, apr: 24.9, min: 95 },
    { id: uid(), name: 'Car loan', balance: 9800, start: 12500, apr: 6.5, min: 310 },
    { id: uid(), name: 'Student loan', balance: 14200, start: 15800, apr: 5.0, min: 160 }
  ];
  const nwNow = 2600 + 5400 - 27400;
  const history = months.map((m, i) => ({ month: m, nw: Math.round(nwNow - (5 - i) * 690 + (i % 2 ? 120 : -80) * (i < 5 ? 1 : 0)) }));
  const lastWeek = weekIndex(today) - 1;
  return {
    v: 1, sample: true, txns, accounts, debts, history,
    budgets: { home: 1750, dining: 250, groceries: 560, transport: 330, shopping: 200, health: 80, subs: 60, fun: 150 },
    xp: 640, claimed: { logger_first: today }, subs: {},
    streak: { count: 3, last: lastWeek, shields: 0, total: 9 },
    extraPaid: 0, manualCount: 0, invested: false
  };
}
function emptyState() {
  return { v: 1, sample: false, txns: [], accounts: [{ id: uid(), name: 'Emergency fund', kind: 'emergency', balance: 0 }], debts: [], history: [],
    budgets: { home: 0, dining: 0, groceries: 0, transport: 0, shopping: 0, health: 0, subs: 0, fun: 0 }, xp: 0, claimed: {}, subs: {},
    streak: { count: 0, last: null, shields: 0, total: 0 }, extraPaid: 0, manualCount: 0, invested: false };
}
let S = load();
if (!S && !lockedBlob) S = sampleState();

/* ---------- derived numbers ---------- */
const aggCache = new Map();
function monthAgg(m) {
  const hit = aggCache.get(m); if (hit) return hit;
  const a = { income: 0, spend: 0, debt: 0, extra: 0, save: 0, cats: {}, n: 0 };
  SPEND.forEach(c => a.cats[c] = 0);
  for (const t of S.txns) {
    if (monthOf(t.date) !== m) continue;
    a.n++;
    if (t.cat === 'income') a.income += t.amount;
    else if (t.cat === 'debt') { a.debt += -t.amount; if (t.extra) a.extra += -t.amount; }
    else if (t.cat === 'save') a.save += -t.amount;
    else if (a.cats[t.cat] !== undefined) { a.cats[t.cat] += -t.amount; a.spend += -t.amount; }
  }
  a.kept = a.save + a.extra;
  a.rate = a.income > 0 ? a.kept / a.income : 0;
  a.flow = a.income - a.spend - a.debt - a.save;
  aggCache.set(m, a);
  return a;
}
const curMonth = () => monthOf(todayStr());
function monthsWithData() {
  const set = new Set(S.txns.map(t => monthOf(t.date)));
  set.add(curMonth());
  return [...set].sort();
}
const debtTotal = () => S.debts.reduce((s, d) => s + d.balance, 0);
const acctTotal = kind => S.accounts.filter(a => !kind || a.kind === kind).reduce((s, a) => s + a.balance, 0);
const netWorth = () => acctTotal() - debtTotal();
function essentials() {
  const cm = curMonth();
  const prev = [1, 2, 3].map(k => addMonths(cm, -k)).filter(m => S.txns.some(t => monthOf(t.date) === m));
  const mins = S.debts.filter(d => d.balance > 0).reduce((s, d) => s + d.min, 0);
  if (!prev.length) {
    const a = monthAgg(cm);
    return ESSENTIAL.reduce((s, c) => s + a.cats[c], 0) + mins;
  }
  const avg = prev.map(monthAgg).reduce((s, a) => s + ESSENTIAL.reduce((x, c) => x + a.cats[c], 0), 0) / prev.length;
  return avg + mins;
}
function wallMonths() { const e = essentials(); return e > 0 ? acctTotal('emergency') / e : 0; }
function wallTier() { const m = wallMonths(); return m >= 6 ? 3 : m >= 3 ? 2 : m >= 1 ? 1 : 0; }
function levelInfo(xp) {
  let lvl = 1; while (lvl < 10 && xp >= 50 * lvl * (lvl + 1)) lvl++;
  const lo = 50 * (lvl - 1) * lvl, hi = 50 * lvl * (lvl + 1);
  return { lvl, title: TITLES[lvl - 1], lo, hi, into: xp - lo, need: hi - lo, max: lvl === 10 };
}
function recordHistory() {
  const m = curMonth();
  const h = S.history.find(x => x.month === m);
  if (h) h.nw = Math.round(netWorth()); else S.history.push({ month: m, nw: Math.round(netWorth()) });
  S.history.sort((a, b) => a.month < b.month ? -1 : 1);
}
function detectSubs() {
  const map = {};
  for (const t of S.txns) {
    if (t.cat !== 'subs') continue;
    const k = t.desc.trim();
    (map[k] = map[k] || { name: k, months: new Set(), total: 0, n: 0, last: 0 });
    map[k].months.add(monthOf(t.date)); map[k].total += -t.amount; map[k].n++; map[k].last = -t.amount;
  }
  return Object.values(map).filter(s => s.months.size >= 2 || S.subs[s.name]).map(s => ({ name: s.name, monthly: s.last, status: S.subs[s.name] || 'unreviewed' }))
    .sort((a, b) => b.monthly - a.monthly);
}
function noSpendDays(m) {
  const today = todayStr();
  const last = m === monthOf(today) ? Number(today.slice(8)) : daysIn(m);
  const spent = new Set(S.txns.filter(t => monthOf(t.date) === m && DISCRETIONARY.includes(t.cat)).map(t => Number(t.date.slice(8))));
  let n = 0; for (let d = 1; d <= last; d++) if (!spent.has(d)) n++;
  return n;
}

/* ---------- quests ---------- */
function questList() {
  const cm = curMonth(), lm = addMonths(cm, -1);
  const wm = wallMonths();
  const ess = essentials();
  const subs = detectSubs();
  const slain = S.debts.filter(d => d.balance <= 0).length;
  const lastAgg = monthAgg(lm);
  const underLast = S.budgets ? SPEND.filter(c => S.budgets[c] > 0 && lastAgg.cats[c] <= S.budgets[c]).length : 0;
  const budgeted = SPEND.filter(c => S.budgets[c] > 0).length;
  const cur = monthAgg(cm);
  const q = [
    { id: 'walls1', kind: 'Castle walls', name: 'Castle Walls I', desc: 'Emergency fund covers 1 month of essentials.', xp: 100, value: wm, target: 1, fmt: v => v.toFixed(1) + ' / 1 month', hint: ess > 0 ? `${money(Math.max(0, ess - acctTotal('emergency')))} to go` : '' },
    { id: 'walls2', kind: 'Castle walls', name: 'Castle Walls II', desc: 'Emergency fund covers 3 months of essentials.', xp: 250, value: wm, target: 3, fmt: v => v.toFixed(1) + ' / 3 months', after: 'walls1' },
    { id: 'walls3', kind: 'Castle walls', name: 'Castle Walls III', desc: 'Emergency fund covers 6 months. Your keep is siege-proof.', xp: 500, value: wm, target: 6, fmt: v => v.toFixed(1) + ' / 6 months', after: 'walls2' },
    { id: 'slay1', kind: 'Dragon hunt', name: 'First Blood', desc: 'Slay your first dragon: pay a debt down to $0.', xp: 300, value: slain, target: 1, fmt: v => `${v} / 1 slain`, hide: !S.debts.length },
    { id: 'extra500', kind: 'Dragon hunt', name: 'Sharpened Blade', desc: 'Pay $500 extra toward debt, beyond the minimums.', xp: 150, value: S.extraPaid, target: 500, fmt: v => `${money(v)} / $500`, hide: !S.debts.length },
    { id: 'subs', kind: 'Treasury', name: 'Royal Audit', desc: 'Decide keep or cancel for every subscription Coinhold found.', xp: 80, value: subs.filter(s => s.status !== 'unreviewed').length, target: Math.max(1, subs.length), fmt: (v, t) => `${v} / ${t} reviewed`, hide: !subs.length },
    { id: 'nospend-' + cm, kind: monthName(cm) + ' quest', name: 'Quiet Purse', desc: 'Have 12 days this month with no dining, shopping or fun spending.', xp: 120, value: noSpendDays(cm), target: 12, fmt: v => `${v} / 12 days` },
    { id: 'save20-' + cm, kind: monthName(cm) + ' quest', name: 'Pay Your Future Self', desc: 'Keep 20% of this month’s income: savings deposits plus extra debt payments.', xp: 200, value: cur.rate, target: 0.2, fmt: v => `${pct(v)} / 20%` },
    { id: 'upkeep-' + lm, kind: monthName(lm) + ' review', name: 'Steady Upkeep', desc: `Finish ${monthName(lm, true)} under budget in at least 6 categories.`, xp: 150, value: underLast, target: 6, fmt: v => `${v} / 6 categories`, hide: budgeted < 6 || !lastAgg.n },
    { id: 'streak4', kind: 'Habit', name: 'Faithful Steward', desc: 'Check in 4 weeks in a row.', xp: 150, value: S.streak.count, target: 4, fmt: v => `${v} / 4 weeks` },
    { id: 'streak12', kind: 'Habit', name: 'Season of Discipline', desc: 'Check in 12 weeks in a row.', xp: 400, value: S.streak.count, target: 12, fmt: v => `${v} / 12 weeks`, after: 'streak4' },
    { id: 'logger', kind: 'Habit', name: 'Royal Scribe', desc: 'Log or import 25 transactions yourself.', xp: 60, value: S.manualCount, target: 25, fmt: v => `${Math.min(v, 25)} / 25` },
    { id: 'invest1', kind: 'Growth', name: 'Plant the Orchard', desc: 'Make a deposit into an investment account through Coinhold.', xp: 50, value: S.invested ? 1 : 0, target: 1, fmt: v => v ? 'Done' : 'Not yet' }
  ];
  return q.filter(x => !x.hide && (!x.after || S.claimed[x.after]));
}
const questReady = q => q.value >= q.target && !S.claimed[q.id];
const readyCount = () => questList().filter(questReady).length;

/* ---------- actions ---------- */
function gainXP(n, reason, fromEl) {
  if (n <= 0) return;
  const before = levelInfo(S.xp).lvl;
  S.xp += Math.round(n);
  toast(`<b>+${Math.round(n)} XP</b> ${esc(reason)}`);
  if (fromEl) coinBurst(fromEl, Math.min(14, 4 + Math.round(n / 25)));
  const after = levelInfo(S.xp);
  if (after.lvl > before) setTimeout(() => showLevelUp(after), 450);
}
function commit() { aggCache.clear(); recordHistory(); save(); render(); }
function addTxn(t, manual) {
  if (S.txns.length >= MAX_TXNS) { toast('The ledger is full. Remove old transactions to add more.'); return; }
  S.txns.push({ id: uid(), date: t.date, desc: cleanText(t.desc, 'Transaction'), amount: round2(clampNum(t.amount, -MAX_AMT, MAX_AMT)), cat: t.cat, ...(t.extra ? { extra: true } : {}) });
  aggCache.clear();
  if (manual) S.manualCount++;
}
function attack(debtId, amount, kind, el) {
  const d = S.debts.find(x => x.id === debtId); if (!d || amount <= 0) return;
  amount = Math.min(amount, d.balance + d.balance * d.apr / 1200);
  const interest = kind === 'min' ? d.balance * d.apr / 1200 : 0;
  const principal = Math.min(d.balance, Math.max(0, amount - interest));
  d.balance = round2(Math.max(0, d.balance - principal));
  addTxn({ date: todayStr(), desc: (kind === 'min' ? 'Payment: ' : 'Extra payment: ') + d.name, amount: -amount, cat: 'debt', extra: kind !== 'min' }, true);
  if (kind !== 'min') S.extraPaid += amount;
  const card = el && el.closest('.dragon');
  if (card) { const f = document.createElement('div'); f.className = 'dmg'; f.textContent = '−' + money(principal); card.appendChild(f); setTimeout(() => f.remove(), 1200); }
  gainXP(kind === 'min' ? 10 : amount / 10, kind === 'min' ? `for paying ${d.name} on time` : `for striking ${d.name}`, el);
  if (d.balance <= 0) setTimeout(() => modal(`<div class="levelup"><div class="label">Dragon slain</div><div class="big">${esc(d.name)} is defeated</div><p>That ${d.apr}% fire is out for good. Its old ${money(d.min)} minimum is now free to attack the next dragon.</p></div><div class="btns"><button class="btn primary" data-close>Onward</button></div>`), 700);
  setTimeout(commit, 650);
}
function deposit(acctId, amount, el) {
  const a = S.accounts.find(x => x.id === acctId); if (!a || amount <= 0) return;
  a.balance = round2(a.balance + amount);
  addTxn({ date: todayStr(), desc: (a.kind === 'invest' ? 'Investment deposit: ' : 'Deposit: ') + a.name, amount: -amount, cat: 'save' }, true);
  if (a.kind === 'invest') S.invested = true;
  gainXP(amount / 10, a.kind === 'invest' ? 'for planting gold in the orchard' : 'for raising the castle walls', el);
  commit();
}
function claim(id, el) {
  const q = questList().find(x => x.id === id); if (!q || !questReady(q)) return;
  S.claimed[id] = todayStr();
  gainXP(q.xp, `for completing ${q.name}`, el);
  commit();
}
function checkIn(el) {
  const today = todayStr(), wk = weekIndex(today);
  const st = S.streak;
  if (st.last === wk) return;
  let note = '';
  if (st.last === wk - 1) st.count++;
  else if (st.last !== null && wk - st.last === 2 && st.shields > 0) { st.shields--; st.count++; note = 'A shield saved your streak after a missed week.'; }
  else { if (st.count > 1) note = `Your ${st.count}-week streak ended. A new one starts today.`; st.count = 1; }
  st.last = wk; st.total = (st.total || 0) + 1;
  if (st.count % 4 === 0 && st.shields < 2) { st.shields++; note += (note ? ' ' : '') + 'You earned a streak shield.'; }
  const cm = curMonth(), a = monthAgg(cm);
  const dayFrac = Number(today.slice(8)) / daysIn(cm);
  const onPace = SPEND.filter(c => S.budgets[c] > 0 && a.cats[c] <= S.budgets[c] * Math.max(dayFrac, .15) * 1.05);
  const xp = 50 + onPace.length * 10 + Math.min(st.count, 10) * 5;
  const rows = SPEND.filter(c => S.budgets[c] > 0).map(c => {
    const ok = onPace.includes(c);
    return `<div class="kv"><span>${CATS[c].name}</span><span class="status">${ok ? ICON.ok + ' On pace' : ICON.warn + ' Ahead of pace'}</span></div>`;
  }).join('');
  modal(`<div class="label">Weekly check-in</div><h2>Week ${st.count} of your streak</h2>
    <p>Spent so far in ${monthName(cm, true)}: <b>${money(a.spend)}</b> on living costs, ${money(a.debt)} on debt, ${money(a.save)} saved.</p>
    ${rows ? `<div>${rows}</div>` : '<p class="muted">Set budgets in the Ledger to get on-pace bonuses.</p>'}
    ${note ? `<p class="small">${esc(note)}</p>` : ''}
    <p><b>+${xp} XP</b>: 50 for showing up, ${onPace.length * 10} for categories on pace, ${Math.min(st.count, 10) * 5} streak bonus.</p>
    <div class="btns"><button class="btn gold" data-close>Collect</button></div>`);
  gainXP(xp, 'for your weekly check-in', el);
  commit();
}

/* ---------- feedback ---------- */
function toast(html) {
  const z = $('#toasts'); const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; z.appendChild(t);
  setTimeout(() => t.remove(), 3200);
  while (z.children.length > 3) z.firstChild.remove();
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function coinBurst(el, n) {
  if (reduced || !el || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const target = $('#rank .xpbar'); const tr = target ? target.getBoundingClientRect() : { left: innerWidth - 100, top: 20, width: 0, height: 0 };
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div'); c.className = 'coin'; document.body.appendChild(c);
    const dx = (Math.random() - .5) * 120, dy = -40 - Math.random() * 70;
    const tx = tr.left + tr.width * Math.random() - cx, ty = tr.top + tr.height / 2 - cy;
    c.style.left = cx - 7 + 'px'; c.style.top = cy - 7 + 'px';
    c.animate([{ transform: 'translate(0,0) scale(.6)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(1)`, opacity: 1, offset: .35 }, { transform: `translate(${tx}px,${ty}px) scale(.5)`, opacity: .2 }],
      { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.3,.7,.4,1)', delay: i * 30 }).onfinish = () => c.remove();
  }
}
function modal(html) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const first = m.querySelector('button, input, textarea'); if (first) first.focus();
}
function closeModal() { $('#modal').innerHTML = ''; }
function confirmBox(title, body, okLabel, fn) {
  modal(`<h2>${esc(title)}</h2><p>${body}</p><div class="btns"><button class="btn" data-close>Cancel</button><button class="btn primary" id="okbtn">${esc(okLabel)}</button></div>`);
  $('#okbtn').onclick = () => { closeModal(); fn(); };
}
function showLevelUp(info) {
  modal(`<div class="levelup"><div class="label">Level ${info.lvl}</div><div class="big">You are now a ${info.title}</div>
    <p>${info.lvl >= 5 ? 'Your keep gains a new tower.' : 'Your kingdom grows.'} ${info.max ? 'You reached the highest rank in the land.' : `${info.need} XP to the next rank.`}</p></div>
    <div class="btns"><button class="btn gold" data-close>Long live the ${info.title}</button></div>`);
}

/* ---------- tooltip ---------- */
const tip = $('#tip');
function showTip(html, x, y) { tip.innerHTML = html; tip.hidden = false; const w = tip.offsetWidth, h = tip.offsetHeight; let left = x + 14, top = y - h - 10; if (left + w > innerWidth - 8) left = x - w - 14; if (top < 8) top = y + 16; tip.style.left = left + 'px'; tip.style.top = top + 'px'; }
function hideTip() { tip.hidden = true; }
document.addEventListener('pointermove', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t.getAttribute('data-tip'), e.clientX, e.clientY); else if (!e.target.closest || !e.target.closest('[data-cross]')) hideTip(); });
document.addEventListener('scroll', hideTip, true);

/* ---------- header ---------- */
function renderHeader() {
  const L = levelInfo(S.xp);
  const wk = weekIndex(todayStr());
  const done = S.streak.last === wk;
  $('#rank').innerHTML = `
    <div class="rankbox"><div class="rankline"><span><b>${L.title}</b> · Level ${L.lvl}</span><span class="muted">${L.max ? S.xp + ' XP' : `${L.into} / ${L.need} XP`}</span></div>
      <div class="xpbar" role="progressbar" aria-label="Experience to next level" aria-valuemin="0" aria-valuemax="${L.need}" aria-valuenow="${L.into}"><i style="width:${L.max ? 100 : Math.min(100, L.into / L.need * 100)}%"></i></div></div>
    <span class="chip" title="Weekly check-in streak">${ICON.flame}${S.streak.count} wk streak</span>
    <span class="chip" title="Streak shields protect one missed week">${ICON.shield}${S.streak.shields}</span>
    <button class="btn ${done ? '' : 'gold'}" id="checkin" ${done ? 'disabled' : ''}>${done ? 'Checked in this week' : 'Weekly check-in'}</button>`;
  $('#banner').innerHTML = (S.sample ? `<div class="banner"><span><b>Example kingdom.</b> These are sample numbers so you can see how it plays. Start fresh to build yours.</span><span class="btns"><button class="btn sm primary" id="fresh">Start my own kingdom</button></span></div>` : '')
    + (!storageOK ? `<div class="banner" style="margin-top:8px"><span>This browser is blocking storage, so progress will reset when you close the page. Use Ledger → Backup to keep a copy.</span></div>` : '');
}

/* ---------- kingdom view ---------- */
const DRAGON_HUES = { hot: ['#e0523f', '#8e2318', '#f6b39f'], warm: ['#ee8a3c', '#9a4a12', '#fbd0a6'], cool: ['#7f72e6', '#3c3194', '#cdc7fa'] };
function dragonSVG(d, i, x, y, sc) {
  const hp = Math.max(0, Math.min(1, d.balance / (d.start || d.balance)));
  return `<g class="dragon-g" data-goto="dragon-${d.id}" data-tip="<b>${esc(esc(d.name))}</b><br>${money(d.balance)} at ${d.apr}%<br>Breathes ${money(d.balance * d.apr / 1200)} of interest a month">
  <g transform="translate(${x} ${y}) scale(${sc})"><g class="bob" style="animation-delay:${i * .5}s">${dragonArt(d, 'dg' + i, true)}
    <rect x="-34" y="40" width="80" height="8" rx="4" fill="#fff" opacity=".9"/><rect x="-34" y="40" width="${80 * hp}" height="8" rx="4" fill="#d03b3b"/>
  </g></g></g>`;
}
function dragonArt(d, g, animate) {
  const kind = d.apr >= 15 ? 'hot' : d.apr >= 7 ? 'warm' : 'cool';
  const [body, dark, belly] = DRAGON_HUES[kind];
  const flap = reduced || !animate ? '' : (o, dur) => `<animateTransform attributeName="transform" type="rotate" values="0 ${o};-14 ${o};0 ${o}" dur="${dur}s" repeatCount="indefinite"/>`;
  return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${body}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
    <g>${flap ? flap('10 -6', 1.3) : ''}<path d="M10 -6 L30 -62 Q36 -66 42 -60 L66 -22 Q56 -28 50 -18 Q42 -28 34 -14 Q26 -22 18 -6Z" fill="${dark}"/>
      <path d="M30 -62 L34 -14 M42 -60 L50 -18" stroke="${body}" stroke-width="1.5" opacity=".6"/></g>
    <path d="M28 4 C52 2 64 22 84 10 L88 16 C68 34 50 18 28 14Z" fill="url(#${g})"/>
    <path d="M84 10 L98 4 L92 20Z" fill="${dark}"/>
    <path d="M-22 2 C-20 -16 22 -20 36 -6 C46 4 40 18 20 20 C0 22 -22 16 -22 2Z" fill="url(#${g})"/>
    <path d="M-16 8 C0 18 20 18 34 10 C22 22 -2 22 -16 8Z" fill="${belly}"/>
    <path d="M-6 13 l2 5 M4 15 l1 5 M14 15 l0 5 M24 13 l-1 5" stroke="${dark}" stroke-width="1.2" opacity=".5"/>
    <path d="M-8 -12 l4 -8 l3 7 M4 -16 l4 -8 l3 7 M16 -16 l4 -8 l3 7 M28 -11 l4 -7 l2 6" fill="${dark}"/>
    <path d="M-2 18 l-4 12 l6 0 M22 18 l2 12 l6 0" stroke="${dark}" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M-14 -4 C-24 -14 -32 -26 -42 -28 L-46 -16 C-36 -14 -28 -4 -20 6Z" fill="url(#${g})"/>
    <path d="M-40 -32 C-50 -36 -64 -32 -72 -24 L-74 -18 C-64 -16 -56 -13 -46 -12 C-38 -14 -34 -24 -40 -32Z" fill="${body}"/>
    <path d="M-72 -18 C-64 -12 -54 -10 -46 -12" stroke="${dark}" stroke-width="1.5" fill="none"/>
    <path d="M-42 -32 L-34 -46 L-38 -31Z M-48 -34 L-44 -46 L-44 -33Z" fill="${dark}"/>
    <circle cx="-54" cy="-26" r="3.2" fill="#ffd76a"/><ellipse cx="-54" cy="-26" rx="1" ry="2.6" fill="#1b1505"/>
    <circle cx="-70" cy="-23" r="1.1" fill="${dark}"/>
    ${d.apr >= 15 ? `<path d="M-74 -20 C-86 -26 -96 -18 -108 -24 C-100 -14 -112 -10 -104 -4 C-94 -8 -86 -10 -74 -16Z" fill="#f2b632"><animate attributeName="opacity" values="1;.55;1" dur=".9s" repeatCount="indefinite"/></path><path d="M-74 -19 C-82 -22 -88 -17 -94 -19 C-88 -13 -82 -14 -74 -17Z" fill="#fff2b8"/>` : ''}
    <g>${flap ? flap('2 -8', 1.3) : ''}<path d="M2 -8 L-8 -60 Q-4 -66 4 -62 L32 -26 Q22 -30 18 -18 Q10 -28 4 -14Z" fill="${body}"/>
      <path d="M-8 -60 L4 -14 M4 -62 L18 -18" stroke="${dark}" stroke-width="1.5" opacity=".45"/></g>`;
}
function sceneSVG() {
  const L = levelInfo(S.xp), tier = wallTier(), inv = acctTotal('invest');
  const towers = Math.min(4, 1 + Math.floor(L.lvl / 3));
  const W = 900, H = 320, gx = 290, G = 262;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your kingdom: a castle at level ${L.lvl}, walls tier ${tier}, ${S.debts.filter(d => d.balance > 0).length} debt dragons">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky1)"/><stop offset="1" stop-color="var(--sky2)"/></linearGradient>
    <linearGradient id="stoneG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--stone)"/><stop offset=".75" stop-color="var(--stone)"/><stop offset="1" stop-color="var(--stone2)"/></linearGradient>
    <linearGradient id="roofG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--roof)"/><stop offset=".6" stop-color="var(--roof)"/><stop offset="1" stop-color="var(--ink)" stop-opacity=".9"/></linearGradient>
    <pattern id="bricks" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 12H24M0 6H24M6 0V6M18 6V12" stroke="var(--stone2)" stroke-width="1" opacity=".45" fill="none"/></pattern>
    <radialGradient id="glow"><stop offset="0" stop-color="var(--win)" stop-opacity=".55"/><stop offset="1" stop-color="var(--win)" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="815" cy="58" r="40" fill="url(#glow)"/><circle cx="815" cy="58" r="24" fill="var(--gold-fill)"/>
  ${[[120, 60, 1], [470, 40, .8], [690, 92, .7]].map(([cx, cy, k]) => `<g fill="var(--cloud)" opacity=".85" transform="translate(${cx} ${cy}) scale(${k})"><ellipse cx="0" cy="0" rx="38" ry="13"/><circle cx="-14" cy="-8" r="14"/><circle cx="10" cy="-12" r="17"/></g>`).join('')}
  <path d="M0 210 L90 150 L160 196 L250 136 L350 200 L450 150 L560 205 L660 160 L760 200 L900 150 V260 H0Z" fill="var(--hill2)" opacity=".35"/>
  <path d="M0 240 Q150 196 320 226 T640 216 T900 230 V320 H0Z" fill="var(--hill1)"/>
  <path d="M0 274 Q200 244 420 266 T900 262 V320 H0Z" fill="var(--hill2)"/>
  <path d="M${gx - 22} ${G} Q${gx - 10} 290 ${gx - 60} 320 H${gx + 60} Q${gx + 10} 290 ${gx + 22} ${G}Z" fill="var(--path)" opacity=".8"/>`;
  // keep
  const kH = 96 + Math.min(L.lvl, 10) * 6, kx = gx - 56, kw = 112, ky = G - kH;
  const tower = (x, h, w = 38) => {
    const ty = G - h;
    return `<rect x="${x - w / 2}" y="${ty}" width="${w}" height="${h}" fill="url(#stoneG)"/><rect x="${x - w / 2}" y="${ty}" width="${w}" height="${h}" fill="url(#bricks)"/>
      <rect x="${x - w / 2 - 3}" y="${ty - 4}" width="${w + 6}" height="6" fill="var(--stone2)"/>
      <path d="M${x - w / 2 - 6} ${ty - 4} L${x} ${ty - 50} L${x + w / 2 + 6} ${ty - 4}Z" fill="url(#roofG)"/>
      <line x1="${x}" y1="${ty - 50}" x2="${x}" y2="${ty - 66}" stroke="var(--ink2)" stroke-width="1.5"/><path class="flag" d="M${x} ${ty - 66} h14 l-4 4 l4 4 h-14Z" fill="var(--gold-fill)"/>
      <rect x="${x - 3}" y="${ty + 18}" width="6" height="16" rx="3" fill="var(--ink)" opacity=".75"/>`;
  };
  const tx = [[gx - 92, kH - 14], [gx + 92, kH - 14], [gx - 136, kH - 44], [gx + 136, kH - 44]].slice(0, towers);
  tx.slice(2).forEach(([x, h]) => s += tower(x, h, 32));
  // walls by tier: palisade, stone wall, wall with gatehouse, plus moat at tier 3
  if (tier === 0) {
    for (let x = gx - 180; x <= gx + 180; x += 12) s += `<path d="M${x} ${G} v-18 l4 -6 l4 6 v18Z" fill="var(--wood)" opacity=".85"/>`;
    s += `<text x="${gx}" y="300" text-anchor="middle" font-size="13" fill="var(--ink)" opacity=".8" font-family="DM Sans, sans-serif">Save 1 month of essentials to build stone walls</text>`;
  }
  tx.slice(0, 2).forEach(([x, h]) => s += tower(x, h));
  s += `<rect x="${kx}" y="${ky}" width="${kw}" height="${kH}" fill="url(#stoneG)"/><rect x="${kx}" y="${ky}" width="${kw}" height="${kH}" fill="url(#bricks)"/>`;
  for (let x = kx; x < kx + kw; x += 22) s += `<rect x="${x}" y="${ky - 12}" width="14" height="12" fill="var(--stone)"/>`;
  s += `<path d="M${kx + 22} ${ky + 44} v-12 a8 8 0 0 1 16 0 v12Z M${kx + kw - 38} ${ky + 44} v-12 a8 8 0 0 1 16 0 v12Z" fill="var(--win)"/>
    <circle cx="${kx + 30}" cy="${ky + 36}" r="16" fill="url(#glow)"/><circle cx="${kx + kw - 30}" cy="${ky + 36}" r="16" fill="url(#glow)"/>
    <path d="M${gx - 10} ${ky + 8} h20 v34 l-10 -7 l-10 7Z" fill="var(--royal)"/><circle cx="${gx}" cy="${ky + 22}" r="5" fill="var(--gold-fill)"/>
    <line x1="${gx}" y1="${ky - 12}" x2="${gx}" y2="${ky - 52}" stroke="var(--ink2)" stroke-width="2"/><path class="flag" d="M${gx} ${ky - 52} h30 l-8 8 l8 8 h-30Z" fill="var(--gold-fill)"/>`;
  if (tier > 0) {
    const wh = 22 + tier * 12, wy = G - wh;
    s += `<rect x="${gx - 190}" y="${wy}" width="380" height="${wh}" fill="url(#stoneG)"/><rect x="${gx - 190}" y="${wy}" width="380" height="${wh}" fill="url(#bricks)"/>`;
    for (let x = gx - 190; x < gx + 190; x += 18) s += `<rect x="${x}" y="${wy - 9}" width="11" height="9" fill="var(--stone)"/>`;
    if (tier >= 2) [gx - 196, gx + 196].forEach(x => s += `<rect x="${x - 14}" y="${wy - 26}" width="28" height="${wh + 26}" fill="url(#stoneG)"/><rect x="${x - 16}" y="${wy - 30}" width="32" height="6" fill="var(--stone2)"/>`);
  }
  s += `<path d="M${gx - 16} ${G} v-24 a16 16 0 0 1 32 0 v24Z" fill="var(--wood)"/><path d="M${gx - 16} ${G - 20} h32 M${gx - 16} ${G - 10} h32 M${gx - 8} ${G} v-36 M${gx} ${G} v-40 M${gx + 8} ${G} v-36" stroke="var(--ink)" stroke-width="1.5" opacity=".35"/>`;
  if (tier === 3) s += `<path d="M${gx - 230} ${G + 6} Q${gx} ${G + 22} ${gx + 230} ${G + 6} L${gx + 230} ${G + 12} Q${gx} ${G + 30} ${gx - 230} ${G + 12}Z" fill="var(--s1)" opacity=".55"/>`;
  // orchard
  if (inv > 0) {
    const trees = Math.max(1, Math.min(6, Math.round(Math.log10(inv + 1) * 1.5)));
    for (let i = 0; i < trees; i++) {
      const x = 46 + i * 24, y = 252 - (i % 2) * 6;
      s += `<rect x="${x - 2}" y="${y}" width="4" height="16" fill="var(--wood)"/><circle cx="${x}" cy="${y - 6}" r="12" fill="var(--s6)"/><circle cx="${x + 4}" cy="${y - 10}" r="8" fill="var(--leaf)"/>
        <circle cx="${x - 5}" cy="${y - 4}" r="2.4" fill="var(--gold-fill)"/><circle cx="${x + 5}" cy="${y - 2}" r="2.4" fill="var(--gold-fill)"/>`;
    }
    s += `<text x="${46 + (trees - 1) * 12}" y="222" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)" opacity=".85" font-family="DM Sans, sans-serif">Orchard ${money(inv)}</text>`;
  }
  const live = S.debts.filter(d => d.balance > 0).sort((a, b) => b.apr - a.apr);
  const spots = [[585, 178], [705, 100], [780, 200], [690, 240]];
  live.slice(0, 4).forEach((d, i) => { const sc = .6 + Math.min(1, d.balance / 15000) * .3; s += dragonSVG(d, i, spots[i][0], spots[i][1], sc); });
  if (!live.length && S.debts.length) s += `<text x="680" y="160" text-anchor="middle" font-size="18" fill="var(--ink)" font-family="Cinzel, serif">The skies are clear. Every dragon is slain.</text>`;
  return s + '</svg>';
}
function renderKingdom() {
  const cm = curMonth(), a = monthAgg(cm), pm = monthAgg(addMonths(cm, -1));
  const nw = netWorth();
  const prevH = S.history.filter(h => h.month < cm).slice(-1)[0];
  const nwDelta = prevH ? nw - prevH.nw : 0;
  const wm = wallMonths(), tier = wallTier();
  const ready = readyCount();
  const isEmpty = !S.txns.length && !S.debts.length && acctTotal() === 0;
  const welcome = isEmpty ? `<section class="panel welcome"><h2>Found your kingdom</h2><p>Three steps and your castle comes to life:</p>
    <ol><li><b>Add your money.</b> Enter your savings balance and any debts in the <a href="#ledger">Ledger</a>. Each debt becomes a dragon.</li>
    <li><b>Bring in your spending.</b> Export a CSV from your bank and import it, or log a few transactions by hand.</li>
    <li><b>Set budgets</b> for each category, then come back weekly to check in and keep your streak.</li></ol>
    <p><a class="btn primary" href="#ledger" style="text-decoration:none;display:inline-block">Open the Ledger</a></p></section>` : '';
  const dragons = S.debts.length ? S.debts.map(d => {
    const hp = d.start ? d.balance / d.start : 1, fire = d.balance * d.apr / 1200;
    return `<div class="dragon ${d.balance <= 0 ? 'slain' : ''}" id="dragon-${d.id}">
      <div class="top"><div><h3>${esc(d.name)}</h3><span class="small muted">${d.apr}% APR</span></div>
        <svg class="portrait" viewBox="-112 -68 214 104" aria-hidden="true"${d.balance <= 0 ? ' style="filter:grayscale(1);opacity:.5"' : ''}>${dragonArt(d, 'pd-' + d.id, false)}</svg></div>
      <div class="hp" role="progressbar" aria-label="${esc(d.name)} remaining balance" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(hp * 100)}"><i style="width:${Math.max(0, Math.min(100, hp * 100))}%"></i></div>
      <div class="top small"><span><b>${money(d.balance)}</b> HP left</span><span class="muted">${d.start ? pct(1 - hp) + ' defeated' : ''}</span></div>
      ${d.balance > 0 ? `<p class="small muted">Breathes ${money(fire, 2)} of interest fire each month.</p>
      <div class="row"><button class="btn sm" data-min="${d.id}">Pay minimum ${money(d.min)}</button><button class="btn sm primary" data-attack="${d.id}">${ICON.sword.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px;margin-right:4px"')}Extra attack</button></div>
      <form class="inline-form" data-attackform="${d.id}" hidden><label class="sr" for="atk-${d.id}" hidden>Amount</label><input id="atk-${d.id}" type="number" min="1" step="any" placeholder="Amount" required><button class="btn sm gold">Strike</button></form>`
      : '<p class="small"><b>Slain.</b> This debt is paid off.</p>'}
    </div>`;
  }).join('') : '<div class="empty">No dragons yet. Add debts in the Ledger, and each one appears here with an HP bar you can whittle down.</div>';
  const accts = S.accounts.map(ac => `<div class="dragon" style="background:var(--surface2)">
      <div class="top"><h3>${esc(ac.name)}</h3><span class="tag">${ac.kind === 'invest' ? 'Orchard' : 'Castle walls'}</span></div>
      <div class="top"><b style="font-size:1.2rem">${money(ac.balance)}</b>${ac.kind === 'emergency' ? `<span class="small muted">${wm.toFixed(1)} months covered</span>` : ''}</div>
      <div class="row"><button class="btn sm" data-dep="${ac.id}">Deposit</button></div>
      <form class="inline-form" data-depform="${ac.id}" hidden><input id="dep-${ac.id}" type="number" min="1" step="any" placeholder="Amount" aria-label="Deposit amount" required><button class="btn sm gold">Add gold</button></form>
    </div>`).join('');
  const hot = S.debts.filter(d => d.balance > 0).sort((x, y) => y.apr - x.apr)[0];
  const headline = isEmpty ? '' : `<div class="headline"><span class="ic">${a.flow >= 0 ? ICON.coin : ICON.warn}</span><p>${a.flow >= 0
      ? `This month you are <b class="up">${money(a.flow)} ahead</b>.`
      : `This month you are <b class="down">${money(-a.flow)} behind</b>.`}
    ${hot ? ` Your biggest threat is the <b>${esc(hot.name)}</b> dragon at ${hot.apr}%.` : ' No dragons left. Grow your orchard.'}
    ${ready ? ` <a href="#quests">${ready} reward${ready > 1 ? 's' : ''} waiting.</a>` : ''}</p></div>`;
  const hs = S.history.slice(-12);
  const spark = (() => { if (hs.length < 2) return ''; const v = hs.map(h => h.nw), lo = Math.min(...v), hi = Math.max(...v), rg = hi - lo || 1;
    const pts = v.map((x, i) => `${(i / (v.length - 1) * 100).toFixed(1)},${(30 - (x - lo) / rg * 26).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--royal)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`; })();
  const startDebt = S.debts.reduce((x, d) => x + (d.start || d.balance), 0);
  $('#view').innerHTML = `<div class="wrap" style="gap:16px">
    ${welcome}
    ${headline}
    <div class="scene">${sceneSVG()}<div class="cap"><span>Walls: tier ${tier} (${wm.toFixed(1)} mo)</span><span>Keep: level ${levelInfo(S.xp).lvl}</span>${ready ? `<span><a href="#quests">${ready} quest reward${ready > 1 ? 's' : ''} to claim</a></span>` : ''}</div></div>
    <div class="stats">
      <div class="stat"><span class="ico" style="background:var(--royal-soft);color:var(--royal)">${ICON.coin}</span><span class="label">Kingdom value</span><span class="v">${money(nw)}</span><span class="d">${prevH ? `<span class="${nwDelta >= 0 ? 'up' : 'down'}">${nwDelta >= 0 ? '▲' : '▼'} ${money(Math.abs(nwDelta))}</span> since ${monthName(prevH.month)}` : 'Net worth: savings minus debts'}</span>${spark}</div>
      <div class="stat"><span class="ico" style="background:var(--royal-soft);color:var(--royal)">${ICON.chart}</span><span class="label">Left this month</span><span class="v ${a.flow < 0 ? 'down' : ''}">${money(a.flow)}</span><span class="d">${money(a.income)} in, ${money(a.spend + a.debt + a.save)} out</span></div>
      <div class="stat"><span class="ico" style="background:var(--royal-soft);color:var(--royal)">${ICON.seed}</span><span class="label">Saved this month</span><span class="v">${pct(a.rate)}</span><span class="d">of income this month · goal 20%</span><div class="mini" aria-hidden="true"><i style="width:${Math.min(100, a.rate / .3 * 100)}%;background:${a.rate >= .2 ? 'var(--good-fill)' : 'var(--s1)'}"></i><b style="left:${.2 / .3 * 100}%"></b></div></div>
      <div class="stat"><span class="ico" style="background:var(--royal-soft);color:var(--royal)">${ICON.sword}</span><span class="label">Debt left</span><span class="v">${money(debtTotal())}</span><span class="d">${money(S.debts.reduce((s, d) => s + d.balance * d.apr / 1200, 0))} interest a month</span><div class="mini" aria-hidden="true"><i style="width:${startDebt ? (1 - debtTotal() / startDebt) * 100 : 0}%;background:var(--good-fill)"></i></div></div>
    </div>
    <section class="panel"><div class="panel-head"><h2>Dragons</h2><span class="muted small">Every debt is a dragon. Payments are attacks; interest is the fire it breathes.</span></div><div class="dragons">${dragons}</div></section>
    <section class="panel"><div class="panel-head"><h2>Treasury</h2><span class="muted small">Your emergency fund builds the walls. Investments grow the orchard.</span><span class="right"><a href="#ledger" class="small">Edit accounts</a></span></div><div class="dragons">${accts}</div></section>
  </div>`;
}

/* ---------- charts ---------- */
const slotColor = c => `var(--s${CATS[c].slot})`;
function niceMax(v) { if (v <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
const kfmt = v => Math.abs(v) >= 1000 ? (v < 0 ? '−' : '') + '$' + (Math.abs(v) / 1000).toFixed(Math.abs(v) % 1000 ? 1 : 0) + 'k' : money(v);
function donutSVG(a) {
  const total = a.spend; const R = 100, r = 66, C = 120;
  if (total <= 0) return `<svg viewBox="0 0 240 240"><circle cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" stroke="var(--line)" stroke-width="${R - r}"/><text x="${C}" y="${C + 4}" text-anchor="middle" style="font-size:13px">No spending yet</text></svg>`;
  let ang = -Math.PI / 2, out = '';
  SPEND.forEach(c => {
    const v = a.cats[c]; if (v <= 0) return;
    const sweep = v / total * Math.PI * 2; const a2 = ang + sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const p = (rad, ang) => `${C + rad * Math.cos(ang)} ${C + rad * Math.sin(ang)}`;
    const d = sweep >= Math.PI * 2 - 1e-6
      ? `M${p(R, ang)} A${R} ${R} 0 1 1 ${p(R, ang + Math.PI)} A${R} ${R} 0 1 1 ${p(R, ang)} M${p(r, ang)} A${r} ${r} 0 1 0 ${p(r, ang + Math.PI)} A${r} ${r} 0 1 0 ${p(r, ang)}Z`
      : `M${p(R, ang)} A${R} ${R} 0 ${large} 1 ${p(R, a2)} L${p(r, a2)} A${r} ${r} 0 ${large} 0 ${p(r, ang)}Z`;
    out += `<path d="${d}" data-c="${c}" fill="${slotColor(c)}" stroke="var(--surface)" stroke-width="2" data-tip="<b>${CATS[c].name}</b><br>${money(v)} · ${pct(v / total)} of spending"/>`;
    ang = a2;
  });
  return `<svg class="donut" viewBox="0 0 240 240" role="img" aria-label="Spending by category">${out}
    <text x="${C}" y="${C - 4}" text-anchor="middle" style="font-size:22px;font-weight:700;fill:var(--ink)">${money(total)}</text>
    <text x="${C}" y="${C + 16}" text-anchor="middle" style="font-size:11px">living costs</text></svg>`;
}
function barsSVG(months, W) {
  const H = 230, padL = 46, padB = 26, padT = 10, padR = 8;
  const data = months.map(m => { const a = monthAgg(m); return { m, inc: a.income, out: a.spend + a.debt }; });
  const raw = Math.max(...data.map(d => Math.max(d.inc, d.out)), 1);
  const step = niceMax(raw / 4), nt = Math.max(1, Math.ceil(raw / step)), max = step * nt;
  const ih = H - padB - padT, iw = W - padL - padR, gw = iw / data.length;
  const bw = Math.min(26, (gw - 14) / 2);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Income versus spending by month">`;
  for (let k = 0; k <= nt; k++) { const v = step * k, y = padT + ih - ih * k / nt; s += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="${k ? 'var(--line)' : 'var(--base)'}" stroke-width="1"/><text x="${padL - 6}" y="${y + 4}" text-anchor="end">${kfmt(v)}</text>`; }
  const bar = (x, v, col, tipTxt) => { const h = Math.max(0, ih * v / max); const y = padT + ih - h; const rr = Math.min(4, h, bw / 2);
    return `<path d="M${x} ${padT + ih} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + bw - rr} Q${x + bw} ${y} ${x + bw} ${y + rr} V${padT + ih}Z" fill="${col}"/><rect x="${x - 3}" y="${padT}" width="${bw + 6}" height="${ih}" fill="transparent" data-tip="${tipTxt}"/>`; };
  data.forEach((d, i) => {
    const cx = padL + gw * i + gw / 2;
    s += bar(cx - bw - 1, d.inc, 'var(--s1)', `<b>${monthName(d.m, true)}</b><br>Income ${money(d.inc)}<br>Net ${money(d.inc - d.out)} before savings`);
    s += bar(cx + 1, d.out, 'var(--s2)', `<b>${monthName(d.m, true)}</b><br>Spending + debt ${money(d.out)}<br>Net ${money(d.inc - d.out)} before savings`);
    s += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${monthName(d.m)}${d.m === curMonth() ? '*' : ''}</text>`;
  });
  return s + '</svg>';
}
function lineSVG(hist, W, id) {
  const H = 220, padL = 56, padB = 26, padT = 16, padR = 16;
  if (hist.length < 2) return `<div class="empty">Your net worth line starts after your second month in Coinhold.</div>`;
  const vals = hist.map(h => h.nw);
  let lo = Math.min(...vals), hi = Math.max(...vals); if (lo === hi) { lo -= 500; hi += 500; }
  const span = niceMax((hi - lo) / 4); lo = Math.floor(lo / span) * span; hi = Math.ceil(hi / span) * span;
  const ih = H - padT - padB, iw = W - padL - padR;
  const X = i => padL + iw * i / (hist.length - 1), Y = v => padT + ih - (v - lo) / (hi - lo) * ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Net worth by month" data-cross="${id}">`;
  for (let v = lo; v <= hi + 1e-6; v += span) s += `<line x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === lo ? 'var(--base)' : 'var(--line)'}"/><text x="${padL - 6}" y="${Y(v) + 4}" text-anchor="end">${kfmt(v)}</text>`;
  const pts = hist.map((h, i) => `${X(i)},${Y(h.nw)}`).join(' ');
  s += `<defs><linearGradient id="nwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--royal)" stop-opacity=".28"/><stop offset="1" stop-color="var(--royal)" stop-opacity="0"/></linearGradient></defs>`;
  s += `<polygon points="${padL},${padT + ih} ${pts} ${X(hist.length - 1)},${padT + ih}" fill="url(#nwg)"/>`;
  s += `<polyline points="${pts}" fill="none" stroke="var(--royal)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  hist.slice(0, -1).forEach((h, i) => s += `<circle cx="${X(i)}" cy="${Y(h.nw)}" r="3" fill="var(--surface)" stroke="var(--royal)" stroke-width="2"/>`);
  hist.forEach((h, i) => s += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${monthName(h.month)}</text>`);
  const li = hist.length - 1;
  s += `<circle cx="${X(li)}" cy="${Y(hist[li].nw)}" r="5" fill="var(--royal)" stroke="var(--surface)" stroke-width="2"/>`;
  s += `<text x="${X(li) - 8}" y="${Y(hist[li].nw) - 10}" text-anchor="end" style="fill:var(--ink);font-weight:700;font-size:12px">${money(hist[li].nw)}</text>`;
  s += `<line class="xh" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/><circle class="xd" r="4" fill="var(--royal)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>`;
  s += `<rect x="${padL}" y="${padT}" width="${iw}" height="${ih}" fill="transparent" class="hit"/>`;
  s += '</svg>';
  lineMeta[id] = { hist, X, Y, padL, iw, W };
  return s;
}
const lineMeta = {};
function wireLine(id) {
  const svg = document.querySelector(`svg[data-cross="${id}"]`); if (!svg) return;
  const m = lineMeta[id]; const xh = svg.querySelector('.xh'), xd = svg.querySelector('.xd');
  svg.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * m.W;
    const i = Math.max(0, Math.min(m.hist.length - 1, Math.round((x - m.padL) / m.iw * (m.hist.length - 1))));
    const h = m.hist[i]; const px = m.X(i), py = m.Y(h.nw);
    xh.setAttribute('x1', px); xh.setAttribute('x2', px); xh.setAttribute('visibility', 'visible');
    xd.setAttribute('cx', px); xd.setAttribute('cy', py); xd.setAttribute('visibility', 'visible');
    const prev = m.hist[i - 1];
    showTip(`<b>${monthName(h.month, true)}</b><br>Net worth ${money(h.nw)}${prev ? `<br>${h.nw - prev.nw >= 0 ? '+' : '−'}${money(Math.abs(h.nw - prev.nw))} vs prior month` : ''}`, e.clientX, e.clientY);
  });
  svg.addEventListener('pointerleave', () => { xh.setAttribute('visibility', 'hidden'); xd.setAttribute('visibility', 'hidden'); hideTip(); });
}
function budgetRows(m) {
  const a = monthAgg(m);
  const cm = curMonth();
  const frac = m === cm ? Number(todayStr().slice(8)) / daysIn(m) : 1;
  const rows = SPEND.filter(c => S.budgets[c] > 0 || a.cats[c] > 0).map(c => {
    const b = S.budgets[c] || 0, v = a.cats[c];
    const scale = b ? Math.max(b, v) : v || 1;
    let st;
    if (!b) st = `<span class="status muted">No budget set</span>`;
    else if (v > b) st = `<span class="status down">${ICON.over} Over by ${money(v - b)}</span>`;
    else if (m === cm && v > b * frac * 1.1) st = `<span class="status">${ICON.warn} Spending fast</span>`;
    else st = `<span class="status up">${ICON.ok} ${money(b - v)} left</span>`;
    const fill = b && v > b ? b / scale : v / scale;
    const initials = CATS[c].name.split(/[\s&]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2);
    return `<div class="upk"><span class="ic" style="background:color-mix(in srgb, ${slotColor(c)} 20%, var(--surface));box-shadow:inset 0 0 0 2px ${slotColor(c)}" aria-hidden="true">${initials}</span>
      <div class="ln"><b>${CATS[c].name}</b><span class="amt">${money(v)}${b ? ` of ${money(b)}` : ''}</span>${st}</div>
      <div class="track" data-tip="<b>${CATS[c].name}</b><br>${money(v)} spent${b ? ` of ${money(b)}` : ''}${m === cm && b ? `<br>On-pace amount today: ${money(b * frac)}` : ''}">
        <i style="width:${fill * 100}%;background:${slotColor(c)}"></i>${b && v > b ? `<span class="over" style="left:${b / scale * 100}%"></span>` : ''}${b && m === cm && v <= b ? `<span class="pace" style="left:${frac * 100}%" title="Where you should be today"></span>` : ''}</div></div>`;
  });
  return rows.join('') || '<div class="empty">No spending or budgets for this month yet.</div>';
}
let mapMonth = null;
function renderMap() {
  const months = monthsWithData();
  if (!mapMonth || !months.includes(mapMonth)) mapMonth = curMonth();
  const a = monthAgg(mapMonth);
  const cats = SPEND.filter(c => a.cats[c] > 0);
  const last6 = months.slice(-6);
  $('#view').innerHTML = `<div class="grid">
    <section class="panel span2"><div class="panel-head"><h2>Where your money goes</h2>
      <span class="right"><label class="small muted" for="mm">Month</label><select id="mm">${months.map(m => `<option value="${m}" ${m === mapMonth ? 'selected' : ''}>${monthName(m, true)}</option>`).join('')}</select></span></div>
      <div class="donut-wrap"><div class="chart" style="max-width:240px">${donutSVG(a)}</div>
      <div class="catlist">${cats.map(c => `<div class="row" data-c="${c}"><i style="background:${slotColor(c)}"></i><span>${CATS[c].name}</span><b>${money(a.cats[c])}</b><span class="pct">${pct(a.cats[c] / a.spend)}</span><span class="share"><span style="width:${a.cats[c] / Math.max(...cats.map(x => a.cats[x])) * 100}%;background:${slotColor(c)}"></span></span></div>`).join('') || '<p class="muted">Nothing logged this month.</p>'}
      ${a.debt || a.save ? `<p class="small muted" style="margin-top:6px">Not counted above: ${money(a.debt)} to debt dragons and ${money(a.save)} into savings.</p>` : ''}</div></div>
      <details><summary>Show as table</summary><div class="scroll"><table><thead><tr><th>Category</th><th class="num">Spent</th><th class="num">Budget</th><th class="num">Share</th></tr></thead><tbody>
      ${SPEND.map(c => `<tr><td>${CATS[c].name}</td><td class="num">${money(a.cats[c], 2)}</td><td class="num">${S.budgets[c] ? money(S.budgets[c]) : '—'}</td><td class="num">${a.spend ? pct(a.cats[c] / a.spend) : '—'}</td></tr>`).join('')}
      </tbody></table></div></details></section>
    <section class="panel span2"><div class="panel-head"><h2>Budgets</h2><span class="muted small">${mapMonth === curMonth() ? 'The small line shows where you should be by today.' : monthName(mapMonth, true)}</span><span class="right"><a class="small" href="#ledger">Edit budgets</a></span></div>
      <div>${budgetRows(mapMonth)}</div></section>
    <section class="panel"><div class="panel-head"><h2>Income vs spending</h2></div>
      <div class="legend"><span><i style="background:var(--s1)"></i>Income</span><span><i style="background:var(--s2)"></i>Spending + debt payments</span></div>
      <div class="chart" id="bars"></div><div class="nets" id="nets"></div><p class="note">The row under the bars is what was left each month after spending and debt. * This month so far.</p>
      <details><summary>Show as table</summary><div class="scroll"><table><thead><tr><th>Month</th><th class="num">Income</th><th class="num">Spending</th><th class="num">Debt</th><th class="num">Saved</th></tr></thead><tbody>
      ${last6.map(m => { const x = monthAgg(m); return `<tr><td>${monthName(m, true)}</td><td class="num">${money(x.income)}</td><td class="num">${money(x.spend)}</td><td class="num">${money(x.debt)}</td><td class="num">${money(x.save)}</td></tr>`; }).join('')}
      </tbody></table></div></details></section>
    <section class="panel"><div class="panel-head"><h2>Kingdom value</h2></div>${(() => { const h = S.history.slice(-12); if (h.length < 2) return ''; const d = h[h.length - 1].nw - h[0].nw; return `<div><span class="bignum ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : '−'}${money(Math.abs(d))}</span> <span class="muted small">since ${monthName(h[0].month, true)}</span></div>`; })()}<p class="small muted">Net worth: savings and investments minus debts, at each month’s end.</p>
      <div class="chart" id="nwline"></div></section>
  </div>`;
  $('#mm').onchange = e => { mapMonth = e.target.value; renderMap(); };
  const dn = document.querySelector('.donut'), wrap = document.querySelector('.donut-wrap');
  const hl = c => { if (!dn) return; dn.classList.toggle('dim', !!c); wrap.querySelectorAll('[data-c]').forEach(el => el.classList.toggle('on', el.dataset.c === c)); };
  if (wrap) { wrap.addEventListener('pointerover', e => { const el = e.target.closest('[data-c]'); hl(el ? el.dataset.c : null); }); wrap.addEventListener('pointerleave', () => hl(null)); }
  drawMapCharts(last6);
}
function drawMapCharts(last6) {
  const b = $('#bars'), l = $('#nwline'); if (!b) return;
  const ms6 = last6 || monthsWithData().slice(-6);
  const W = Math.max(300, b.clientWidth);
  b.innerHTML = barsSVG(ms6, W);
  const nets = $('#nets'); if (nets) { const r = b.clientWidth / W || 1; nets.style.paddingLeft = (46 * r) + 'px'; nets.style.paddingRight = (8 * r) + 'px';
    nets.style.gridTemplateColumns = `repeat(${ms6.length}, minmax(0,1fr))`;
    nets.innerHTML = ms6.map(m => { const x = monthAgg(m), n = x.income - x.spend - x.debt; return `<span class="${n >= 0 ? 'up' : 'down'}">${n >= 0 ? '+' : '−'}${kfmt(Math.abs(n))}</span>`; }).join(''); }
  l.innerHTML = lineSVG(S.history.slice(-12), Math.max(300, l.clientWidth), 'nw');
  wireLine('nw');
}

/* ---------- quests view ---------- */
function trophySVG(locked) { if (!locked) return `<svg viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset=".5" stop-color="#f2b632"/><stop offset="1" stop-color="#b8830c"/></linearGradient></defs>
  <path d="M12 9H7a5 5 0 0 0 6 7M28 9h5a5 5 0 0 1-6 7" stroke="#d99a14" stroke-width="2.2" fill="none"/><path d="M11 5h18v9a9 9 0 0 1-18 0Z" fill="url(#tg)"/><path d="M15 7v7a5 5 0 0 0 2 4" stroke="#fff" stroke-width="1.6" opacity=".7" fill="none" stroke-linecap="round"/>
  <path d="M20 9l1.4 2.8 3 .4-2.2 2.1.5 3-2.7-1.4-2.7 1.4.5-3-2.2-2.1 3-.4Z" fill="#fff6d6"/><rect x="18" y="22" width="4" height="6" fill="#c98f12"/><rect x="12" y="28" width="16" height="6" rx="2" fill="var(--royal)"/></svg>`;
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 6h16v8a8 8 0 0 1-16 0Z" fill="${locked ? 'var(--base)' : 'var(--gold-fill)'}"/><path d="M12 9H7a5 5 0 0 0 6 7M28 9h5a5 5 0 0 1-6 7" stroke="${locked ? 'var(--base)' : 'var(--gold-fill)'}" stroke-width="2" fill="none"/><rect x="18" y="21" width="4" height="7" fill="${locked ? 'var(--base)' : 'var(--gold)'}"/><rect x="13" y="28" width="14" height="5" rx="1.5" fill="${locked ? 'var(--base)' : 'var(--gold)'}"/></svg>`; }
function renderQuests() {
  const qs = questList();
  const active = qs.filter(q => !S.claimed[q.id]).sort((a, b) => (questReady(b) - questReady(a)) || (b.value / b.target - a.value / a.target));
  const all = questDefsForTrophies();
  $('#view').innerHTML = `<div class="wrap" style="gap:16px">
    <section class="panel"><div class="panel-head"><h2>Active quests</h2><span class="muted small">Finish a quest, then claim its XP. Monthly quests reset on the 1st.</span></div>
    <div class="quests">${active.map(q => {
      const p = Math.max(0, Math.min(1, q.value / q.target)), ready = questReady(q);
      return `<div class="quest ${ready ? 'ready' : ''}"><div class="qtop"><span class="tag">${esc(q.kind)}</span><span class="xp">+${q.xp} XP</span></div>
        <h3>${esc(q.name)}</h3><p class="small muted">${esc(q.desc)}</p>
        <div class="qbar" role="progressbar" aria-label="${esc(q.name)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}"><i style="width:${p * 100}%"></i></div>
        <div class="qtop small"><span>${q.fmt(q.value, q.target)}</span><span class="muted">${q.hint && !ready ? esc(q.hint) : ''}</span></div>
        ${ready ? `<button class="btn gold" data-claim="${q.id}">Claim ${q.xp} XP</button>` : ''}</div>`;
    }).join('') || '<div class="empty">Every quest is done. New monthly quests arrive on the 1st.</div>'}</div></section>
    ${subsPanel()}
    <section class="panel"><div class="panel-head"><h2>Trophy hall</h2><span class="muted small">${Object.keys(S.claimed).length} earned</span></div>
    <div class="trophies">${all.map(t => `<div class="trophy ${t.got ? '' : 'locked'}">${trophySVG(!t.got)}<b>${esc(t.name)}</b><span class="muted small">${t.got ? 'Earned ' + new Date(t.got + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : esc(t.how)}</span></div>`).join('')}</div></section>
  </div>`;
}
function questDefsForTrophies() {
  const base = [
    ['logger_first', 'Opened the Ledger', 'Start your kingdom'], ['walls1', 'Castle Walls I', '1 month emergency fund'], ['walls2', 'Castle Walls II', '3 months emergency fund'],
    ['walls3', 'Castle Walls III', '6 months emergency fund'], ['slay1', 'First Blood', 'Pay off a debt'], ['extra500', 'Sharpened Blade', '$500 extra to debt'],
    ['subs', 'Royal Audit', 'Review subscriptions'], ['streak4', 'Faithful Steward', '4-week streak'], ['streak12', 'Season of Discipline', '12-week streak'],
    ['logger', 'Royal Scribe', 'Log 25 transactions'], ['invest1', 'Plant the Orchard', 'First investment']
  ].map(([id, name, how]) => ({ name, how, got: S.claimed[id] }));
  const monthly = Object.keys(S.claimed).filter(k => /-\d{4}-\d{2}$/.test(k)).map(k => {
    const m = k.slice(-7), kind = k.slice(0, -8);
    const nm = { nospend: 'Quiet Purse', save20: 'Pay Your Future Self', upkeep: 'Steady Upkeep' }[kind] || kind;
    return { name: `${nm} · ${monthName(m)}`, how: '', got: S.claimed[k] };
  });
  return [...base.filter(b => b.got), ...monthly, ...base.filter(b => !b.got)];
}
function subsPanel() {
  const subs = detectSubs(); if (!subs.length) return '';
  const total = subs.filter(s => s.status !== 'cancelled').reduce((x, s) => x + s.monthly, 0);
  const saved = subs.filter(s => s.status === 'cancelled').reduce((x, s) => x + s.monthly, 0);
  return `<section class="panel"><div class="panel-head"><h2>Royal Audit: subscriptions</h2><span class="muted small">Charges that repeat every month. Keep the ones you use; cut the rest.</span></div>
    <div class="scroll"><table><thead><tr><th>Charge</th><th class="num">Monthly</th><th class="num">Yearly</th><th>Decision</th></tr></thead><tbody>
    ${subs.map(s => `<tr><td>${esc(s.name)}</td><td class="num">${money(s.monthly, 2)}</td><td class="num">${money(s.monthly * 12)}</td>
      <td><div class="row" style="display:flex;gap:6px;flex-wrap:wrap">${s.status === 'unreviewed'
        ? `<button class="btn sm" data-sub="${esc(s.name)}" data-v="keep">Keep</button><button class="btn sm danger" data-sub="${esc(s.name)}" data-v="cancelled">Cancel it</button>`
        : `<span class="status ${s.status === 'cancelled' ? 'up' : ''}">${s.status === 'cancelled' ? ICON.ok + ' Cancelled' : 'Kept'}</span> <button class="linkbtn small" data-sub="${esc(s.name)}" data-v="">Undo</button>`}</div></td></tr>`).join('')}
    </tbody></table></div>
    <p class="small">Still paying <b>${money(total, 2)}</b> a month (${money(total * 12)} a year).${saved ? ` You freed up <b class="up">${money(saved * 12)}</b> a year by cutting.` : ''} Marking a charge cancelled here doesn’t cancel it with the company, so do that too.</p></section>`;
}

/* ---------- advisor ---------- */
function simulate(debts, extra, mode) {
  const ds = debts.filter(d => d.balance > 0).map(d => ({ name: d.name, apr: d.apr, min: d.min, bal: d.balance, done: false }));
  let month = 0, interest = 0; const order = [];
  while (ds.some(d => !d.done) && month < 600) {
    month++;
    let pool = extra;
    ds.forEach(d => { if (d.done) { pool += d.min; return; } const i = d.bal * d.apr / 1200; d.bal += i; interest += i; const p = Math.min(d.min, d.bal); d.bal -= p; pool += d.min - p; });
    const live = ds.filter(d => !d.done && d.bal > 0.005).sort(mode === 'avalanche' ? (a, b) => b.apr - a.apr || a.bal - b.bal : (a, b) => a.bal - b.bal);
    for (const d of live) { if (pool <= 0) break; const p = Math.min(pool, d.bal); d.bal -= p; pool -= p; }
    ds.forEach(d => { if (!d.done && d.bal <= 0.005) { d.done = true; order.push({ name: d.name, month }); } });
  }
  return { months: month, interest, order, capped: ds.some(d => !d.done) };
}
const yrs = m => m >= 12 ? `${Math.floor(m / 12)} yr${m >= 24 ? 's' : ''}${m % 12 ? ` ${m % 12} mo` : ''}` : `${m} mo`;
function fv(p, c, years, rate = 0.07) { const i = rate / 12, n = years * 12; return p * Math.pow(1 + i, n) + c * (Math.pow(1 + i, n) - 1) / i; }
let advExtra = null, advInvest = null;
function buildMoves() {
  const cm = curMonth(), months = monthsWithData();
  const full = months.filter(m => m < cm).slice(-3);
  const aggs = (full.length ? full : [cm]).map(monthAgg);
  const avg = k => aggs.reduce((s, a) => s + (typeof k === 'function' ? k(a) : a[k]), 0) / aggs.length;
  const avgInc = avg('income'), avgSave = avg('kept');
  const moves = [];
  const hot = S.debts.filter(d => d.balance > 0).sort((a, b) => b.apr - a.apr)[0];
  if (hot && hot.apr >= 10) moves.push({ ic: ICON.sword, title: `Aim every spare dollar at the ${hot.name} dragon`, body: `At ${hot.apr}% it costs you about ${money(hot.balance * hot.apr / 100)} a year in interest. No savings account or typical investment reliably beats that, so paying it down is a guaranteed ${hot.apr}% return.`, impact: hot.balance * hot.apr / 100, unit: 'interest a year' });
  const wm = wallMonths(), ess = essentials();
  if (ess > 0 && wm < 3) {
    const gap = Math.max(0, ess * (wm < 1 ? 1 : 3) - acctTotal('emergency'));
    const perMo = Math.max(50, avg(a => a.save) * 0.6 || 100);
    moves.push({ ic: ICON.wall, title: wm < 1 ? 'Raise your castle walls to one month' : 'Build the walls to three months', body: `Your emergency fund covers ${wm.toFixed(1)} months of essentials (${money(ess)} a month including minimum payments). ${money(gap)} more gets you to ${wm < 1 ? 'one month' : 'three months'}. Without this cushion, a surprise bill usually lands on the credit card.`, impact: gap, unit: 'to reach the goal', neutral: true });
  }
  // biggest discretionary leak
  const disc = DISCRETIONARY.map(c => ({ c, v: avg(a => a.cats[c]) })).sort((a, b) => b.v - a.v)[0];
  if (disc && disc.v > 50) {
    const b = S.budgets[disc.c]; const over = b && disc.v > b;
    moves.push({ ic: ICON.plate, title: `Trim ${CATS[disc.c].name.toLowerCase()} by a quarter`, body: `You average ${money(disc.v)} a month here${over ? `, ${money(disc.v - b)} over your ${money(b)} budget` : ''}. Cutting 25% (cooking twice more a week, one fewer order) frees about ${money(disc.v * .25)} a month for your dragons or walls.`, impact: disc.v * .25 * 12, unit: 'a year' });
  }
  const subs = detectSubs().filter(s => s.status === 'unreviewed');
  if (subs.length) { const t = subs.reduce((s, x) => s + x.monthly, 0); moves.push({ ic: ICON.scissors, title: `Audit ${subs.length} subscriptions`, body: `${subs.map(s => s.name).join(', ')} cost ${money(t, 2)} a month together. Cancelling even the ones you rarely use is the fastest money in this list. Do it on the Quests tab.`, impact: t * 12, unit: 'a year if all cut', link: '#quests' }); }
  if (avgInc > 0 && avgSave / avgInc < 0.2) {
    const gap = avgInc * 0.2 - avgSave;
    moves.push({ ic: ICON.seed, title: 'Pay your future self first', body: `You keep about ${pct(avgSave / avgInc)} of income for savings and extra debt payments; 20% is a strong target. Set an automatic transfer of ${money(gap)} more on payday, before you can spend it.`, impact: gap * 12, unit: 'more kept a year' });
  }
  if ((!hot || hot.apr < 8) && wm >= 3) moves.push({ ic: ICON.chart, title: 'Grow the orchard', body: 'Your walls are solid and no high-interest dragons remain. This is the moment to raise investment deposits; see the growth forecast below.', impact: 0, unit: '', neutral: true });
  return moves.sort((a, b) => (b.neutral ? 0 : b.impact) - (a.neutral ? 0 : a.impact));
}
function renderAdvisor() {
  const moves = buildMoves();
  const live = S.debts.filter(d => d.balance > 0);
  if (advExtra === null) advExtra = 150;
  const cm = curMonth();
  const avgInvest = (() => { const ms = monthsWithData().filter(m => m < cm).slice(-3); if (!ms.length) return 100; return Math.round(ms.reduce((s, m) => s + S.txns.filter(t => monthOf(t.date) === m && t.cat === 'save' && /broker|invest/i.test(t.desc)).reduce((x, t) => x - t.amount, 0), 0) / ms.length) || 100; })();
  if (advInvest === null) advInvest = avgInvest;
  $('#view').innerHTML = `<div class="wrap" style="gap:16px">
    <section class="panel"><div class="panel-head"><h2>Your battle plan</h2><span class="muted small">The moves that matter most for your numbers, biggest payoff first.</span></div>
      <div class="moves">${moves.map(m => `<div class="move"><div class="ic">${m.ic}</div><div><h3 style="font-family:var(--f-body);font-weight:700;letter-spacing:0">${esc(m.title)}</h3><p class="small" style="color:var(--ink2)">${esc(m.body)}</p></div>
        <div class="impact" ${m.neutral ? 'style="color:var(--ink)"' : ''}>${m.impact ? money(m.impact) : ''}<small>${esc(m.unit)}</small></div></div>`).join('') || '<div class="empty">Add some transactions and accounts, and your advisor will have a plan for you.</div>'}</div></section>
    <section class="panel"><div class="panel-head"><h2>Dragon battle simulator</h2><span class="muted small">How fast you go debt-free if you add extra each month on top of minimums.</span></div>
      ${live.length ? `<div class="slider"><label for="extra">Extra per month</label><input id="extra" type="range" min="0" max="1500" step="25" value="${advExtra}"><output id="extraOut">${money(advExtra)}</output></div><div id="simOut"></div>`
        : '<div class="empty">No live debts. Add one in the Ledger to plan its defeat.</div>'}</section>
    <section class="panel"><div class="panel-head"><h2>Orchard growth forecast</h2><span class="muted small">What steady investing could become.</span></div>
      <div class="slider"><label for="inv">Invest per month</label><input id="inv" type="range" min="0" max="2000" step="25" value="${advInvest}"><output id="invOut">${money(advInvest)}</output></div>
      <div id="growOut"></div>
      <p class="note">Assumes 7% a year, roughly the long-run stock market average after inflation. Real returns swing year to year and aren’t guaranteed.</p></section>
  </div>`;
  const ex = $('#extra'); if (ex) { ex.oninput = () => { advExtra = Number(ex.value); $('#extraOut').textContent = money(advExtra); drawSim(); }; drawSim(); }
  const iv = $('#inv'); iv.oninput = () => { advInvest = Number(iv.value); $('#invOut').textContent = money(advInvest); drawGrow(); }; drawGrow();
}
function drawSim() {
  const base = simulate(S.debts, 0, 'avalanche'), av = simulate(S.debts, advExtra, 'avalanche'), sn = simulate(S.debts, advExtra, 'snowball');
  const best = av.interest <= sn.interest ? 'av' : 'sn';
  const card = (key, name, r, desc) => `<div class="${best === key ? 'best' : ''}"><span class="label">${name}</span><span class="big">${r.capped ? 'Never' : yrs(r.months)}</span>
    <span class="small">${money(r.interest)} total interest</span><span class="small muted">${desc}</span>
    ${r.order.length ? `<span class="small">Slays: ${r.order.map(o => `${esc(o.name)} (${yrs(o.month)})`).join(' → ')}</span>` : ''}</div>`;
  const diff = Math.abs(av.interest - sn.interest);
  $('#simOut').innerHTML = `<div class="compare">
    ${card('base', 'Minimums only', base, 'What happens if nothing changes.')}
    ${card('av', 'Avalanche', av, 'Extra goes to the highest interest rate first.')}
    ${card('sn', 'Snowball', sn, 'Extra goes to the smallest balance first.')}</div>
    <p class="small">${base.capped ? 'At minimums only, at least one debt never gets paid off: its minimum doesn’t cover its interest. ' : `Adding ${money(advExtra)} a month saves you <b class="up">${money(base.interest - Math.min(av.interest, sn.interest))}</b> in interest and ${yrs(Math.max(0, base.months - Math.min(av.months, sn.months)))} of payments. `}
    ${diff < 100 ? 'Avalanche and snowball are nearly tied for you, so pick snowball if quick wins keep you motivated.' : `Avalanche saves ${money(diff)} more than snowball. Snowball gets your first kill sooner if motivation matters more.`}</p>`;
}
function drawGrow() {
  const p = acctTotal('invest');
  const rows = [5, 10, 20, 30].map(y => ({ y, total: fv(p, advInvest, y), put: p + advInvest * 12 * y }));
  const max = rows[rows.length - 1].total || 1;
  $('#growOut').innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">${rows.map(r => `<div class="bud" style="grid-template-columns:70px minmax(0,1fr) 150px">
    <span>${r.y} years</span><div class="bar" data-tip="<b>In ${r.y} years</b><br>You put in ${money(r.put)}<br>Growth adds ${money(r.total - r.put)}"><i style="width:${r.put / max * 100}%;background:var(--s1)"></i><i style="left:${r.put / max * 100}%;width:${(r.total - r.put) / max * 100}%;background:var(--s3);border-radius:0 4px 4px 0"></i></div>
    <b style="justify-self:end">${money(r.total)}</b></div>`).join('')}</div>
    <div class="legend"><span><i style="background:var(--s1)"></i>What you put in (including today’s ${money(p)})</span><span><i style="background:var(--s3)"></i>Growth</span></div>`;
}

/* ---------- ledger ---------- */
const AUTO = [
  [/rent|mortgage|electric|water|internet|phone|utility|gas bill|insurance home/i, 'home'], [/grocer|market|mart|aldi|kroger|safeway|whole foods|trader|costco|basket/i, 'groceries'],
  [/restaurant|cafe|coffee|starbucks|pizz|burger|taco|sushi|doordash|uber eats|grubhub|bar\b|pho\b|diner|bistro|grill|kitchen|bakery|mcdonald|chipotle|wendy|subway\b|kfc|domino/i, 'dining'],
  [/gas station|shell|chevron|exxon|bp\b|uber|lyft|parking|transit|car insurance|toll/i, 'transport'],
  [/netflix|spotify|hulu|disney|prime|stream|gym|membership|cloud|icloud|youtube|subscription|patreon/i, 'subs'],
  [/amazon|target|walmart|store|shop|online order|best buy|ikea/i, 'shopping'], [/movie|concert|ticket|steam|game|bowling|bar /i, 'fun'],
  [/pharmacy|doctor|dental|clinic|cvs|walgreens|haircut/i, 'health'], [/loan|credit card payment|card payment|student/i, 'debt'],
  [/transfer to sav|savings|brokerage|invest|401k|ira\b|vanguard|fidelity/i, 'save'], [/payroll|paycheck|salary|direct dep|deposit from/i, 'income']
];
function guessCat(desc, amount) { for (const [re, c] of AUTO) if (re.test(desc)) { if (c === 'income' && amount < 0) continue; return c; } return amount > 0 ? 'income' : 'health'; }
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
function normDate(s) {
  s = s.trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${pad(m[1])}-${pad(m[2])}`; }
  const d = new Date(s); return isNaN(d) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function importCSV(text) {
  if (text.length > 2e6) return { ok: 0, bad: 0, tooBig: true };
  const rows = parseCSV(text).slice(0, 5001); if (!rows.length) return { ok: 0, bad: 0 };
  const head = rows[0].map(h => h.trim().toLowerCase());
  const hasHead = head.some(h => /date|desc|amount|debit|credit|memo|name|payee/.test(h));
  const idx = (re, dflt) => { const i = head.findIndex(h => re.test(h)); return hasHead && i >= 0 ? i : dflt; };
  const iD = idx(/date/, 0), iS = idx(/desc|memo|name|payee|merchant/, 1), iA = idx(/^amount|amount/, 2), iDeb = hasHead ? head.findIndex(h => /debit|withdraw/.test(h)) : -1, iCred = hasHead ? head.findIndex(h => /credit|deposit/.test(h)) : -1;
  let ok = 0, bad = 0;
  for (const r of rows.slice(hasHead ? 1 : 0)) {
    const date = normDate(r[iD] || ''); const desc = (r[iS] || '').trim() || 'Imported';
    let amt;
    if (iDeb >= 0 || iCred >= 0) { const deb = parseFloat((r[iDeb] || '').replace(/[$,\s]/g, '')) || 0, cr = parseFloat((r[iCred] || '').replace(/[$,\s]/g, '')) || 0; amt = cr - Math.abs(deb); }
    else { const raw = (r[iA] || '').replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1'); amt = parseFloat(raw); }
    if (!date || !isFinite(amt) || amt === 0) { bad++; continue; }
    addTxn({ date, desc, amount: amt, cat: guessCat(desc, amt) }, true); ok++;
  }
  return { ok, bad };
}
let ledgerMonth = null;
function renderLedger() {
  const months = monthsWithData();
  if (!ledgerMonth || !months.includes(ledgerMonth)) ledgerMonth = curMonth();
  const list = S.txns.filter(t => monthOf(t.date) === ledgerMonth).sort((a, b) => b.date.localeCompare(a.date));
  const catOpts = sel => Object.keys(CATS).map(c => `<option value="${c}" ${c === sel ? 'selected' : ''}>${CATS[c].name}</option>`).join('');
  $('#view').innerHTML = `<div class="grid">
    <section class="panel"><div class="panel-head"><h2>Log a transaction</h2><span class="muted small">+2 XP each</span></div>
      <form id="txform" class="form">
        <label class="field"><span>Date</span><input id="tx-date" type="date" value="${todayStr()}" required></label>
        <label class="field"><span>Description</span><input id="tx-desc" type="text" maxlength="80" placeholder="e.g. FreshMart" required></label>
        <label class="field"><span>Amount</span><input id="tx-amt" type="number" step="any" min="0.01" placeholder="0.00" required></label>
        <label class="field"><span>Type</span><select id="tx-type"><option value="out">Money out</option><option value="in">Money in</option></select></label>
        <label class="field"><span>Category</span><select id="tx-cat"><option value="auto">Guess for me</option>${catOpts('')}</select></label>
        <button class="btn primary">Add</button>
      </form></section>
    <section class="panel"><div class="panel-head"><h2>Import from your bank</h2><span class="muted small">CSV with date, description, amount</span></div>
      <label class="field"><span>Choose a CSV file</span><input id="csvfile" type="file" accept=".csv,text/csv"></label>
      <label class="field"><span>Or paste CSV text</span><textarea id="csvtext" placeholder="Date,Description,Amount&#10;2026-11-02,FreshMart,-84.20&#10;2026-11-03,Paycheck,2100"></textarea></label>
      <div class="row" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" id="csvgo">Import</button><span class="small muted" id="csvmsg">Categories are guessed from the description; fix any below.</span></div></section>
    <section class="panel span2"><div class="panel-head"><h2>Transactions</h2><span class="right"><label class="small muted" for="lm">Month</label><select id="lm">${months.map(m => `<option value="${m}" ${m === ledgerMonth ? 'selected' : ''}>${monthName(m, true)}</option>`).join('')}</select></span></div>
      ${list.length ? `<div class="scroll"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th></th></tr></thead><tbody>
      ${list.map(t => `<tr><td>${t.date.slice(5)}</td><td>${esc(t.desc)}</td><td><select data-cat="${t.id}" aria-label="Category for ${esc(t.desc)}">${catOpts(t.cat)}</select></td><td class="num ${t.amount > 0 ? 'up' : ''}">${money(t.amount, 2)}</td><td><button class="linkbtn small" data-del="${t.id}" aria-label="Delete ${esc(t.desc)}">Delete</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No transactions this month. Log one above or import a CSV.</div>'}</section>
    <section class="panel"><div class="panel-head"><h2>Monthly budgets</h2><span class="muted small">Your upkeep limits</span></div>
      <form id="budform" class="form" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">${SPEND.map(c => `<label class="field"><span>${CATS[c].name}</span><input id="bud-${c}" type="number" min="0" step="any" value="${S.budgets[c] || ''}" placeholder="0"></label>`).join('')}
      <button class="btn primary">Save budgets</button></form></section>
    <section class="panel"><div class="panel-head"><h2>Accounts and debts</h2><span class="muted small">Update balances whenever you like</span></div>
      <div class="scroll"><table><thead><tr><th>Savings & investments</th><th>Type</th><th class="num">Balance</th><th></th></tr></thead><tbody>
      ${S.accounts.map(a => `<tr><td><input type="text" maxlength="80" id="an-${a.id}" value="${esc(a.name)}" aria-label="Account name"></td><td><select id="ak-${a.id}" aria-label="Account type"><option value="emergency" ${a.kind === 'emergency' ? 'selected' : ''}>Emergency fund</option><option value="invest" ${a.kind === 'invest' ? 'selected' : ''}>Investment</option></select></td><td class="num"><input type="number" id="ab-${a.id}" value="${a.balance}" step="any" style="width:110px" aria-label="Balance"></td><td><button class="linkbtn small" data-delacct="${a.id}">Remove</button></td></tr>`).join('')}
      </tbody></table></div><button class="btn sm" id="addacct" style="align-self:flex-start">Add account</button>
      <div class="scroll"><table><thead><tr><th>Debt</th><th class="num">Balance</th><th class="num">APR %</th><th class="num">Min / mo</th><th></th></tr></thead><tbody>
      ${S.debts.map(d => `<tr><td><input type="text" maxlength="80" id="dn-${d.id}" value="${esc(d.name)}" aria-label="Debt name"></td><td class="num"><input type="number" id="db-${d.id}" value="${d.balance}" step="any" style="width:100px" aria-label="Balance"></td><td class="num"><input type="number" id="da-${d.id}" value="${d.apr}" step="any" style="width:70px" aria-label="APR"></td><td class="num"><input type="number" id="dm-${d.id}" value="${d.min}" step="any" style="width:80px" aria-label="Minimum payment"></td><td><button class="linkbtn small" data-deldebt="${d.id}">Remove</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No debts. Lucky you.</td></tr>'}
      </tbody></table></div>
      <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="adddebt">Add debt</button><button class="btn primary sm" id="saveaccts">Save accounts and debts</button></div></section>
    ${securityPanel()}
    <section class="panel span2"><div class="panel-head"><h2>Backup and reset</h2><span class="muted small">Your kingdom lives only in this browser</span></div>
      <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="backup">Copy backup code</button><button class="btn" id="restore">Restore from backup</button><button class="btn" id="loadsample">Load example kingdom</button><button class="btn danger" id="wipe">Erase and start fresh</button></div></section>
  </div>`;
  $('#lm').onchange = e => { ledgerMonth = e.target.value; renderLedger(); };
}
function saveAccounts() {
  const val = id => { const el = document.getElementById(id); return el ? el.value : null; };
  S.accounts.forEach(a => { if (val('an-' + a.id) === null) return; a.name = cleanText(val('an-' + a.id), a.name); a.kind = val('ak-' + a.id) === 'invest' ? 'invest' : 'emergency'; a.balance = round2(clampNum(val('ab-' + a.id), -MAX_AMT, MAX_AMT)); });
  S.debts.forEach(d => {
    if (val('dn-' + d.id) === null) return;
    d.name = cleanText(val('dn-' + d.id), d.name); const nb = round2(clampNum(val('db-' + d.id), 0, MAX_AMT));
    d.balance = nb; d.start = Math.max(d.start || 0, nb); d.apr = clampNum(val('da-' + d.id), 0, 100); d.min = clampNum(val('dm-' + d.id), 0, MAX_AMT);
  });
  aggCache.clear();
}

/* ---------- lock screen ---------- */
function renderLock() {
  $('#rank').innerHTML = ''; $('#banner').innerHTML = '';
  document.querySelector('nav.tabs').hidden = true;
  $('#view').innerHTML = `<section class="panel lock"><svg class="crest" viewBox="0 0 40 40" aria-hidden="true" style="width:64px;height:64px"><path d="M20 2 L36 8 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V8 Z" fill="var(--royal)"/><rect x="13" y="18" width="14" height="11" rx="2" fill="var(--gold-fill)"/><path d="M15.5 18v-3a4.5 4.5 0 0 1 9 0v3" stroke="var(--gold-fill)" stroke-width="2.4" fill="none"/></svg>
    <h2>Your kingdom is locked</h2><p class="muted">Enter your PIN to open the gates.</p>
    <form id="unlockform" class="lockform"><label for="pin-in" class="label">PIN</label><input id="pin-in" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" required>
    <button class="btn primary big">Unlock</button></form><p class="small" id="unlockmsg" role="alert"></p>
    <p class="small muted">Forgot it? Your data is encrypted, so it can’t be recovered without the PIN. <button class="linkbtn" id="forgot">Erase and start over</button></p></section>`;
  setTimeout(() => { const i = $('#pin-in'); if (i) i.focus(); }, 0);
}
function securityPanel() {
  if (!hasCrypto) return `<section class="panel span2"><div class="panel-head"><h2>PIN lock</h2></div><p class="muted">This browser can’t encrypt data, so the PIN lock is unavailable here.</p></section>`;
  return `<section class="panel span2"><div class="panel-head"><h2>PIN lock</h2><span class="muted small">${cryptoKey ? 'On: your data is encrypted on this device' : 'Off: anyone using this browser can open Coinhold'}</span></div>
    ${cryptoKey ? `<div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="locknow">Lock now</button><button class="btn" id="pinoff">Turn off PIN</button></div><p class="small muted">Coinhold locks itself after 5 minutes without use.</p>`
      : `<form id="pinform" class="form"><label class="field"><span>New PIN (6 to 12 digits)</span><input id="pin-new" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,12}" maxlength="12" required></label>
      <label class="field"><span>Type it again</span><input id="pin-new2" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,12}" maxlength="12" required></label><button class="btn primary">Turn on PIN lock</button></form>
      <p class="small muted" id="pinmsg">Your numbers get encrypted with AES-256 using a key made from your PIN. Without the PIN, nobody (including us) can read them.</p>`}</section>`;
}

/* ---------- router ---------- */
const VIEWS = { kingdom: renderKingdom, 'money-map': renderMap, quests: renderQuests, advisor: renderAdvisor, ledger: renderLedger };
function current() { const h = location.hash.slice(1); return VIEWS[h] ? h : 'kingdom'; }
function render() {
  if (!S) return renderLock();
  document.querySelector('nav.tabs').hidden = false;
  aggCache.clear();
  renderHeader();
  const v = current();
  document.querySelectorAll('nav.tabs a').forEach(a => { if (a.getAttribute('href') === '#' + v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const rc = readyCount(); $('#questtab').textContent = rc ? `Quests (${rc})` : 'Quests';
  VIEWS[v]();
}
addEventListener('hashchange', () => { render(); scrollTo({ top: 0 }); });
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (current() === 'money-map') drawMapCharts(); }, 150); });

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-goto]'); if (!t) return;
  if (t.hasAttribute('data-close')) { closeModal(); return; }
  if (!S && t.id !== 'forgot' && t.id !== 'okbtn') return;
  if (t.id === 'checkin') return checkIn(t);
  if (t.id === 'locknow') return lockNow();
  if (t.id === 'pinoff') return confirmBox('Turn off the PIN lock?', 'Your data will be stored unencrypted in this browser.', 'Turn off', () => removePin().then(() => { render(); toast('PIN lock is off.'); }));
  if (t.id === 'forgot') return confirmBox('Erase everything?', 'Without the PIN the data can\u2019t be opened. This deletes it and starts a new, empty kingdom.', 'Erase', () => { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '.fails'); } catch {} lockedBlob = null; S = emptyState(); save(); location.hash = '#kingdom'; render(); });
  if (t.id === 'fresh' || t.id === 'wipe') return confirmBox('Start your own kingdom?', 'This erases everything in Coinhold on this browser, including the example data, and gives you an empty kingdom.', 'Erase and start', () => { S = emptyState(); S.claimed.logger_first = todayStr(); save(); location.hash = '#kingdom'; render(); toast('Your kingdom is founded. Head to the Ledger to add your money.'); });
  if (t.id === 'loadsample') return confirmBox('Load the example kingdom?', 'This replaces your current data with sample numbers.', 'Load example', () => { S = sampleState(); save(); render(); });
  if (t.dataset.goto) { location.hash = '#kingdom'; const el = document.getElementById(t.dataset.goto); if (el) { el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); el.animate && el.animate([{ boxShadow: '0 0 0 3px var(--gold-fill)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1400 }); } return; }
  if (t.dataset.min) { const d = S.debts.find(x => x.id === t.dataset.min); if (d) attack(d.id, Math.min(d.min, d.balance + d.balance * d.apr / 1200), 'min', t); return; }
  if (t.dataset.attack) { const f = document.querySelector(`[data-attackform="${t.dataset.attack}"]`); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); return; }
  if (t.dataset.dep) { const f = document.querySelector(`[data-depform="${t.dataset.dep}"]`); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); return; }
  if (t.dataset.claim) return claim(t.dataset.claim, t);
  if (t.dataset.sub !== undefined) {
    const v = t.dataset.v, name = t.dataset.sub, was = S.subs[name];
    if (v) S.subs[name] = v; else delete S.subs[name];
    if (v === 'cancelled' && was !== 'cancelled') { const s = detectSubs().find(x => x.name === name); gainXP(40, `for cutting ${name}${s ? ` (${money(s.monthly * 12)} a year)` : ''}`, t); }
    else if (v === 'keep') gainXP(5, 'for reviewing ' + name, t);
    commit(); return;
  }
  if (t.dataset.del) { S.txns = S.txns.filter(x => x.id !== t.dataset.del); commit(); return; }
  if (t.dataset.delacct) { saveAccounts(); S.accounts = S.accounts.filter(x => x.id !== t.dataset.delacct); commit(); return; }
  if (t.dataset.deldebt) { saveAccounts(); S.debts = S.debts.filter(x => x.id !== t.dataset.deldebt); commit(); return; }
  if (t.id === 'addacct') { saveAccounts(); S.accounts.push({ id: uid(), name: 'New account', kind: 'emergency', balance: 0 }); commit(); return; }
  if (t.id === 'adddebt') { saveAccounts(); S.debts.push({ id: uid(), name: 'New debt', balance: 1000, start: 1000, apr: 20, min: 35 }); commit(); toast('Debt added. Set its real balance, rate and minimum, then save.'); return; }
  if (t.id === 'saveaccts') { saveAccounts(); commit(); toast('Accounts and debts saved.'); return; }
  if (t.id === 'csvgo') {
    const txt = $('#csvtext').value.trim(); if (!txt) { $('#csvmsg').textContent = 'Choose a file or paste CSV text first.'; return; }
    const r = importCSV(txt);
    if (r.ok) { gainXP(Math.min(100, r.ok * 2), `for importing ${r.ok} transactions`, t); commit(); toast(`Imported ${r.ok} transactions${r.bad ? `, skipped ${r.bad} rows we couldn’t read` : ''}.`); }
    else if (r.tooBig) $('#csvmsg').textContent = 'That CSV is over 2 MB. Export a shorter date range.';
    else $('#csvmsg').textContent = `No rows imported. Check that the CSV has a date, description and amount column.`;
    return;
  }
  if (t.id === 'backup') {
    const code = JSON.stringify(S);
    const done = () => toast('Backup code copied. Paste it somewhere safe, like a note.');
    try { navigator.clipboard.writeText(code).then(done, () => showBackup(code)); } catch { showBackup(code); }
    return;
  }
  if (t.id === 'restore') {
    modal(`<h2>Restore from backup</h2><label class="field"><span>Paste your backup code</span><textarea id="restoretext"></textarea></label><p class="small muted" id="restoremsg"></p><div class="btns"><button class="btn" data-close>Cancel</button><button class="btn primary" id="restorego">Restore</button></div>`);
    return;
  }
  if (t.id === 'restorego') {
    try { const o = JSON.parse($('#restoretext').value); if (!o || !Array.isArray(o.txns)) throw 0; S = sanitizeState(o); save(); closeModal(); render(); toast('Kingdom restored.'); }
    catch { $('#restoremsg').textContent = 'That code isn’t a Coinhold backup. Copy the whole thing and try again.'; }
  }
});
function showBackup(code) { modal(`<h2>Your backup code</h2><p class="small">Copy all of this text and keep it somewhere safe.</p><textarea id="backuptext" readonly>${esc(code)}</textarea><div class="btns"><button class="btn primary" data-close>Done</button></div>`); const ta = $('#backuptext'); ta.focus(); ta.select(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').innerHTML) closeModal(); });
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'unlockform') {
    const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Checking\u2026';
    const err = await tryUnlock($('#pin-in').value);
    if (err) { btn.disabled = false; btn.textContent = 'Unlock'; $('#unlockmsg').textContent = err; $('#pin-in').value = ''; $('#pin-in').focus(); return; }
    bumpIdle(); render(); toast('Welcome back to your kingdom.'); return;
  }
  if (f.id === 'pinform') {
    const a = $('#pin-new').value, b = $('#pin-new2').value;
    if (!/^[0-9]{6,12}$/.test(a)) { $('#pinmsg').textContent = 'Use 6 to 12 digits.'; return; }
    if (a !== b) { $('#pinmsg').textContent = 'The two PINs don\u2019t match.'; return; }
    f.querySelector('button').disabled = true; await setPin(a); bumpIdle(); render(); toast('PIN lock is on. Your data is encrypted.'); return;
  }
  if (f.id === 'txform') {
    const amt = clampNum(Math.abs(Number($('#tx-amt').value)), 0, MAX_AMT); const desc = $('#tx-desc').value.trim(); if (!amt || !desc) return;
    const sign = $('#tx-type').value === 'in' ? 1 : -1; let cat = $('#tx-cat').value; if (cat === 'auto') cat = guessCat(desc, sign * amt);
    if (sign > 0 && cat !== 'income') cat = 'income';
    const date = $('#tx-date').value || todayStr();
    addTxn({ date, desc, amount: sign * amt, cat }, true); ledgerMonth = monthOf(date);
    gainXP(2, 'for logging ' + desc, f.querySelector('button')); commit(); toast(`Logged ${money(sign * amt, 2)} as ${CATS[cat].name}.`);
    setTimeout(() => { const d = $('#tx-desc'); if (d) d.focus(); }, 0);
    return;
  }
  if (f.id === 'budform') { SPEND.forEach(c => S.budgets[c] = clampNum($('#bud-' + c).value, 0, MAX_AMT)); commit(); toast('Budgets saved. Your upkeep bars now track them.'); return; }
  if (f.dataset.attackform) { const v = clampNum(f.querySelector('input').value, 0, MAX_AMT); if (v > 0) attack(f.dataset.attackform, v, 'extra', f.querySelector('button')); return; }
  if (f.dataset.depform) { const v = clampNum(f.querySelector('input').value, 0, MAX_AMT); if (v > 0) deposit(f.dataset.depform, v, f.querySelector('button')); return; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.cat) { const x = S.txns.find(y => y.id === t.dataset.cat); if (x && Object.hasOwn(CATS, t.value)) { x.cat = t.value; commit(); } return; }
  if (t.id === 'csvfile' && t.files[0]) { if (t.files[0].size > 2e6) { $('#csvmsg').textContent = 'That file is over 2 MB. Export a shorter date range.'; t.value = ''; return; } const rd = new FileReader(); rd.onload = () => { $('#csvtext').value = rd.result; $('#csvmsg').textContent = `${t.files[0].name} loaded. Press Import.`; }; rd.readAsText(t.files[0]); }
});
document.addEventListener('click', e => { if (e.target.classList && e.target.classList.contains('modal-back')) closeModal(); });

if (S) { recordHistory(); save(); }
render();
})();
