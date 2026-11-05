# Warder Demos

Click-through demos of AI tools for local businesses. Every demo is a single `index.html`
with inline CSS and JS: no build step, no dependencies, no API keys. Open it in a browser,
or host the folder anywhere static (GitHub Pages, Netlify, Cloudflare Pages).

Start at [`index.html`](index.html), the landing page that links every demo.

## Layout

```
index.html                         Landing page (edit the DEMOS list to add a card)
demos/
  ai-receptionist/                 One folder per kind of demo
    PRESENTING.md                  Walkthrough script for showing it to a client
    clc-tree-services/index.html   One folder per client
scripts/
  build-worker.js                  Bundles every page into dist/_worker.js for Cloudflare Pages
  serve.mjs                        Serves that bundle locally, compressed like Cloudflare
  deploy-cloudflare.sh             Builds and deploys to Cloudflare Pages
tests/
  receptionist.test.js             Scenarios, layout and randomized stress test
  buttons.test.js                  Taps every button in both scenarios on the deploy bundle
  quality.test.js                  Accessibility, keyboard, voice in/out, no network requests
  performance.test.js              Load, input latency, frame rate and memory on a throttled CPU
```

## Demos

| Demo | What it shows |
| --- | --- |
| [CLC Tree Services](demos/ai-receptionist/clc-tree-services/index.html) | Ava, an AI receptionist, answers the main line when the team can't. Two scenarios: a Sunday-morning storm emergency (flagged URGENT for injuries or power lines) and a routine free-estimate request. Texts the crew a summary. Optional voice in and out. |

## Making a new receptionist demo

1. Copy `demos/ai-receptionist/clc-tree-services/` to `demos/ai-receptionist/<client-name>/`.
2. Edit the `CONFIG` object at the top of the script: business details, the receptionist's
   name (`receptionist.name`, used everywhere), colours, the demo scenarios (greeting, day and
   time, one-tap sample answers), the intake flows (questions, summary fields, closing lines),
   urgency rules and guardrail answers. The engine below `CONFIG` doesn't need to change.
3. Add a card for it to the `DEMOS` list in the root `index.html`.
4. Run the tests against it (below).

Use only details the client publishes themselves (number, address, services, service area),
in their own wording. Sample callers use fictional 555-01xx numbers.

## Testing

```bash
npm install && npx playwright install chromium  # once
npm test                                        # everything below
```

Tests also run on GitHub Actions on every push (`.github/workflows/test.yml`).

```bash
node tests/receptionist.test.js                 # scenarios + layout + 300 random calls
node tests/quality.test.js                      # accessibility (axe), keyboard, voice, network
node tests/performance.test.js                  # budgets on a 4x-throttled CPU (THROTTLE=6 for low-end)
node tests/receptionist.test.js 1000            # longer stress run
SEED=777 node tests/receptionist.test.js 300    # different random sequence
node tests/receptionist.test.js 300 demos/ai-receptionist/<client>/index.html
```

The stress run makes random calls that mix real answers with junk, HTML/script injection,
5,000-character inputs, emoji, guardrail questions, double-taps and restarts mid-call. It
checks that every call finishes or restarts cleanly, that URGENT is flagged exactly when it
should be, that phone numbers are formatted, that nothing injected renders as HTML, and that
Ava never quotes a price or an arrival time.

Performance (mid-range phone CPU): 18KB download in one request, ready to tap in ~0.3s on 4G
and ~0.7s on 3G, taps show on screen in under 40ms, 60fps during the call, no memory growth.

## Deploying

Live at https://warder-demos.pages.dev/ (Cloudflare Pages project `warder-demos`).

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npm run deploy
```

New demos under `demos/<kind>/<client>/index.html` are picked up automatically; add a card for
them in the root `index.html`.
