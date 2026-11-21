# Coinhold security

Coinhold has no server: everything runs in the browser and data is stored only on the device.
That removes whole classes of risk (no database to breach, no accounts to take over). What's left
is protecting the data on the device and stopping hostile content from running inside the page.

## Threats and controls

| Threat | Control | Tested by |
| --- | --- | --- |
| Cross-site scripting through a transaction, debt name, CSV row or restored backup | Every value is HTML-escaped on output; tooltip text is escaped twice because it is re-parsed; `<` `>` and control characters are stripped on input; text capped at 80 characters | XSS payloads in ledger, backup and debt names never execute |
| Injected script running anyway | Content-Security-Policy `script-src 'self'` (no inline script, no eval, no third-party scripts); `object-src`, `base-uri`, `form-action` all `'none'` | An injected inline `<script>` is blocked |
| Data leaving the device | CSP `connect-src 'none'`: the page cannot make network requests at all | `fetch()` to another site is blocked |
| Malicious backup file (prototype pollution, wrong types, giant numbers) | `sanitizeState()` rebuilds state field by field from a whitelist; numbers clamped (amounts to ±$10M, APR 0-100%); IDs, dates and categories validated | `__proto__` payload and junk values are neutralised |
| Someone else using the same device | Optional PIN lock: AES-256-GCM, key from PBKDF2-SHA256 with 600,000 iterations and a random salt; fresh IV on every save; key held in memory, never stored | Storage contains no readable text once locked |
| PIN guessing | 6-12 digits required; after 3 wrong tries an exponential lockout (15s, 30s, 60s ... up to 5 min) | Lockout refuses even the correct PIN until it ends |
| Walk-away | Auto-lock after 5 minutes without input or 5 minutes in the background | |
| Clickjacking / framing | `frame-ancestors 'none'` and `X-Frame-Options: DENY` | Headers checked |
| Huge or hostile imports | CSV capped at 2 MB and 5,000 rows; ledger capped at 20,000 transactions | 3,000-row import stays fast |
| Referrer and tracking leaks | `Referrer-Policy: no-referrer`; no analytics; `Permissions-Policy` denies camera, mic, location, payment | |

## Known limits

- **Without a PIN, data is plain text in browser storage.** Anyone with access to the unlocked
  device and browser profile can read it. The app says so in the Ledger.
- **An offline attacker who copies the encrypted blob can brute-force a short PIN.** PBKDF2 slows
  each guess but a 6-digit PIN has only a million options. A longer passphrase option is on the roadmap.
- **Browser extensions run with more privilege than the page** and can read anything it shows.
- **Google Fonts** is the one outside request (font files only, no user data). Self-host the fonts
  before launch so the app makes no third-party requests at all.
- `style-src` allows inline styles because charts set widths inline. Style injection is far lower
  risk than script injection, and all text is escaped anyway.

## Reporting

Before launch, publish a security contact (`/.well-known/security.txt`) and run an external audit.
