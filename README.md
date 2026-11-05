# Warder Demos

Click-through demos of AI tools for local businesses. Every demo is a single `index.html`
with inline CSS and JS: no build step, no dependencies, no API keys. Open it in a browser,
or host the folder anywhere static (GitHub Pages, Netlify, Cloudflare Pages).

Each client gets only their own direct link. The root page deliberately lists no demos (so one
client can't see another's), and every page is marked `noindex` so search engines skip them.

| Client | Link to send |
| --- | --- |
| CLC Tree Services | https://warder-demos.pages.dev/demos/ai-receptionist/clc-tree-services/ |
| NZ Systems | https://warder-demos.pages.dev/demos/ai-receptionist/nz-systems/ |
| Pete's Garage Door Repair | https://warder-demos.pages.dev/demos/ai-receptionist/petes-garage-door/ |

## Layout

```
index.html                         Root page: no client list, on purpose
demos/
  ai-receptionist/                 One folder per kind of demo
    clc-tree-services/index.html   One folder per client (PRESENTING.md alongside: walkthrough script)
    nz-systems/index.html
    petes-garage-door/index.html
scripts/
  build-worker.js                  Bundles every page into dist/_worker.js for Cloudflare Pages
  serve.mjs                        Serves that bundle locally, compressed like Cloudflare
  deploy-cloudflare.sh             Builds and deploys to Cloudflare Pages
tests/
  receptionist.test.js             Scenarios, layout and randomized stress test
  buttons.test.js                  Taps every button in both scenarios on the deploy bundle
  nz-systems.test.js               NZ Systems: priority rule, gas override, scenarios, stress, a11y
  petes-garage-door.test.js        Pete's: URGENT rule, no-DIY safety rule, scenarios, stress, a11y
  quality.test.js                  Accessibility, keyboard, voice in/out, no network requests
  performance.test.js              Load, input latency, frame rate and memory on a throttled CPU
```

## Demos

| Demo | What it shows |
| --- | --- |
| [CLC Tree Services](demos/ai-receptionist/clc-tree-services/index.html) | Ava, an AI receptionist, answers the main line when the team can't. Two scenarios: a Sunday-morning storm emergency (flagged URGENT for injuries or power lines) and a routine free-estimate request. Texts the crew a summary. Optional voice in and out. |
| [NZ Systems](demos/ai-receptionist/nz-systems/index.html) | Appliance repair, open weekdays 9 to 5. Ava answers when the shop is closed: a Saturday fridge failure flagged PRIORITY (amber), a routine Wednesday washer call, and a gas-smell safety rule that ends the call with URGENT. |
| [Pete's Garage Door Repair](demos/ai-receptionist/petes-garage-door/index.html) | Ava answers while Pete's on another job: a broken spring with a car trapped (URGENT, red) and a routine noisy door. Never gives DIY repair advice. |

## Making a new receptionist demo

1. Copy an existing demo folder to `demos/ai-receptionist/<client-name>/`. Every receptionist demo
   uses the identical engine below `CONFIG`; only `CONFIG` and the page title differ. Optional
   `CONFIG` features: `priorityTier` (an amber middle flag), `safetyOverride` (a phrase that ends
   the call with a safety instruction and an URGENT flag), `captureFromGreeting` and `editMatch`
   on questions, `intro.where` / `intro.footer`, `endScreen.title`, and on `urgent`:
   `smsBanner`, `reasonsSentenceCase`, `announceAfterGreeting`; `questionsDontEscalate` /
   `questionFallback` (questions get answered but never set priority); `unless` on guardrails.
2. Edit the `CONFIG` object at the top of the script: business details, the receptionist's
   name (`receptionist.name`, used everywhere), colours, the demo scenarios (greeting, day and
   time, one-tap sample answers), the intake flows (questions, summary fields, closing lines),
   urgency rules and guardrail answers. The engine below `CONFIG` doesn't need to change.
3. Add its link to the table at the top of this README (not to the root page).
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

New demos under `demos/<kind>/<client>/index.html` are picked up automatically.
