# Coinhold

A personal finance game. Your real money becomes a kingdom: debts are dragons with HP bars, your
emergency fund builds the castle walls, investments grow an orchard, and good habits earn XP,
levels, streaks and trophies. Charts show where the money goes; the Advisor ranks the moves that
matter most for your numbers.

Status: working prototype, not yet a product. Lives here (outside `demos/`, so the client-demo
deploy never picks it up) until it moves to its own repository.

## Run it

```bash
node apps/coinhold/tests/serve.js     # http://localhost:8787 with production security headers
```

Or open `apps/coinhold/index.html` from any static host. No build step and no runtime dependencies.

## Layout

```
apps/coinhold/
  index.html          Page shell: strict Content-Security-Policy, fonts, the app's markup
  app.css             All styles. Colour tokens for light and dark mode at the top
  app.js              The whole app (one IIFE, nothing on window)
  _headers            Security headers for Cloudflare Pages / Netlify
  SECURITY.md         Threat model and the controls that answer it
  tests/
    coinhold.test.js  65 end-to-end checks (Playwright + axe-core)
    serve.js          Local server that sends the same headers as _headers
    bundle-single.js  Inlines CSS/JS into dist/coinhold.html for single-file hosts
```

`app.js` sections, top to bottom: constants, input sanitising, storage and encryption, sample
data, derived numbers, quests, actions, feedback (toasts, coins, modals), the five views
(Kingdom, Realm, Money map, Quests, Advisor, Ledger), router and event delegation.

## What's in the game

| Area | Mechanics |
| --- | --- |
| Kingdom | Live castle scene: walls grow at 1/3/6 months of essentials saved, towers with level, orchard with investments, one animated dragon per debt (colour = interest rate, fire at 15%+). |
| Realm | The empire view. A resource bar (gold in, upkeep, tribute to debt, treasury, surplus); trade routes, a flow chart from every income stream to bills, living costs, business costs, debt, savings and what's left; a building per income stream (Guild Hall = job, Market = business with profit and margin, Workshop = side gigs, Gold Mine = investments and rent, Trading Post = other) that levels up with monthly income; regular bills found automatically with due dates and paid status; credit cards with how much of each limit is used; loans with payoff time. |
| Dragons | Pay minimum (+10 XP) or Extra attack (+1 XP per $10). HP bar = balance vs. starting balance. |
| Quests | Castle Walls I-III, First Blood, Sharpened Blade, Royal Audit, monthly Quiet Purse / Pay Your Future Self / Steady Upkeep, streak and habit quests. Claim for XP; trophies in the hall. |
| Check-in | Once a week: XP for showing up, for categories on pace, and a streak bonus. A shield every 4 weeks covers one missed week. |
| Money map | Spending donut + list, budgets with today's pace marker, income vs spending with the monthly net, net worth over time. Every chart has hover detail and a table view. |
| Advisor | Ranked moves with yearly dollar impact, an avalanche vs snowball debt simulator, and a compound growth forecast. |
| Ledger | Manual entry with auto-categorising, bank CSV import, budgets, accounts and debts, PIN lock, backup and restore. |

## Testing

```bash
npm install && npx playwright install chromium   # once
npm run test:coinhold
```

Covers: every view renders; the game loop (attacks, deposits, check-in, quests, subscriptions,
ledger, CSV import, budgets, simulator); security (XSS payloads, prototype pollution through a
backup, CSP blocking inline script and network calls, anti-clickjacking headers, encryption at
rest, PIN lockout); accessibility (axe WCAG 2.1 AA on every view); phone layout in dark mode;
tap-target sizes; speed budgets (tap < 100ms, view switch < 150ms, 3,000-row CSV import < 1.5s).

## Roadmap to a product

1. **Art**: replace the hand-drawn SVG with a commissioned illustration set (see below).
2. **Accounts and sync**: optional sign-in with end-to-end encrypted sync so data moves between devices.
3. **Bank connection**: an aggregator (Plaid, MX, Teller) behind a small server; CSV stays as the free tier.
4. **Mobile**: installable PWA first (offline, home-screen icon), then app stores via Capacitor.
5. **Business**: free tier with manual and CSV entry; paid tier with bank sync, sync across devices and seasons/cosmetics.
6. **Before charging money**: a lawyer's review of the "educational, not advice" wording and the
   privacy policy, plus an external penetration test once there is a server.
