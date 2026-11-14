# Warder Demos

Click-through demos of AI tools for local businesses (today: "Ava", an AI receptionist, one
page per client). Each demo is one self-contained `index.html`: inline CSS and JS, no build
step, no dependencies, no API keys, no network requests. Live on Cloudflare Pages.

## Layout
- `demos/ai-receptionist/<client>/index.html`: one per client. `PRESENTING.md` beside it is
  the walkthrough script for the sales call (only some clients have one yet).
- Every receptionist page carries the **identical engine** below its `CONFIG` object. Only
  `CONFIG` and the `<title>` differ between clients. README.md lists every `CONFIG` option.
- `scripts/build-worker.js` bundles every page into `dist/_worker.js`; `serve.mjs` serves it
  locally; `deploy-cloudflare.sh` deploys. New demo folders are picked up automatically.
- `tests/`: Playwright scripts (scenarios, every button, axe accessibility, performance).

## Rules
- **Privacy between clients:** the root `index.html` never lists demos, and every page keeps
  `<meta name="robots" content="noindex, nofollow">`. Client links go in README.md only.
  This repo is public: no client contact details beyond what they publish themselves.
- Use only details the business publishes itself (number, address, services, area), in its
  own wording. Sample callers use fictional 555-01xx numbers.
- Ava never quotes a price or an arrival time, never gives DIY/safety-risky advice, and says
  she is an AI when asked. The stress test checks these; keep it passing.
- **Engine changes:** the engine is copied into every client page. A fix to it must be made
  in all of them, identically. Change `CONFIG` for client-specific behavior instead.
- Keep pages tiny and dependency-free (budget: ~18KB, ready to tap in ~0.3s on 4G).

## Commands
```bash
npm install                    # test tooling only (Playwright, axe-core)
npm test                       # everything, as CI runs it
node tests/receptionist.test.js 300 demos/ai-receptionist/<client>/index.html
npm run serve                  # build the bundle and serve it locally
```

## New client demo
Copy an existing client folder, edit only `CONFIG` and the title, add the link to README's
table, run its tests, and look at it in a real browser at phone width before calling it done.

## Browser tools
`.mcp.json` adds the Playwright MCP (open, click, screenshot) and Chrome DevTools MCP
(console, network, performance traces) servers. Use them to look at a UI change in a real
browser before calling it done.

## Helpful skills
`make-interfaces-feel-better`, `web-design-guidelines` and `design:ux-copy` for UI and
wording; `audit-as-a11y-eng` for accessibility; small-business `lead-finder`,
`outreach-composer` and `proposal-builder` for the sales side.
