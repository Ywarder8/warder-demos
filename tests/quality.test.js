#!/usr/bin/env node
/*
 * Quality checks for the AI receptionist demos:
 *   - accessibility audit (axe-core, if installed: `npm i -D axe-core`)
 *   - keyboard-only use
 *   - voice out / voice in, using fake speech engines (no audio needed)
 *   - reduced motion, no network requests
 *
 *   node tests/quality.test.js [demo/index.html]
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const DEMO = path.resolve(__dirname, "..", process.argv[2] || "demos/ai-receptionist/clc-tree-services/index.html");
const LANDING = path.resolve(__dirname, "..", "index.html");
let failures = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { failures++; console.log("  ✗ " + m); } };

let axeSource = null;
try { axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"); } catch (e) {}

const ready = (page) => page.waitForFunction(() => !document.getElementById("input").disabled, null, { timeout: 15000 });
async function send(page, t) { await ready(page); await page.fill("#input", t); await page.press("#input", "Enter"); }

// Fake speech engines, installed before the page loads.
const FAKE_SPEECH = () => {
  window.__spoken = []; window.__cancels = 0; window.__recStarts = 0; window.__recQueue = [];
  const synth = {
    speaking: false, pending: false, _q: [],
    getVoices: () => [{ name: "Test Voice", lang: "en-CA" }],
    addEventListener() {},
    speak(u) {
      window.__spoken.push(u.text); this.speaking = true;
      if (navigator.userActivation && navigator.userActivation.isActive) window.__primed = true;
      setTimeout(() => u.onstart && u.onstart(), 5);
      clearTimeout(this._t); this._t = setTimeout(() => { this.speaking = false; u.onend && u.onend(); }, 60);
    },
    cancel() { window.__cancels++; this.speaking = false; },
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  window.SpeechRecognition = function () {
    const self = this;
    this.start = () => {
      window.__recStarts++;
      const next = window.__recQueue.shift();
      setTimeout(() => {
        if (next && next.error) { self.onerror && self.onerror({ error: next.error }); self.onend && self.onend(); return; }
        const text = next || "";
        if (text) self.onresult && self.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
        self.onend && self.onend();
      }, 30);
    };
    this.stop = () => {}; this.abort = () => { self.onend && self.onend(); };
  };
};

async function axeAudit(page, label) {
  if (!axeSource) return;
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }));
  const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  ok(bad.length === 0, `${label}: accessibility violations: ` + bad.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0].target}`).join("; "));
  const minor = res.violations.filter((v) => !bad.includes(v));
  if (minor.length) console.log(`    ${label}: minor a11y notes: ` + minor.map((v) => v.id).join(", "));
}

(async () => {
  const browser = await chromium.launch();

  // ---------- accessibility ----------
  console.log(axeSource ? "Accessibility (axe-core)" : "Accessibility: axe-core not installed, skipping audit (npm i -D axe-core)");
  {
    // reduced motion so the audit doesn't catch elements mid fade-in
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await page.addInitScript(() => { try { localStorage.setItem("receptionist-voice", "0"); } catch (e) {} });
    await page.goto("file://" + DEMO + "?fast");
    await axeAudit(page, "intro");
    await page.click("#callBtn");
    await send(page, "a tree fell on the power lines"); await ready(page);
    await axeAudit(page, "call (urgent, multi-select chips)");
    await page.click('.chip:text-is("Neither")'); await page.click('.chip:text-is("Continue")');
    for (const a of ["no", "Jane Doe", "12 Oak St, London", "5195550199", "no", "yes"]) await send(page, a);
    await page.waitForSelector("#end:not([hidden])");
    await page.click(".transcript summary");
    await axeAudit(page, "end screen");
    await page.goto("file://" + LANDING);
    await axeAudit(page, "landing page");
    await page.close();
  }

  // ---------- keyboard only ----------
  console.log("Keyboard");
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => { try { localStorage.setItem("receptionist-voice", "0"); } catch (e) {} });
    await page.goto("file://" + DEMO + "?fast");
    const focusId = () => page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.textContent.trim()));
    let reached = false;
    for (let i = 0; i < 6 && !reached; i++) { await page.keyboard.press("Tab"); reached = (await focusId()) === "callBtn"; }
    ok(reached, "Tab reaches the Call button");
    await page.keyboard.press("Enter");
    await ready(page);
    ok((await focusId()) === "input", "reply box is focused when the receptionist asks a question");
    await page.keyboard.type("A tree came down"); await page.keyboard.press("Enter");
    await ready(page);
    // multi-select by keyboard: Shift+Tab back into the chips, Space to toggle, then Continue
    let onChip = false;
    for (let i = 0; i < 8 && !onChip; i++) { await page.keyboard.press("Shift+Tab"); onChip = (await focusId()) === "Neither"; }
    ok(onChip, "chips reachable with Shift+Tab");
    await page.keyboard.press("Space");
    let onCont = false;
    for (let i = 0; i < 4 && !onCont; i++) { await page.keyboard.press("Tab"); onCont = (await focusId()) === "Continue"; }
    ok(onCont, "Continue reachable with Tab");
    await page.keyboard.press("Enter");
    for (const a of ["no", "no", "Jane Doe", "12 Oak St, London", "5195550199", "no", "yes"]) { await ready(page); await page.keyboard.type(a); await page.keyboard.press("Enter"); }
    await page.waitForSelector("#end:not([hidden])");
    ok((await focusId()) === "endTitle", "end screen heading is focused (announced, and a stray Enter does nothing)");
    await page.keyboard.press("Enter");
    ok(await page.isVisible("#end"), "Enter on the end screen doesn't leave it");
    let onRestart = false;
    for (let i = 0; i < 4 && !onRestart; i++) { await page.keyboard.press("Tab"); onRestart = (await focusId()) === "restartEnd"; }
    ok(onRestart, "Tab reaches Start over");
    const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    ok(ring !== "none", "focused button shows a focus ring");
    await page.close();
  }

  // ---------- voice out + voice in (fake engines) ----------
  console.log("Voice");
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(FAKE_SPEECH);
    await page.goto("file://" + DEMO + "?fast");
    await page.click("#callBtn"); await ready(page);
    ok(await page.isVisible("#voiceBtn"), "voice toggle shown when speech is supported");
    ok(await page.isVisible("#mic"), "mic shown when speech recognition is supported");
    let spoken = await page.evaluate(() => window.__spoken);
    ok((await page.evaluate(() => window.__primed)) === true, "speech is unlocked during the Call tap");
    spoken = spoken.filter((t) => t.trim());
    ok(spoken.length === 1 && /this is Ava/.test(spoken[0]), "greeting is spoken: " + JSON.stringify(spoken));

    // talk back with the mic
    await page.evaluate(() => window.__recQueue.push("a big limb fell on my car"));
    await page.click("#mic");
    await page.waitForFunction(() => document.querySelectorAll("#chat .row.caller").length === 1);
    ok((await page.innerText("#chat .row.caller")) === "a big limb fell on my car", "mic transcript becomes the caller's reply");
    ok((await page.evaluate(() => window.__cancels)) > 0, "the receptionist stops talking when the caller speaks");
    await ready(page);
    const pressed = await page.$$eval('.chip[aria-pressed="true"]', (n) => n.map((x) => x.textContent));
    ok(pressed.includes("Car"), "car mentioned by voice is pre-ticked");
    await page.click('.chip:text-is("Continue")');
    for (const a of ["no", "no", "Jane Doe", "12 Oak St, London", "519 555 0199"]) await send(page, a);
    await ready(page);
    // mute: no further speech, and the setting sticks
    await page.click("#voiceBtn");
    const before = (await page.evaluate(() => window.__spoken)).length;
    await send(page, "no"); await ready(page);
    ok((await page.evaluate(() => window.__spoken)).length === before, "muted: nothing more is spoken");
    ok((await page.evaluate(() => localStorage.getItem("receptionist-voice"))) === "0", "mute setting is remembered");
    await page.click("#voiceBtn");
    await send(page, "yes");
    await page.waitForSelector("#end:not([hidden])");
    spoken = await page.evaluate(() => window.__spoken);
    ok(spoken.some((t) => /5 1 9, 5 5 5, 0 1 9 9/.test(t)), "callback number read back digit by digit");
    ok(!spoken.some((t) => /URGENT/.test(t)), "URGENT spoken as a word, not shouted");

    // denied microphone hides the mic and explains
    await page.click("#restartEnd"); await page.click("#callBtn"); await ready(page);
    await page.evaluate(() => window.__recQueue.push({ error: "not-allowed" }));
    await page.click("#mic");
    await page.waitForFunction(() => document.getElementById("mic").hidden);
    ok(/blocked/i.test(await page.getAttribute("#input", "placeholder")), "blocked mic falls back to typing with a hint");
    await page.close();
  }
  {
    const page = await browser.newPage();
    await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
    await page.goto("file://" + DEMO + "?fast");
    await page.click("#callBtn");
    ok(await page.isHidden("#mic"), "mic hidden when speech recognition is unsupported");
    await page.close();
  }

  // ---------- reduced motion + self-contained ----------
  console.log("Motion & network");
  {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    const requests = [];
    page.on("request", (r) => { if (!r.url().startsWith("file://") && !r.url().startsWith("data:")) requests.push(r.url()); });
    await page.goto("file://" + DEMO);
    await page.click("#callBtn");
    await page.waitForTimeout(600);
    const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
    ok(anims === 0, `reduced motion: no running animations (found ${anims})`);
    ok(requests.length === 0, "no network requests: " + requests.join(", "));
    await page.goto("file://" + LANDING);
    ok(requests.length === 0, "landing page makes no network requests");
    await page.close();
  }

  await browser.close();
  console.log(`\n${passes} checks passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})();
