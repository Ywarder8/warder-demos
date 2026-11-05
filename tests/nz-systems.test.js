#!/usr/bin/env node
/*
 * NZ Systems receptionist demo: business details, both scenarios, the priority rule, the gas
 * safety override, guardrails, voice start-up, Start over, layout, accessibility, a randomized
 * stress run, and the deploy bundle.
 *
 *   node tests/nz-systems.test.js [random calls, default 150]
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const RUNS = Number(process.argv[2] || 150);
const FILE = path.resolve(__dirname, "..", "demos/ai-receptionist/nz-systems/index.html");
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

  /* ---------- business details ---------- */
  console.log("Business details");
  ok(/Call \(519\) 652-0518/.test(await page.innerText("#callBtn")), "Call button shows (519) 652-0518");
  ok((await page.innerText("#introName")) === "NZ Systems", "name is NZ Systems");
  const where = await page.innerText("#introWhere");
  ok(/London, Ontario/.test(where) && /Monday to Friday, 9 to 5/.test(where), "location + hours line");
  ok(/evenings and weekends/.test(await page.innerText("#introScenario")) && /next business day/.test(await page.innerText("#introScenario")), "pitch: answers evenings and weekends, captured for next business day");
  ok((await page.innerText(".fineprint")) === "Demo only. Nothing is saved, and typed answers never leave your browser.", "footer text exact");
  ok(!/24\/7|24 hours|around the clock/i.test(html), "no 24/7 claim anywhere");
  ok(!/Kerr|CLC|Tree Services|arborist/i.test(html.slice(0, html.indexOf("Engine — generic"))), "no CLC details leaked into the NZ config");
  ok(!/\$\s?\d/.test(html.slice(0, html.indexOf("Engine — generic"))), "no prices anywhere in the demo's content");

  /* ---------- Saturday: fridge priority ---------- */
  console.log("Saturday fridge (priority)");
  await call(page, "Fridge not cooling");
  ok((await lines(page))[0] === "Thanks for calling NZ Systems, this is Ava. The shop's closed right now, so I'm taking calls for the team. How can I help?", "greeting exact");
  await chip(page, "My fridge stopped cooling last night and the food is warming up");
  await settle(page);
  let st = await W(page);
  ok(st.answers.appliance === "Fridge" && /stopped cooling/.test(st.answers.problem), "appliance + problem captured from first sentence");
  ok(st.priorityReasons.length === 1 && (await page.isVisible("#urgentPill")) && (await page.getAttribute("#urgentPill", "class")).includes("priority"), "amber PRIORITY header bar");
  ok((await lines(page)).some((l) => /flagging this as a PRIORITY so it's first in line when the shop opens Monday/.test(l)), "Ava tells the caller it's a priority");
  ok(/make and model/.test((await lines(page)).slice(-1)[0]), "next question is make and model");
  await chip(page, "Frigidaire, not sure of the model"); await chip(page, "Priya Shah"); await chip(page, "22 Birch Cres, London"); await chip(page, "519-555-0172");
  ok(!(await lines(page)).some((l) => /Priority|Next step/.test(l)), "read-back has no priority/next-step lines");
  await confirmAndEnd(page);
  let t = await sms(page);
  ok((await page.$eval("#smsBody .sms-banner", (e) => e.className + "|" + e.textContent)) === "sms-banner priority|PRIORITY - Fridge/freezer, food spoilage risk", "amber banner text exact");
  ok(/Priority: Priority/.test(t) && /Next step: First in line when the shop opens Monday/.test(t), "Priority: Priority + first in line Monday");
  ok(/Caller: Priya Shah/.test(t) && /Number: \(519\) 555-0172/.test(t) && /Appliance: Fridge/.test(t) && /Make\/model: Frigidaire/.test(t), "captured details on the text");
  ok((await page.innerText("#smsTitle")) === "Text to NZ Systems" && /\(519\) 652-0518/.test(await page.innerText("#smsSub")), "mockup titled Text to NZ Systems with their number");
  ok((await page.innerText("#smsStamp")) === "Saturday 9:12 AM", "stamped Saturday morning");
  ok((await lines(page)).some((l) => /first in line when the shop opens Monday\. The team will call you at \(519\) 555-0172/.test(l)), "priority closing");
  ok((await page.evaluate(() => document.activeElement.id)) === "endTitle", "end heading takes focus");
  await page.keyboard.press("Enter");
  ok(await page.isVisible("#end"), "stray Enter does nothing on the end screen");

  /* ---------- Wednesday: washer routine ---------- */
  console.log("Wednesday washer (routine)");
  await page.click("#restartEnd");
  ok(await page.isVisible("#intro"), "Start over returns to the scenario picker");
  await call(page, "Washer quit mid-cycle");
  await chip(page, "My washer quit in the middle of a cycle");
  await settle(page);
  st = await W(page);
  ok(st.answers.appliance === "Washer" && st.priorityReasons.length === 0 && (await page.isHidden("#urgentPill")), "washer is routine, no header flag");
  await chip(page, "Maytag top loader"); await chip(page, "Tom Reid"); await chip(page, "9 Oxford St, London"); await chip(page, "519-555-0186");
  await confirmAndEnd(page);
  t = await sms(page);
  ok((await page.$$("#smsBody .sms-banner")).length === 0, "routine text has no banner");
  ok(/Priority: Routine/.test(t) && /Next step: Call back next business day/.test(t), "Priority: Routine + next business day");
  ok((await lines(page)).some((l) => /call you back at \(519\) 555-0186 the next business day/.test(l)), "routine closing");
  ok((await page.innerText("#smsStamp")) === "Wednesday 6:40 PM", "stamped Wednesday evening");

  /* ---------- the priority rule, typed ---------- */
  console.log("Priority rule");
  const ruleCases = [
    ["my freezer is thawing", true], ["the fridge isn't cold anymore", true], ["fridge died overnight", true],
    ["my fridge is making a loud noise but it's still cold", false], ["the fridge light is out", false],
    ["my stove won't turn on", false], ["dryer stopped heating", false], ["dishwasher is leaking", false],
  ];
  for (const [first, expect] of ruleCases) {
    await call(page, "Washer quit mid-cycle");
    await send(page, first); await settle(page);
    st = await W(page);
    if (!st.answers.problem) { await send(page, "I don't know"); await send(page, first); await settle(page); st = await W(page); }
    ok((st.priorityReasons.length > 0) === expect, `"${first}" → ${expect ? "PRIORITY" : "routine"} (got ${st.priorityReasons.length ? "PRIORITY" : "routine"})`);
  }
  await call(page, "Washer quit mid-cycle");
  await send(page, "hi there"); await chip(page, "Something else"); await settle(page);
  ok(/fridges, freezers, washers, dryers, stoves and dishwashers/.test((await lines(page)).slice(-1)[0]), "'Something else' lists only the real services");

  /* ---------- gas safety override ---------- */
  console.log("Gas safety override");
  const gasStarts = ["I smell gas from my stove", "there's a gas smell coming from the dryer", "it smells like rotten eggs by the stove"];
  for (const g of gasStarts) {
    await call(page, "Fridge not cooling");
    await send(page, g);
    await page.waitForSelector("#end:not([hidden])", { timeout: 8000 });
    const said = (await lines(page)).join("\n");
    t = await sms(page);
    ok(/leave the house now and call 911 or your gas utility/.test(said), `"${g}": tells caller to leave and call 911/gas utility`);
    ok(!/make and model|your name/.test(said), `"${g}": asks nothing else`);
    ok((await page.$eval("#smsBody .sms-banner", (e) => e.className + "|" + e.textContent)) === "sms-banner urgent|URGENT - Possible gas issue", `"${g}": red URGENT - Possible gas issue banner`);
    ok(/Priority: URGENT/.test(t) && /Next step: Caller told to leave the house/.test(t) && /Not taken \(call ended for safety\)/.test(t), `"${g}": urgent text fields`);
  }
  // mid-call and at the read-back
  await call(page, "Washer quit mid-cycle");
  await chip(page, "My washer quit in the middle of a cycle"); await chip(page, "Maytag top loader"); await chip(page, "Tom Reid");
  await send(page, "wait, I smell gas near the dryer");
  await page.waitForSelector("#end:not([hidden])", { timeout: 8000 });
  t = await sms(page);
  ok(/URGENT - Possible gas issue/.test(t) && /Caller: Tom Reid/.test(t), "gas mid-call overrides the flow and keeps what was captured");
  await call(page, "Washer quit mid-cycle");
  for (const a of ["My washer quit in the middle of a cycle", "I don't know", "Tom Reid", "9 Oxford St, London", "5195550186"]) await send(page, a);
  await settle(page);
  await send(page, "no, also there's a gas leak smell in the laundry room");
  await page.waitForSelector("#end:not([hidden])", { timeout: 8000 });
  ok(/URGENT - Possible gas issue/.test(await sms(page)), "gas at the read-back still overrides");
  // not gas emergencies
  for (const g of ["my gas stove won't light", "I don't smell gas, the dryer just won't spin", "the gas dryer is squeaking"]) {
    await call(page, "Washer quit mid-cycle");
    await send(page, g); await settle(page);
    st = await W(page);
    ok(!st.override && st.phase !== "done" && st.urgentReasons.length === 0, `"${g}" is not a gas emergency`);
  }

  /* ---------- guardrails ---------- */
  console.log("Guardrails");
  await call(page, "Fridge not cooling");
  await send(page, "Am I talking to a real person?"); await settle(page);
  const ai = (await lines(page)).find((l) => /AI receptionist/.test(l));
  ok(ai === "I'm an AI receptionist for NZ Systems. I take down your details and pass them straight to the team.", "AI answer exact, leads with the truth");
  await send(page, "How much do you charge? When can someone come out? What's wrong with it, is it the compressor?"); await settle(page);
  const said = (await lines(page)).join("\n");
  ok(/can't give prices/.test(said) && /can't promise an arrival or repair time/.test(said) && /can't diagnose it over the phone/.test(said), "price, time and diagnosis questions deflected");

  /* ---------- edit flow ---------- */
  await call(page, "Fridge not cooling");
  await chip(page, "My fridge stopped cooling last night and the food is warming up");
  for (const l of ["I don't know", "Priya Shah", "22 Birch Cres, London", "519-555-0172"]) await chip(page, l);
  await send(page, "the model is wrong"); await settle(page);
  ok((await W(page)).editing === "makeModel", "'the model is wrong' jumps to make/model");
  await send(page, "Whirlpool WRF555"); await settle(page);
  ok((await W(page)).phase === "confirm", "back to the read-back after the fix");

  /* ---------- Start over mid-call ---------- */
  await page.click("#restartTop");
  ok(await page.isVisible("#intro") && await page.isHidden("#call"), "restart arrow mid-call returns to the picker");
  ok(errors.length === 0, "no page errors: " + errors.join(" | "));
  await page.close();

  /* ---------- voice: unlocked on Call tap; blocked speech never stalls ---------- */
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
    await p.goto("file://" + FILE);   // real timing
    const t0 = Date.now();
    await p.click("#callBtn");
    const idle = () => p.waitForFunction(() => !document.getElementById("input").disabled || !document.getElementById("end").hidden, null, { timeout: 60000 });
    for (const l of ["My fridge stopped cooling last night and the food is warming up", "I don't know", "Priya Shah", "22 Birch Cres, London", "519-555-0172", "Yes, that's right"]) {
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
    await call(p, "Fridge not cooling");
    await chip(p, "My fridge stopped cooling last night and the food is warming up"); await settle(p);
    ok(await noOverflow(), `${width}px call: no horizontal scroll`);
    const small = await p.$$eval("button:not([hidden]), .pick", (n) => n.filter((b) => b.offsetParent !== null).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
    ok(small === 0, `${width}px: all tap targets ≥ 44px`);
    if (axeSource && width === 390) {
      for (const label of ["call"]) {
        await p.addScriptTag({ content: axeSource });
        const res = await p.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }));
        const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        ok(bad.length === 0, `axe (${label}): ` + bad.map((v) => v.id).join(", "));
      }
      for (const l of ["I don't know", "Priya Shah", "22 Birch Cres, London", "519-555-0172"]) await chip(p, l);
      await confirmAndEnd(p);
      await p.addScriptTag({ content: axeSource });
      const res = await p.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }));
      const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      ok(bad.length === 0, "axe (end screen): " + bad.map((v) => `${v.id} ${v.nodes[0].target}`).join(", "));
    }
    ok(e.length === 0, `${width}px no errors`);
    await p.close();
  }

  /* ---------- randomized stress ---------- */
  console.log(`Stress: ${RUNS} random calls`);
  const VALID = {
    greeting: ["my fridge stopped cooling", "my washer won't drain", "hello", "the freezer is warm", "my dishwasher is leaking", "stove won't heat", "I smell gas from the stove", "can you fix my dryer"],
    appliance: ["fridge", "washer", "stove", "freezer", "dishwasher", "dryer", "my microwave"],
    makeModel: ["no", "LG", "I don't know", "Samsung RF28"],
    problem: ["not cooling", "won't spin", "making a noise", "food is spoiling", "leaking water", "smells like gas"],
    name: ["Jo Park", "sam lee"], address: ["1 Oak St, London", "22 Birch Cres"],
    phone: ["5195550100", "519 555 0111", "(226) 555-0199"],
    followUp: ["a microwave", "a range hood"],
    confirm: ["yes", "yes", "no the address is wrong"], editPick: ["address", "name", "model"],
  };
  const JUNK = ["", "?", "<img src=x onerror=alert(1)>", "x".repeat(3000), "😀", "how much is it", "are you a robot", "when can you come", "what's wrong with it?"];
  let { page: sp, errors: se } = await newPage(browser);
  let done = 0, aborted = 0, prio = 0, urgent = 0;
  for (let run = 0; run < RUNS; run++) {
    await call(sp, rand() < 0.5 ? "Fridge not cooling" : "Washer quit mid-cycle");
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
    if (s.override) urgent++; else if (s.priorityReasons.length) prio++;
    const isCold = s.raw.appliance === "Fridge" || s.raw.appliance === "Freezer";
    ok(!s.priorityReasons.length || isCold, `run ${run}: PRIORITY only for fridge/freezer`);
    ok(s.override ? banner[0] === "URGENT - Possible gas issue" : s.priorityReasons.length ? banner[0] === "PRIORITY - Fridge/freezer, food spoilage risk" : banner.length === 0, `run ${run}: banner matches tier`);
    ok(new RegExp("Priority: " + (s.override ? "URGENT" : s.priorityReasons.length ? "Priority" : "Routine")).test(text), `run ${run}: priority line matches tier`);
    ok(s.urgentReasons.length === 0 || s.override === "Possible gas issue", `run ${run}: URGENT only from the gas rule`);
    const agentText = (await lines(sp)).join("\n");
    ok(!/\$\s?\d|\b\d+\s*(minutes?|hours?|days?)\b|\bwithin\b|\b24\/7\b/i.test(agentText), `run ${run}: no prices or times`);
    ok((await sp.$$eval("#chat img, #smsBody img", (n) => n.length)) === 0, `run ${run}: no injected HTML`);
    if (se.length) { fail(`run ${run}: ${se.join(" | ")}`); se.length = 0; }
  }
  console.log(`  ${done} completed (${prio} priority, ${urgent} gas urgent), ${aborted} restarted`);
  ok(done + aborted === RUNS, `every call finished or was restarted on purpose (${done}+${aborted}/${RUNS})`);
  await sp.close();

  /* ---------- deploy bundle includes NZ ---------- */
  const dist = path.resolve(__dirname, "..", "dist", "_worker.js");
  if (fs.existsSync(dist)) {
    const w = (await import("file://" + dist)).default;
    const res = await w.fetch(new Request("https://x.pages.dev/demos/ai-receptionist/nz-systems/"));
    ok(res.status === 200 && /NZ Systems · AI Receptionist Demo/.test(await res.text()), "deploy bundle serves /demos/ai-receptionist/nz-systems/");
  }

  await browser.close();
  console.log(`\n${passes} checks passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
  function fail(m) { failures++; console.log("  ✗ " + m); }
})().catch((e) => { console.error(e); process.exit(1); });
