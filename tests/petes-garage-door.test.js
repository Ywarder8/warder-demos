#!/usr/bin/env node
/*
 * Pete's Garage Door Repair receptionist demo: business details, both scenarios, the URGENT rule,
 * the no-DIY safety rule, guardrails, voice start-up, Start over, layout, accessibility, a
 * randomized stress run, and the deploy bundle.
 *
 *   node tests/petes-garage-door.test.js [random calls, default 150]
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const RUNS = Number(process.argv[2] || 150);
const FILE = path.resolve(__dirname, "..", "demos/ai-receptionist/petes-garage-door/index.html");
const URL = "file://" + FILE + "?fast";
let failures = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { failures++; console.log("  ✗ " + m); } };
let seed = Number(process.env.SEED || 2024);
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rand() * a.length)];
let axeSource = null;
try { axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"); } catch (e) {}

async function newPage(browser, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", ...opts });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("dialog", async (d) => { errors.push("dialog: " + d.message()); await d.dismiss(); });
  await page.addInitScript(() => { try { localStorage.setItem("receptionist-voice", "0"); } catch (e) {} });
  await page.goto(URL);
  return { page, errors };
}
const settle = (page) => page.waitForFunction(() => {
  if (!document.getElementById("end").hidden) return true;
  const s = window.__receptionist && window.__receptionist.state();
  return s && !s.busy && s.phase !== "intro" && !document.getElementById("input").disabled;
}, null, { timeout: 8000 });
const W = (page) => page.evaluate(() => window.__receptionist.state());
const lines = (page) => page.$$eval("#chat .row.agent .bubble", (n) => n.map((x) => x.innerText));
const sms = (page) => page.innerText("#smsBody");
async function call(page, scenario) {
  if (!(await page.isVisible("#intro"))) { await page.click(await page.isVisible("#restartEnd") ? "#restartEnd" : "#restartTop"); }
  await page.click(`.pick:has-text(${JSON.stringify(scenario)})`);
  await page.click("#callBtn"); await settle(page);
}
async function send(page, t) { await settle(page); await page.fill("#input", t); await page.press("#input", "Enter"); }
async function chip(page, l) { await settle(page); await page.click(`.chip:text-is(${JSON.stringify(l)})`); }
async function confirmAndEnd(page) { await chip(page, "Yes, that's right"); await page.waitForSelector("#end:not([hidden])", { timeout: 8000 }); }

(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await newPage(browser);
  const html = fs.readFileSync(FILE, "utf8");
  const content = html.slice(0, html.indexOf("Engine — generic"));
  // Anything that reads like a how-to for springs, cables or opening a broken door.
  const HOWTO = /\b(pull (the )?(red )?(cord|handle|rope)|emergency release|manual release|disengage|unwind\w*|winding bars?|c-?clamps?|vise|vice grips?|locking pliers|lift the door|prop (it|the door)|release the (tension|spring))\b/i;
  const DIY_REPLY = "Please don't touch it. Garage door springs and cables can seriously hurt someone. Leave the door as it is, keep people and pets clear of it, and Pete will handle it.";

  /* ---------- business details ---------- */
  console.log("Business details");
  ok(/Call \(519\) 914-3471/.test(await page.innerText("#callBtn")), "Call button shows (519) 914-3471");
  ok((await page.innerText("#introName")) === "Pete's Garage Door Repair", "name exact");
  ok((await page.innerText("#introWhere")) === "Garage door repair · London, Ontario", "location line: London, Ontario, no address");
  const pitch = await page.innerText("#introScenario");
  ok(/Emergency repair runs on one number/.test(pitch) && /under a door on another job/.test(pitch), "pitch: one number, Ava answers when Pete's under a door");
  ok((await page.innerText(".fineprint")) === "Demo only. Nothing is saved, and typed answers never leave your browser.", "footer exact");
  ok(!/24\/7|24 hours|around the clock|open (monday|weekdays|\d)/i.test(content), "no 24/7 and no office hours");
  ok(!/\$\s?\d/.test(content), "no prices");
  ok(!/CLC|NZ Systems|fridge|arborist|Kerr/i.test(content), "nothing from the other demos");
  ok(!HOWTO.test(content.replace(/match: \/.*\/i,?/g, "")), "config text contains no how-to wording (outside matchers)");

  /* ---------- urgent scenario ---------- */
  console.log("Urgent scenario");
  await call(page, "Broken spring, car trapped");
  ok((await lines(page))[0] === "Thanks for calling Pete's Garage Door Repair, this is Ava. Pete's out on a job right now, so I'm taking his calls. How can I help?", "greeting exact");
  await chip(page, "My garage door spring broke and my car's stuck inside. I need to get to work.");
  await settle(page);
  let st = await W(page);
  ok(st.answers.issue === "Broken spring" && st.answers.carTrapped === "YES, stuck inside", "spring + trapped car taken from the first sentence");
  const l1 = await lines(page);
  ok(/Okay, a broken spring/.test(l1[l1.length - 3]) && /marking this call URGENT/.test(l1[l1.length - 2]), "acknowledges, then says URGENT");
  ok(/hurt, or stuck/.test(l1[l1.length - 1]), "skips the car question, asks about anyone hurt or stuck");
  await chip(page, "No one is hurt"); await chip(page, "Mark Jensen"); await chip(page, "48 Cedar Ave, London"); await chip(page, "519-555-0134");
  ok(!(await lines(page)).some((l) => /Priority|Next step/.test(l)), "read-back has no priority/next-step lines");
  await confirmAndEnd(page);
  let t = await sms(page);
  ok((await page.$eval("#smsBody .sms-banner", (e) => e.className + "|" + e.textContent)) === "sms-banner urgent|URGENT - Broken spring, car trapped", "red banner text exact");
  ok(/Priority: URGENT/.test(t) && /Next step: Pete calls back as soon as he's clear of the current job/.test(t), "Priority: URGENT + next step");
  ok(/Caller: Mark Jensen/.test(t) && /Number: \(519\) 555-0134/.test(t) && /Address: 48 Cedar Ave, London/.test(t) && /Problem: Broken spring/.test(t), "captured details on the text");
  ok((await page.innerText("#smsTitle")) === "Text to Pete's Garage Door Repair" && /\(519\) 914-3471/.test(await page.innerText("#smsSub")), "mockup titled Text to Pete's Garage Door Repair");
  ok((await page.innerText("#endTitle")) === "Pete's phone just buzzed", "end title");
  ok((await page.evaluate(() => document.activeElement.id)) === "endTitle", "end heading takes focus");
  await page.keyboard.press("Enter");
  ok(await page.isVisible("#end"), "stray Enter does nothing");

  /* ---------- routine scenario ---------- */
  console.log("Routine scenario");
  await page.click("#restartEnd");
  ok(await page.isVisible("#intro"), "Start over returns to the scenario picker");
  await call(page, "Noisy, slow door");
  await chip(page, "My garage door is really noisy and slow. Can someone look at it this week?");
  await settle(page);
  ok((await W(page)).answers.issue === "Noisy or slow" && (await page.isHidden("#urgentPill")), "noisy/slow detected, no flag");
  ok(!(await lines(page)).some((l) => /arrival|today|this week/i.test(l) && !/Can someone/.test(l)), "no promise about this week");
  await chip(page, "No"); await chip(page, "No one is hurt"); await chip(page, "Lisa Moreau"); await chip(page, "17 Elm St, London"); await chip(page, "519-555-0158");
  await confirmAndEnd(page);
  t = await sms(page);
  ok((await page.$$("#smsBody .sms-banner")).length === 0, "routine text has no banner");
  ok(/Priority: Routine/.test(t) && /Next step: Pete calls back to book a time/.test(t), "Priority: Routine + callback to book a time");

  /* ---------- the URGENT rule ---------- */
  console.log("URGENT rule");
  const ruleCases = [
    ["the spring snapped", true], ["a cable broke", true], ["the door came off its tracks", true],
    ["the door won't close", true], ["my door will not close all the way", true], ["it's stuck open", true],
    ["it's really noisy", false], ["the door is slow", false], ["my remote stopped working", false],
    ["the keypad isn't working", false], ["I'd like a tune-up", false], ["the door won't open", false],
  ];
  for (const [first, expect] of ruleCases) {
    await call(page, "Noisy, slow door");
    await send(page, first); await settle(page);
    st = await W(page);
    ok((st.urgentReasons.length > 0) === expect, `"${first}" → ${expect ? "URGENT" : "routine"} (got ${st.answers.issue}, ${st.urgentReasons.join(",") || "routine"})`);
  }
  /* ---------- regression: a spring or cable alone never escalates; questions never escalate ---------- */
  console.log("Spring/cable regression");
  const PRICE = "I can't give prices over the phone, but Pete will go over costs with you when he calls back.";
  const mustNot = ["How much does a new spring cost?", "Do you sell springs?", "I need a spring tune-up", "Can you inspect the springs?", "How long do springs last?"];
  const must = ["The spring snapped", "Broken spring", "The spring broke and the door came down", "Heard a loud bang from the garage and now the door won't open", "A cable snapped"];
  for (const scenario of ["Noisy, slow door", "Broken spring, car trapped"]) {
    for (const q of mustNot) {
      await call(page, scenario);
      await send(page, q); await settle(page);
      st = await W(page);
      const said = (await lines(page)).slice(1);
      ok(st.urgentReasons.length === 0 && (await page.isHidden("#urgentPill")), `[${scenario}] "${q}" does NOT flag URGENT (got ${st.urgentReasons.join(",") || "routine"})`);
      ok(!said.some((l) => /marking this call URGENT/.test(l)), `[${scenario}] "${q}" doesn't announce URGENT`);
      ok(!said.some((l) => /arrival time/.test(l)), `[${scenario}] "${q}" isn't answered as an arrival-time question`);
    }
    for (const q of must) {
      await call(page, scenario);
      await send(page, q); await settle(page);
      st = await W(page);
      ok(st.urgentReasons.length > 0, `[${scenario}] "${q}" flags URGENT (issue: ${st.answers.issue})`);
    }
  }
  // the price question: standard line first, then back to the intake question she was on
  await call(page, "Noisy, slow door");
  await send(page, "How much does a new spring cost?"); await settle(page);
  let said = (await lines(page)).slice(1);
  ok(said[0] === PRICE, "price question at the greeting: standard price line first");
  ok(said[said.length - 1] === "What's happened with the door?", "...then the intake question");
  ok((await W(page)).answers.issue == null, "...and nothing was recorded from the question");
  // mid-intake: same question at the car question keeps priority and re-asks the car question
  await call(page, "Noisy, slow door");
  await send(page, "it's really noisy"); await settle(page);
  await send(page, "How much does a new spring cost?"); await settle(page);
  said = await lines(page);
  st = await W(page);
  ok(said[said.length - 2] === PRICE && said[said.length - 1] === "Is your car trapped inside the garage?", "mid-intake price question: answered, then back to the car question");
  ok(st.urgentReasons.length === 0 && st.answers.carTrapped == null, "mid-intake question changes neither priority nor answers");
  // a question about a broken spring is still a question; the statement in a mixed sentence still counts
  await call(page, "Noisy, slow door");
  await send(page, "How much does a broken spring cost to fix?"); await settle(page);
  ok((await W(page)).urgentReasons.length === 0, "a question that mentions a broken spring doesn't escalate by itself");
  await call(page, "Noisy, slow door");
  await send(page, "The spring snapped, how much will that cost?"); await settle(page);
  st = await W(page);
  ok(st.urgentReasons.includes("Broken spring") && (await lines(page)).includes(PRICE), "statement + question: price answered, statement still escalates");
  // asking Pete to do the work isn't DIY
  await call(page, "Noisy, slow door");
  await send(page, "Can you replace the spring?"); await settle(page);
  ok(!(await lines(page)).includes(DIY_REPLY), "'Can you replace the spring?' doesn't get the DIY warning");
  // standing behaviour
  await call(page, "Noisy, slow door");
  await send(page, "the door won't open"); await settle(page);
  ok((await W(page)).urgentReasons.length === 0, "'won't open' alone stays routine");
  await call(page, "Noisy, slow door");
  await send(page, "my car isn't stuck, the door is just slow"); await settle(page);
  ok((await W(page)).answers.carTrapped == null && (await W(page)).urgentReasons.length === 0, "'my car isn't stuck' is never read as trapped");

  // routine problem, but the car is trapped -> URGENT
  await call(page, "Noisy, slow door");
  await send(page, "the door won't open"); await send(page, "yes, the car's inside"); await settle(page);
  ok((await W(page)).urgentReasons.includes("Car trapped"), "won't open + car trapped → URGENT");
  await call(page, "Noisy, slow door");
  await send(page, "it's noisy"); await send(page, "no"); await send(page, "yes, my son's hand got caught"); await settle(page);
  ok((await W(page)).urgentReasons.includes("Someone hurt or stuck"), "someone hurt → URGENT");
  await call(page, "Noisy, slow door");
  await send(page, "the door is slow and my car isn't stuck"); await settle(page);
  ok((await W(page)).urgentReasons.length === 0, "'car isn't stuck' is not treated as trapped");

  /* ---------- no DIY advice, ever ---------- */
  console.log("Safety: no DIY advice");
  const DIY = [
    "Can I just open it myself?", "how do I release the spring?", "I'm thinking of fixing it myself",
    "should I pull the red cord?", "can I lift it by hand to get my car out?", "I'll just replace the spring, where do I buy one?",
    "my brother says we can unwind it", "I watched a YouTube video, can I do it myself?", "how do I open the door with a broken spring?",
    "can I use the emergency release?",
  ];
  for (const q of DIY) {
    await call(page, "Broken spring, car trapped");
    await send(page, q); await settle(page);
    const said = (await lines(page)).slice(1);
    ok(said.includes(DIY_REPLY), `"${q}": don't touch it, keep people and pets clear, Pete will handle it`);
    ok(!said.some((l) => HOWTO.test(l)), `"${q}": no how-to in any reply`);
  }
  // mid-intake too: answer, then return to the question
  await call(page, "Broken spring, car trapped");
  await send(page, "spring broke"); await send(page, "can I wind the spring back myself?"); await settle(page);
  const mid = await lines(page);
  ok(mid.includes(DIY_REPLY) && /car trapped/.test(mid[mid.length - 1]), "DIY question mid-intake: safety reply, then back to the question");

  /* ---------- guardrails ---------- */
  console.log("Guardrails");
  await call(page, "Noisy, slow door");
  await send(page, "Am I talking to a real person?"); await settle(page);
  ok((await lines(page)).includes("I'm an AI receptionist for Pete's Garage Door Repair. I take down your details and pass them straight to Pete."), "AI answer exact");
  await send(page, "How much will it cost? When can Pete get here?"); await settle(page);
  const g = (await lines(page)).join("\n");
  ok(/can't give prices/.test(g) && /can't promise an arrival time/.test(g), "price and arrival questions deflected");

  /* ---------- edit flow ---------- */
  await call(page, "Broken spring, car trapped");
  await chip(page, "My garage door spring broke and my car's stuck inside. I need to get to work.");
  for (const l of ["No one is hurt", "Mark Jensen", "48 Cedar Ave, London", "519-555-0134"]) await chip(page, l);
  await send(page, "actually the car isn't trapped, that's wrong"); await settle(page);
  ok((await W(page)).editing === "carTrapped", "'the car isn't trapped, that's wrong' jumps to the car question");
  await chip(page, "No"); await settle(page);
  st = await W(page);
  ok(st.phase === "confirm" && !st.urgentReasons.includes("Car trapped") && st.urgentReasons.includes("Broken spring"), "edit updates the flags (still URGENT for the spring)");

  await page.click("#restartTop");
  ok(await page.isVisible("#intro") && await page.isHidden("#call"), "restart arrow mid-call returns to the picker");
  ok(errors.length === 0, "no page errors: " + errors.join(" | "));
  await page.close();

  /* ---------- voice ---------- */
  console.log("Voice");
  const ENGINE = (mode) => {
    window.__spoken = []; window.__primed = false; let unlocked = false;
    const synth = { speaking: false, pending: false, getVoices: () => [{ name: "T", lang: "en-CA" }], addEventListener() {}, resume() {},
      cancel() { this.speaking = false; },
      speak(u) {
        if (navigator.userActivation && navigator.userActivation.isActive) { unlocked = true; window.__primed = true; }
        if (mode === "blocked" || !unlocked) { this.pending = true; return; }
        window.__spoken.push(u.text); this.speaking = true;
        setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => { this.speaking = false; u.onend && u.onend(); }, 30);
      } };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  };
  for (const mode of ["gesture", "blocked"]) {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.addInitScript(ENGINE, mode);
    await p.goto("file://" + FILE);
    const t0 = Date.now();
    await p.click("#callBtn");
    const idle = () => p.waitForFunction(() => !document.getElementById("input").disabled || !document.getElementById("end").hidden, null, { timeout: 60000 });
    for (const l of ["My garage door spring broke and my car's stuck inside. I need to get to work.", "No one is hurt", "Mark Jensen", "48 Cedar Ave, London", "519-555-0134", "Yes, that's right"]) {
      await idle(); await p.click(`.chip:text-is(${JSON.stringify(l)})`);
    }
    await p.waitForSelector("#end:not([hidden])", { timeout: 60000 });
    const secs = (Date.now() - t0) / 1000;
    const r = await p.evaluate(() => ({ primed: window.__primed, spoken: window.__spoken.filter((x) => x.trim()) }));
    ok(r.primed, `${mode}: speech unlocked on the Call tap`);
    if (mode === "gesture") ok(/this is Ava/.test(r.spoken[0] || ""), "greeting is spoken after the Call tap");
    ok(secs < 25, `${mode}: whole call reaches the text mockup in ${secs.toFixed(1)}s (< 25s)`);
    await p.close();
  }

  /* ---------- layout, tap targets, accessibility ---------- */
  console.log("Layout and accessibility");
  for (const width of [320, 390, 768, 1280]) {
    const { page: p, errors: e } = await newPage(browser, { viewport: { width, height: 800 } });
    const noOverflow = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok(await noOverflow(), `${width}px intro: no horizontal scroll`);
    await call(p, "Broken spring, car trapped");
    await chip(p, "My garage door spring broke and my car's stuck inside. I need to get to work."); await settle(p);
    ok(await noOverflow(), `${width}px call: no horizontal scroll`);
    const headH = await p.evaluate(() => document.querySelector(".call-head").getBoundingClientRect().height);
    ok(headH < 80, `${width}px header stays one row (${Math.round(headH)}px)`);
    const small = await p.$$eval("button:not([hidden]), .pick", (n) => n.filter((b) => b.offsetParent !== null).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
    ok(small === 0, `${width}px: all tap targets ≥ 44px`);
    if (axeSource && width === 390) {
      await p.addScriptTag({ content: axeSource });
      let res = await p.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }));
      let bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      ok(bad.length === 0, "axe (call): " + bad.map((v) => v.id).join(", "));
      for (const l of ["No one is hurt", "Mark Jensen", "48 Cedar Ave, London", "519-555-0134"]) await chip(p, l);
      await confirmAndEnd(p);
      await p.addScriptTag({ content: axeSource });
      res = await p.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }));
      bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      ok(bad.length === 0, "axe (end screen): " + bad.map((v) => `${v.id} ${v.nodes[0].target}`).join(", "));
    }
    ok(e.length === 0, `${width}px no errors`);
    await p.close();
  }

  /* ---------- randomized stress ---------- */
  console.log(`Stress: ${RUNS} random calls`);
  const VALID = {
    greeting: ["my spring broke", "the cable snapped and my car is stuck", "door is noisy", "remote doesn't work", "hello", "the door won't close", "door came off the track", "I need a tune-up",
               "How much does a new spring cost?", "I need a spring tune-up", "heard a loud bang and the door dropped", "Do you sell springs?"],
    issue: ["spring", "it's slow", "keypad", "off the tracks", "won't open", "something rattles", "the spring snapped", "how much is a spring?"],
    carTrapped: ["yes", "no", "it's stuck inside", "no, it's in the driveway"],
    injuries: ["no", "nobody", "yes", "my dog got caught"],
    name: ["Jo Park", "sam lee"], address: ["1 Oak St, London", "22 Birch Cres"],
    phone: ["5195550100", "519 555 0111", "(226) 555-0199"],
    followUp: ["the panel is dented", "weather seal is torn"],
    confirm: ["yes", "yes", "no the address is wrong"], editPick: ["address", "name", "car"],
  };
  const JUNK = ["", "?", "<img src=x onerror=alert(1)>", "x".repeat(3000), "😀", "how much is it", "are you a robot", "when can he come", "can I fix it myself?", "how do I release the spring"];
  let { page: sp, errors: se } = await newPage(browser);
  let done = 0, aborted = 0, urgentCalls = 0;
  for (let run = 0; run < RUNS; run++) {
    await call(sp, rand() < 0.5 ? "Broken spring, car trapped" : "Noisy, slow door");
    let ended = false;
    for (let i = 0; i < 60; i++) {
      try { await settle(sp); } catch (e) { const s = await W(sp).catch(() => ({})); fail(`run ${run}: stuck in ${s.phase}`); break; }
      if (await sp.isVisible("#end")) { ended = true; break; }
      const s = await W(sp);
      const key = s.phase === "step" ? (await sp.evaluate(() => window.__receptionist.steps()[window.__receptionist.state().idx].key)) : s.phase;
      const r = rand();
      if (r < 0.03) { await sp.click("#restartTop"); aborted++; break; }
      else if (r < 0.15) { await sp.fill("#input", pick(JUNK)); await sp.press("#input", "Enter"); }
      else {
        const chips = await sp.$$eval(".chip", (n) => n.map((x) => x.textContent));
        if (chips.length && rand() < 0.5) await sp.click(`.chip:text-is(${JSON.stringify(pick(chips))})`);
        else await send(sp, pick(VALID[key] || ["yes"]));
      }
    }
    if (!ended) continue;
    done++;
    const s = await W(sp);
    const text = await sms(sp);
    const banner = await sp.$$eval("#smsBody .sms-banner", (n) => n.map((x) => x.textContent));
    const urgentIssue = ["Broken spring", "Broken cable", "Loud bang or door dropped", "Off its tracks", "Won't close"].includes(s.raw.issue);
    const expectUrgent = urgentIssue || s.raw.carTrapped === "Yes" || s.raw.injuries === "Yes";
    if (expectUrgent) urgentCalls++;
    ok((s.urgentReasons.length > 0) === expectUrgent, `run ${run}: URGENT exactly per the rule (${s.raw.issue}, car ${s.raw.carTrapped}, hurt ${s.raw.injuries})`);
    ok(expectUrgent ? (banner.length === 1 && banner[0].startsWith("URGENT - ")) : banner.length === 0, `run ${run}: banner matches`);
    ok(new RegExp("Priority: " + (expectUrgent ? "URGENT" : "Routine")).test(text), `run ${run}: priority line`);
    ok(new RegExp("Next step: " + (expectUrgent ? "Pete calls back as soon as he's clear" : "Pete calls back to book a time")).test(text), `run ${run}: next step line`);
    const agentText = (await lines(sp)).join("\n");
    ok(!HOWTO.test(agentText), `run ${run}: no how-to advice`);
    ok(!/\$\s?\d|\b\d+\s*(minutes?|hours?|days?)\b|\bwithin\b|\b24\/7\b/i.test(agentText), `run ${run}: no prices or times`);
    ok((await sp.$$eval("#chat img, #smsBody img", (n) => n.length)) === 0, `run ${run}: no injected HTML`);
    if (se.length) { fail(`run ${run}: ${se.join(" | ")}`); se.length = 0; }
  }
  console.log(`  ${done} completed (${urgentCalls} urgent), ${aborted} restarted`);
  ok(done + aborted === RUNS, `every call finished or was restarted on purpose (${done}+${aborted}/${RUNS})`);
  await sp.close();

  /* ---------- deploy bundle includes Pete's ---------- */
  const dist = path.resolve(__dirname, "..", "dist", "_worker.js");
  if (fs.existsSync(dist)) {
    const w = (await import("file://" + dist)).default;
    const res = await w.fetch(new Request("https://x.pages.dev/demos/ai-receptionist/petes-garage-door/"));
    ok(res.status === 200 && /Pete's Garage Door Repair · AI Receptionist Demo/.test(await res.text()), "deploy bundle serves /demos/ai-receptionist/petes-garage-door/");
  }

  await browser.close();
  console.log(`\n${passes} checks passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
  function fail(m) { failures++; console.log("  ✗ " + m); }
})().catch((e) => { console.error(e); process.exit(1); });
