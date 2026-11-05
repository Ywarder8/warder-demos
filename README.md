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
tests/
  receptionist.test.js             Scenarios, layout and randomized stress test
  quality.test.js                  Accessibility, keyboard, voice in/out, no network requests
  performance.test.js              Load, input latency, frame rate and memory on a throttled CPU
```

## Demos

| Demo | What it shows |
| --- | --- |
| [CLC Tree Services](demos/ai-receptionist/clc-tree-services/index.html) | Ava, an AI receptionist, takes a storm-damage call, flags urgent calls (injuries or power lines), checks the service area, and texts a summary to the crew. Optional voice in and out. |

## Making a new receptionist demo

1. Copy `demos/ai-receptionist/clc-tree-services/` to `demos/ai-receptionist/<client-name>/`.
2. Edit the `CONFIG` object at the top of the script: business details, the receptionist's
   name (`receptionist.name`, used everywhere), colours, greeting,
   questions, urgency rules, guardrail answers, opening hours, service area and the summary
   fields. The engine below `CONFIG` doesn't need to change.
3. Add a card for it to the `DEMOS` list in the root `index.html`.
4. Run the tests against it (below).

Before showing a demo to a client, replace the placeholders in `CONFIG`: the phone number
uses the fictional 555-01xx range, and the opening hours and service-area towns are guesses.

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

Performance on a 4x-throttled CPU (a mid-range phone): first paint ~160ms, tap-to-screen
under 40ms, 60fps during the call, and no memory growth across repeated calls.
