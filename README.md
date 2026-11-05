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
    clc-tree-services/index.html   One folder per client
tests/
  receptionist.test.js             Scenario, layout and stress tests for receptionist demos
```

## Demos

| Demo | What it shows |
| --- | --- |
| [CLC Tree Services](demos/ai-receptionist/clc-tree-services/index.html) | Wren, an AI receptionist, takes a storm-damage call, flags urgent calls (injuries or power lines), checks the service area, and texts a summary to the crew. Optional voice in and out. |

## Making a new receptionist demo

1. Copy `demos/ai-receptionist/clc-tree-services/` to `demos/ai-receptionist/<client-name>/`.
2. Edit the `CONFIG` object at the top of the script: business details, colours, greeting,
   questions, urgency rules, guardrail answers, opening hours, service area and the summary
   fields. The engine below `CONFIG` doesn't need to change.
3. Add a card for it to the `DEMOS` list in the root `index.html`.
4. Run the tests against it (below).

Before showing a demo to a client, replace the placeholders in `CONFIG`: the phone number
uses the fictional 555-01xx range, and the opening hours and service-area towns are guesses.

## Testing

Needs Node and Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`).

```bash
node tests/receptionist.test.js                 # scenarios + layout + 300 random calls
node tests/receptionist.test.js 1000            # longer stress run
SEED=777 node tests/receptionist.test.js 300    # different random sequence
node tests/receptionist.test.js 300 demos/ai-receptionist/<client>/index.html
```

The stress run makes random calls that mix real answers with junk, HTML/script injection,
5,000-character inputs, emoji, guardrail questions, double-taps and restarts mid-call. It
checks that every call finishes or restarts cleanly, that URGENT is flagged exactly when it
should be, that phone numbers are formatted, that nothing injected renders as HTML, and that
Wren never quotes a price or an arrival time.
