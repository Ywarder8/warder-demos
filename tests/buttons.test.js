#!/usr/bin/env node
/*
 * Taps every button in the receptionist demo, in both scenarios, on a phone-sized touch screen,
 * against the same bundle that gets deployed (dist/_worker.js served locally).
 *
 *   node scripts/build-worker.js && node tests/buttons.test.js
 */
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const PORT = 8790;
const DEMO_PATH = process.env.DEMO_PATH || "/demos/ai-receptionist/clc-tree-services/";
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
let failures = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { failures++; console.log("  ✗ " + m); } };
const MIN_TAP = 44; // px, Apple/WCAG AAA touch target

async function startServer() {
  if (process.env.BASE_URL) return null;
  const proc = spawn(process.execPath, [path.join(__dirname, "..", "scripts", "serve.mjs"), String(PORT)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_NO_WARNINGS: "1" } });
  let err = "";
  proc.stderr.on("data", (d) => (err += d));
  await new Promise((res, rej) => {
    proc.stdout.on("data", (d) => /serving/.test(d) && res());
    proc.on("exit", (code) => rej(new Error(`local server exited (${code}): ${err.trim().split("\n").pop()}`)));
    setTimeout(() => rej(new Error("local server did not start")), 5000);
  });
  process.on("exit", () => proc.kill());
  return proc;
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await context.addInitScript(() => {
    try { localStorage.setItem("receptionist-voice", "0"); } catch (e) {}
    // fake speech recognition so the mic button can be tapped
    window.__recQueue = [];
    window.SpeechRecognition = function () {
      const self = this;
      this.start = () => setTimeout(() => {
        const t = window.__recQueue.shift() || "";
        if (t) self.onresult && self.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] });
        self.onend && self.onend();
      }, 30);
      this.stop = () => {}; this.abort = () => self.onend && self.onend();
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  const url = BASE + DEMO_PATH + "?fast";
  const W = () => page.evaluate(() => window.__receptionist.state());
  const steps = () => page.evaluate(() => window.__receptionist.steps().map((s) => s.key));
  const ready = () => page.waitForFunction(() => {
    const end = document.getElementById("end");
    if (!end.hidden) return true;
    const s = window.__receptionist && window.__receptionist.state();
    return s && !s.busy && s.phase !== "intro" && !document.getElementById("input").disabled;
  }, null, { timeout: 8000 });
  const lastAgent = async () => (await page.$$eval("#chat .row.agent .bubble", (n) => n.map((x) => x.innerText))).slice(-1)[0] || "";
  const tapChip = async (label) => { await ready(); await page.tap(`.chip:text-is(${JSON.stringify(label)})`); };
  const type = async (t) => { await ready(); await page.fill("#input", t); await page.tap("#send"); };
  const callerCount = () => page.$$eval("#chat .row.caller", (n) => n.length);

  async function newCall(scenarioTitle) {
    await page.goto(url);
    await page.tap(`.pick:has-text(${JSON.stringify(scenarioTitle)})`);
    await page.tap("#callBtn");
    await ready();
  }
  // Walk to a given step in a flow using typed answers.
  const ROUTE = {
    "Storm emergency": { first: "A big tree came down in the storm last night", answers: { damage: "nothing", injuries: "no", name: "Jo Park", address: "1 Oak St, London", phone: "5195550100", backup: "no" } },
    "Free estimate": { first: "I'd like a free estimate for pruning", answers: { details: "two maples", name: "Jo Park", address: "1 Oak St, London", phone: "5195550100", bestTime: "mornings" } },
  };
  async function goTo(scenarioTitle, key, firstText) {
    await newCall(scenarioTitle);
    const r = ROUTE[scenarioTitle];
    await type(firstText || r.first);
    for (let i = 0; i < 12; i++) {
      await ready();
      const s = await W();
      if (s.phase === "step" && (await steps())[s.idx] === key) return;
      if (s.phase === "confirm") return;
      const cur = (await steps())[s.idx];
      await type(r.answers[cur] || "ok");
    }
  }

  /* ---------------- intro ---------------- */
  console.log("Intro buttons");
  await page.goto(url);
  const picks = await page.$$(".pick");
  ok(picks.length === 2, "two scenario cards");
  for (const [i, p] of picks.entries()) {
    await p.tap();
    const checked = await page.$$eval(".pick", (n) => n.map((x) => x.getAttribute("aria-checked")));
    ok(checked[i] === "true" && checked.filter((c) => c === "true").length === 1, `scenario card ${i + 1} selects only itself`);
  }
  await page.tap(".pick >> nth=0");
  await page.tap("#callBtn");
  await ready();
  ok(/this is Ava/.test(await lastAgent()), "Call button connects and Ava greets");

  /* ---------------- greeting suggestions ---------------- */
  console.log("Greeting suggestion chips");
  const greetExpect = {
    "Storm emergency": [
      ["A big tree came down in the storm last night", /Sounds like a tree down/],
      ["Am I talking to a real person?", /I'm an AI receptionist/],
      ["How fast can you get here?", /can't promise an arrival time/],
    ],
    "Free estimate": [
      ["I'd like a free estimate for pruning", /Happy to help with pruning/],
      ["How much do you charge?", /estimates are free/],
      ["Am I talking to a real person?", /I'm an AI receptionist/],
    ],
  };
  for (const [sc, list] of Object.entries(greetExpect)) {
    for (const [label, re] of list) {
      await newCall(sc);
      await tapChip(label); await ready();
      const said = (await page.$$eval("#chat .row.agent .bubble", (n) => n.map((x) => x.innerText))).join("\n");
      ok(re.test(said), `${sc}: "${label}" gets the right reply`);
    }
  }

  /* ---------------- every option chip on every question ---------------- */
  console.log("Question chips");
  const choiceCases = [
    ["Storm emergency", "incident", "A tree is in trouble", ["Tree down", "Limb down", "Tree leaning"]],
    ["Storm emergency", "injuries", null, ["Yes, someone is hurt", "No one is hurt"]],
    ["Free estimate", "service", "Hi there", ["Pruning & maintenance", "Tree removal", "Plant health care", "Consulting", "Land clearing", "Firewood"]],
    ["Free estimate", "bestTime", null, ["Mornings", "Afternoons", "Evenings", "Any time"]],
  ];
  for (const [sc, key, first, labels] of choiceCases) {
    for (const label of labels) {
      await goTo(sc, key, first);
      const before = await callerCount();
      await tapChip(label); await ready();
      const s = await W();
      ok(await callerCount() === before + 1, `${key}: "${label}" posts one reply`);
      ok(s.answers[key] && (s.answers[key].startsWith(label) || /YES|No one/.test(s.answers[key])), `${key}: "${label}" recorded (${s.answers[key]})`);
      ok(s.phase !== "step" || (await steps())[s.idx] !== key, `${key}: "${label}" moves to the next question`);
    }
  }
  // "Something else" asks a follow-up on both flows
  for (const [sc, key, first] of [["Storm emergency", "incident", "A tree is in trouble"], ["Free estimate", "service", "Hi there"]]) {
    await goTo(sc, key, first);
    await tapChip("Something else"); await ready();
    ok((await W()).phase === "followUp", `${key}: "Something else" asks for a description`);
    await type("roots lifting the patio"); await ready();
    ok((await W()).answers[key] === "Roots lifting the patio", `${key}: follow-up answer recorded`);
  }

  // multi-select damage chips
  await goTo("Storm emergency", "damage");
  const cont = () => page.$eval(".chip.primary", (b) => b.disabled);
  ok(await cont(), "damage: Continue disabled until something is picked");
  await tapChip("House"); ok(!(await cont()), "damage: Continue enabled after a pick");
  await tapChip("House"); ok(await cont(), "damage: tapping again unticks");
  await tapChip("House"); await tapChip("Car"); await tapChip("None of those");
  let pressed = await page.$$eval('.chip[aria-pressed="true"]', (n) => n.map((x) => x.textContent));
  ok(pressed.length === 1 && pressed[0] === "None of those", "damage: 'None of those' clears other picks");
  await tapChip("Car");
  pressed = await page.$$eval('.chip[aria-pressed="true"]', (n) => n.map((x) => x.textContent));
  ok(pressed.length === 1 && pressed[0] === "Car", "damage: picking a damage clears 'None of those'");
  await tapChip("Power lines"); await tapChip("Continue"); await ready();
  let s = await W();
  ok(s.answers.damage === "Car, Power lines" && s.urgentReasons.length === 1, "damage: Continue submits picks and power lines flags URGENT");

  // sample answer + skip chips walk a whole call with no typing
  console.log("One-tap sample answers");
  for (const sc of ["Storm emergency", "Free estimate"]) {
    await newCall(sc);
    await tapChip(greetExpect[sc][0][0]);
    for (let i = 0; i < 12; i++) {
      await ready();
      s = await W();
      if (s.phase === "confirm") break;
      const labels = await page.$$eval(".chip", (n) => n.map((x) => x.textContent));
      const pick = labels.includes("Continue") ? null : labels[labels.length - 1];
      if (labels.includes("Continue")) { await tapChip("House"); await tapChip("Continue"); }
      else if (labels.length) await tapChip(pick === "Something else" ? labels[0] : pick);
      else { ok(false, `${sc}: question "${(await steps())[s.idx]}" has no tap answer`); break; }
    }
    ok((await W()).phase === "confirm", `${sc}: whole call can be tapped through without typing`);
    await tapChip("Yes, that's right");
    await page.waitForSelector("#end:not([hidden])");
  }

  /* ---------------- confirm + edit chips ---------------- */
  console.log("Confirm and edit chips");
  for (const sc of ["Storm emergency", "Free estimate"]) {
    await goTo(sc, "__confirm__");
    const keys = await steps();
    const labels = await page.evaluate(() => window.__receptionist.steps().map((x) => x.label));
    for (const [i, label] of labels.entries()) {
      await tapChip("Something needs fixing");
      await tapChip(label); await ready();
      s = await W();
      ok(s.editing === keys[i] && s.phase === "step", `${sc}: edit "${label}" goes to that question`);
      // answer it again and come back to the read-back
      const chips = await page.$$eval(".chip", (n) => n.map((x) => x.textContent));
      if (chips.includes("Continue")) { await tapChip("House"); await tapChip("Continue"); }
      else if (chips.length) await tapChip(chips[0] === "Something else" ? chips[1] : chips[0]);
      else await type(ROUTE[sc].answers[keys[i]] || "Jo Park");
      await ready();
      ok((await W()).phase === "confirm", `${sc}: after editing "${label}" Ava reads back again`);
    }
    await tapChip("Yes, that's right");
    await page.waitForSelector("#end:not([hidden])");
  }

  /* ---------------- header buttons ---------------- */
  console.log("Header, send and mic buttons");
  await newCall("Storm emergency");
  const vb = await page.isVisible("#voiceBtn");
  if (vb) {
    const p0 = await page.getAttribute("#voiceBtn", "aria-pressed");
    await page.tap("#voiceBtn");
    ok((await page.getAttribute("#voiceBtn", "aria-pressed")) !== p0, "voice button toggles");
    await page.tap("#voiceBtn");
  }
  await type("A big tree came down in the storm last night"); await ready();
  ok((await callerCount()) === 1, "send button submits typed text");
  await page.fill("#input", "   "); await page.tap("#send");
  ok((await callerCount()) === 1, "send ignores a blank message");
  await page.tap("#restartTop"); await ready();
  ok((await callerCount()) === 0 && /this is Ava/.test(await lastAgent()), "restart button starts a fresh call mid-call");
  ok(await page.isVisible("#mic"), "mic button shown");
  await page.evaluate(() => window.__recQueue.push("a big limb fell on my car"));
  await page.tap("#mic");
  await page.waitForFunction(() => document.querySelectorAll("#chat .row.caller").length === 1);
  ok((await page.innerText("#chat .row.caller")) === "a big limb fell on my car", "mic button: spoken words become the reply");

  // double taps don't double-answer
  await ready();
  await page.evaluate(() => { const b = [...document.querySelectorAll(".chip")].find((x) => x.textContent === "House"); b.click(); });
  await page.evaluate(() => { const c = document.querySelector(".chip.primary"); c.click(); c.click(); });
  await ready();
  ok((await callerCount()) === 2, "double-tapping Continue only answers once");
  await page.evaluate(() => { const b = [...document.querySelectorAll(".chip")].find((x) => x.textContent === "No one is hurt"); b.click(); b.click(); });
  await ready();
  ok((await callerCount()) === 3, "double-tapping an answer only answers once");

  /* ---------------- end screen ---------------- */
  console.log("End screen buttons");
  for (const a of ["Jo Park", "1 Oak St, London", "5195550100", "no", "yes"]) await type(a);
  await page.waitForSelector("#end:not([hidden])");
  await page.tap("#copyBtn");
  await page.waitForFunction(() => /Copied|Couldn't/.test(document.getElementById("copyBtn").textContent));
  ok((await page.innerText("#copyBtn")) === "Copied", "copy button copies");
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok(/Storm damage call/.test(clip) && /Caller: Jo Park/.test(clip) && /Number: \(519\) 555-0100/.test(clip), "copied text is the crew summary");
  await page.tap(".transcript summary");
  ok(await page.$eval(".transcript", (d) => d.open), "transcript opens");
  ok((await page.$$("#transcript p")).length > 8, "transcript has the call");
  await page.tap("#restartEnd"); await ready();
  ok(!(await page.isVisible("#end")) && /this is Ava/.test(await lastAgent()), "Start over begins a new call");

  /* ---------------- tap target sizes ---------------- */
  console.log(`Tap targets (≥ ${MIN_TAP}px)`);
  const measure = async (label) => {
    const small = await page.$$eval("button:not([hidden]), summary, .pick", (n, min) => n
      .filter((b) => b.offsetParent !== null)
      .map((b) => { const r = b.getBoundingClientRect(); return { t: (b.getAttribute("aria-label") || b.textContent).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter((r) => r.w < min || r.h < min), MIN_TAP);
    ok(small.length === 0, `${label}: small tap targets: ` + small.map((x) => `${x.t} ${x.w}x${x.h}`).join(", "));
  };
  await page.goto(url); await measure("intro");
  await page.tap("#callBtn"); await ready(); await measure("greeting");
  await type("A big tree came down in the storm last night"); await ready(); await measure("multi-select");
  await tapChip("House"); await tapChip("Continue"); await ready(); await measure("yes/no");
  for (const a of ["no", "Jo Park", "1 Oak St, London", "5195550100", "no", "yes"]) await type(a);
  await page.waitForSelector("#end:not([hidden])"); await measure("end screen");

  ok(errors.length === 0, "no page errors: " + errors.join(" | "));
  await browser.close();
  if (server) server.kill();
  console.log(`\n${passes} checks passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
