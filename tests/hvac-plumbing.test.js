#!/usr/bin/env node
/*
 * Tests for Comfort Living HVAC and Salliss Plumbing (same harness as tests/batch-demos.test.js,
 * plus checks specific to these two).
 *
 *   node tests/hvac-plumbing.test.js           # both, 20 random calls each
 *
 * For each demo: business details, greeting, both scenarios end to end (banner, Priority and
 * Next step lines on the text mockup), AI / price / timing / DIY answers, negative and positive
 * escalation checks, Start over, end-screen focus, voice start-up, and a short randomized run.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const RUNS = Number(process.argv[2] || 20);
const ONLY = process.argv.slice(3);
const DIR = path.resolve(__dirname, "..", "demos/ai-receptionist");
const FOOTER = "Demo only. Nothing is saved, and typed answers never leave your browser.";
const HOWTO = /\b(reset (the|your) breaker|flip (the|your) breaker|turn (off|on) the (main|breaker|gas)|unplug|relight|tarp it|go up on the roof and|climb (up|the)|cut it (down|off) (yourself|with)|pull (it|the limb) down|step (1|one)|first,? (turn|unplug|switch|remove))\b/i;

// Per-demo expectations. `p` = priority scenario, `r` = routine scenario.
// choices: answers to tap for choice/multi questions (samples cover the text questions).
const SPEC = {
  "comfort-living-hvac": { who: "Yunus",
    p: { title: "No heat on a cold evening", choices: { outFor: "A few hours", vulnerable: "Yes" }, banner: "URGENT - No heat", priority: "URGENT", next: "Yunus gets this summary as a text right away." },
    r: { title: "Tune-up or new system quote", choices: {}, banner: null, priority: "Routine", next: "Yunus calls back to arrange a time." },
    neg: [["How much does it cost when the furnace stops and there's no heat?"], ["Do you fix furnaces that have no heat?"], ["furnace"], ["My mom is elderly"], ["I'd like a tune-up", "Alan Price"]],
    pos: [[["The furnace isn't working and the house is getting cold"], "urgent"], [["I smell gas near the furnace"], "critical"], [["Our carbon monoxide alarm is going off"], "critical"]],
    diy: "Should I relight the pilot light?" },
  "salliss-plumbing": { who: "Marty",
    p: { title: "Burst pipe on a Tuesday", choices: { running: "Yes, still running", shutOff: "No, couldn't shut it off" }, banner: "URGENT - Water still running, water not shut off", priority: "URGENT", next: "Marty gets this summary as a text right away." },
    r: { title: "Water heater quote", choices: {}, banner: null, priority: "Routine", next: "Marty calls back to arrange the quote." },
    neg: [["How much does it cost to fix a burst pipe that's still running?"], ["Do you handle burst pipes?"], ["pipe"], ["A pipe burst", "Basement", "Is it bad if it's still running?"], ["I'd like a water heater quote", "Alan Price"]],
    pos: [[["A pipe burst and the water is still running"], "urgent"], [["A pipe burst", "Basement", "No, it's stopped", "Yes, I shut it off"], "priority"], [["A pipe burst", "Basement", "No, it's stopped", "Not sure"], "urgent"]],
    diy: "How do I fix a burst pipe myself?" },
};

let failures = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { failures++; console.log("  ✗ " + m); } };
let seed = Number(process.env.SEED || 777);
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rand() * a.length)];

(async () => {
  const browser = await chromium.launch();
  const slugs = Object.keys(SPEC).filter((s) => !ONLY.length || ONLY.includes(s));
  const results = {};
  for (const slug of slugs) {
    const before = failures;
    console.log(`\n${slug}`);
    try { await testDemo(browser, slug, SPEC[slug]); } catch (e) { failures++; console.log("  ✗ crashed: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")); }
    results[slug] = failures === before ? "PASS" : `FAIL (${failures - before})`;
  }
  await browser.close();
  console.log("\nSummary");
  for (const [s, r] of Object.entries(results)) console.log(`  ${r.padEnd(10)} ${s}`);
  console.log(`\n${passes} checks passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})();

async function testDemo(browser, slug, spec) {
  const FILE = path.join(DIR, slug, "index.html");
  const html = fs.readFileSync(FILE, "utf8");
  const content = html.slice(0, html.indexOf("Engine — generic"));
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("dialog", async (d) => { errors.push("dialog: " + d.message()); await d.dismiss(); });
  await page.addInitScript(() => { try { localStorage.setItem("receptionist-voice", "0"); } catch (e) {} });
  const URL = "file://" + FILE + "?fast";
  await page.goto(URL);
  const cfg = await page.evaluate(() => ({ business: window.__receptionist.config.business, scenarios: window.__receptionist.config.scenarios.map((s) => ({ id: s.id, title: s.title, samples: s.samples || {}, suggestions: s.suggestions })) }));
  const NAME = cfg.business.shortName;

  const settle = () => page.waitForFunction(() => {
    if (!document.getElementById("end").hidden) return true;
    const s = window.__receptionist && window.__receptionist.state();
    return s && !s.busy && s.phase !== "intro" && !document.getElementById("input").disabled;
  }, null, { timeout: 8000 });
  const W = () => page.evaluate(() => window.__receptionist.state());
  const lines = () => page.$$eval("#chat .row.agent .bubble", (n) => n.map((x) => x.innerText));
  const chip = async (l) => { await settle(); await page.click(`.chip:text-is(${JSON.stringify(l)})`); };
  const send = async (t) => { await settle(); await page.fill("#input", t); await page.press("#input", "Enter"); };
  async function call(title) {
    if (!(await page.isVisible("#intro"))) await page.click(await page.isVisible("#restartEnd") ? "#restartEnd" : "#restartTop");
    await page.click(`.pick:has-text(${JSON.stringify(title)})`);
    await page.click("#callBtn"); await settle();
  }
  const tierOf = (s) => (s.override ? "critical" : s.urgentReasons.length ? "urgent" : s.priorityReasons.length ? "priority" : "routine");

  /* ---- details ---- */
  ok((await page.innerText("#introName")) === cfg.business.name, "intro shows the business name");
  ok((await page.innerText("#callBtn")).includes("Call " + cfg.business.phone), `Call button shows ${cfg.business.phone}`);
  ok((await page.innerText(".fineprint")) === FOOTER, "footer exact");
  ok(/<meta name="robots" content="noindex, nofollow">/.test(html), "noindex tag");
  ok(!/24\/7|24 hours|around the clock/i.test(html), "no 24/7 text anywhere");
  ok(!/\$\s?\d/.test(content), "no prices in the config");
  ok(!/\b(guarantee\w*|warrant\w*|since (19|20)\d\d|years? in business)\b/i.test(content), "no invented guarantees or years in business");
  if (slug === "floorsource") ok(!/\b(solo|independent|one-person|owner-operated)\b/i.test(content), "FloorSource not described as a solo independent shop");
  const titles = await page.$$eval(".pick .t", (n) => n.map((x) => x.textContent));
  ok(titles.includes(spec.p.title) && titles.includes(spec.r.title) && titles.length === 2, "picker shows the two scenarios");

  /* ---- both scenarios end to end ---- */
  for (const which of ["p", "r"]) {
    const sc = spec[which];
    const scCfg = cfg.scenarios.find((s) => s.title === sc.title);
    await call(sc.title);
    const greet = (await lines())[0];
    ok(greet.startsWith(`Thanks for calling ${NAME}, this is Ava.`) && greet.endsWith("How can I help?"), `[${which}] greeting uses ${NAME}`);
    await chip(scCfg.suggestions[0]);
    for (let i = 0; i < 20; i++) {
      await settle();
      if (await page.isVisible("#end")) break;
      const s = await W();
      if (s.phase === "confirm") { await chip("Yes, that's right"); continue; }
      const key = s.phase === "step" ? await page.evaluate(() => window.__receptionist.steps()[window.__receptionist.state().idx].key) : s.phase;
      const chips = await page.$$eval(".chip", (n) => n.map((x) => ({ t: x.textContent, on: x.getAttribute("aria-pressed") === "true", primary: x.classList.contains("primary") })));
      const want = sc.choices[key];
      if (chips.some((c) => c.primary)) {          // multi-select
        for (const l of want || []) if (!chips.find((c) => c.t === l && c.on)) await page.click(`.chip:text-is(${JSON.stringify(l)})`);
        for (const c of chips) if (c.on && !(want || []).includes(c.t)) await page.click(`.chip:text-is(${JSON.stringify(c.t)})`);
        await page.click(".chip.primary");
      } else if (want) await chip(want);
      else if (scCfg.samples[key] && chips.find((c) => c.t === scCfg.samples[key])) await chip(scCfg.samples[key]);
      else { ok(false, `[${which}] no answer planned for "${key}" (chips: ${chips.map((c) => c.t).join(", ")})`); break; }
    }
    await page.waitForSelector("#end:not([hidden])", { timeout: 8000 }).catch(() => {});
    if (!(await page.isVisible("#end"))) {
      const s = await W();
      ok(false, `[${which}] call did not reach the text mockup (phase ${s.phase}, step ${s.idx}, last: ${(await lines()).slice(-1)[0]})`);
      continue;
    }
    const t = await page.innerText("#smsBody");
    ok((await page.innerText("#smsTitle")) === `Text to ${NAME}`, `[${which}] mockup titled "Text to ${NAME}"`);
    ok((await page.innerText("#smsSub")).includes(cfg.business.phone), `[${which}] mockup shows the business number`);
    const banners = await page.$$eval("#smsBody .sms-banner", (n) => n.map((x) => x.textContent));
    ok(sc.banner ? banners[0] === sc.banner : banners.length === 0, `[${which}] banner ${sc.banner ? `"${sc.banner}"` : "absent"} (got ${banners.join(" | ") || "none"})`);
    ok(new RegExp(`Priority: ${sc.priority}\\n`).test(t), `[${which}] Priority: ${sc.priority}`);
    ok(t.includes(`Next step: ${sc.next}`), `[${which}] Next step: ${sc.next}`);
    ok(!(await lines()).some((l) => /Priority:|Next step:/.test(l)), `[${which}] read-back has no priority/next-step lines`);
    ok((await page.evaluate(() => document.activeElement.id)) === "endTitle", `[${which}] end heading takes focus`);
    await page.keyboard.press("Enter");
    ok(await page.isVisible("#end"), `[${which}] stray Enter does nothing`);
    await page.click("#restartEnd");
    ok(await page.isVisible("#intro") && await page.isHidden("#end"), `[${which}] Start over returns to the picker`);
  }

  /* ---- AI, price, timing, DIY answers ---- */
  await call(spec.p.title);
  await send("Am I talking to a real person?"); await settle();
  ok((await lines()).includes(`I'm an AI receptionist for ${NAME}. I take down your details and pass them straight to ${spec.who}.`), "AI answer exact");
  await send("How much do you charge?"); await settle();
  let said = await lines();
  ok(said.some((l) => /^I can't give prices over the phone/.test(l)), "price question answered with the standard line");
  await send("When can someone come out?"); await settle();
  ok((await lines()).some((l) => /^I can't promise an arrival or appointment time/.test(l)), "timing question: no promise");
  await send(spec.diy); await settle();
  said = await lines();
  ok(said.some((l) => /don't try to|can't give (how-to|troubleshooting)|can't walk you through repairs/i.test(l)), `DIY question gets no advice: "${spec.diy}"`);
  ok(!said.some((l) => HOWTO.test(l)), "no how-to or troubleshooting steps in any reply");
  let st = await W();
  ok(tierOf(st) === "routine", "questions alone never set the priority");
  await page.click("#restartTop");
  ok(await page.isVisible("#intro"), "restart arrow mid-call returns to the picker");

  /* ---- negative escalation: questions and bare keywords ---- */
  for (const sayList of spec.neg) {
    for (const scTitle of [spec.p.title, spec.r.title]) {
      await call(scTitle);
      for (const t of sayList) await send(t);
      await settle();
      st = await W();
      ok(tierOf(st) === "routine" && (await page.isHidden("#urgentPill")), `[${scTitle}] does NOT escalate: ${JSON.stringify(sayList)} (got ${tierOf(st)}: ${[...st.urgentReasons, ...st.priorityReasons].join(", ")})`);
    }
  }
  /* ---- positive escalation ---- */
  for (const [sayList, expect] of spec.pos) {
    await call(spec.r.title);
    for (const t of sayList) { if (await page.isVisible("#end")) break; await send(t); }
    await settle();
    st = await W();
    ok(tierOf(st) === expect, `escalates to ${expect}: ${JSON.stringify(sayList)} (got ${tierOf(st)})`);
    if (expect === "critical") {
      await page.waitForSelector("#end:not([hidden])", { timeout: 8000 });
      const t = await page.innerText("#smsBody");
      ok(/CRITICAL - /.test(t) && /Priority: CRITICAL/.test(t), "critical text: red CRITICAL banner and Priority: CRITICAL");
      ok((await lines()).some((l) => /leave the house now and call 911 or your gas utility/.test(l)), "critical: told to leave and call 911 or the gas utility");
    }
  }

  /* ---- checks specific to these two demos ---- */
  const visible = async () => (await page.innerText("body"));
  ok(!/\b(monday|wednesday|friday|9 to 5|9-5|premium|call-out fee|fee)\b|@[a-z0-9.-]+\.[a-z]{2,}/i.test(content.split("\n").filter((l) => !/match:|unless:/.test(l)).join("\n")), "no hours, fees or email in the config text");
  // Alan Price can give his name without the price answer
  await call(spec.r.title);
  await chip(cfg.scenarios.find((s) => s.title === spec.r.title).suggestions[0]);
  for (let i = 0; i < 6; i++) {
    await settle();
    const s = await W();
    const key = s.phase === "step" ? await page.evaluate(() => window.__receptionist.steps()[window.__receptionist.state().idx].key) : s.phase;
    if (key === "name") break;
    const chips = await page.$$eval(".chip:not([disabled])", (n) => n.map((x) => x.textContent));
    await chip(chips[0]);
  }
  await send("Alan Price"); await settle();
  st = await W();
  ok(st.answers.name === "Alan Price", `Alan Price gives his name (recorded: ${st.answers.name})`);
  ok(!(await lines()).some((l) => /can't give prices/.test(l)), "Alan Price gets no price answer");
  ok(tierOf(st) === "routine", "Alan Price doesn't change the priority");

  if (slug === "comfort-living-hvac") {
    // vulnerable occupants recorded in their own field
    await call(spec.p.title);
    await chip("Our furnace stopped and the house is getting cold"); await chip("A few hours");
    await send("yes, my grandmother lives with us"); await settle();
    st = await W();
    ok(st.answers.vulnerable === "YES" && tierOf(st) === "urgent", "vulnerable occupants recorded (YES), call stays URGENT");
    for (const a of ["Hana Brooks", "42 Wellington Road, London", "519-555-0261"]) await chip(a);
    await chip("Yes, that's right"); await page.waitForSelector("#end:not([hidden])");
    let t = await page.innerText("#smsBody");
    ok(/Vulnerable occupants: YES/.test(t) && /Out for: A few hours/.test(t) && /What happened: Our furnace stopped/.test(t), "summary has What happened, Out for and Vulnerable occupants");
    // CRITICAL mid-scenario: intake stops, fields marked not taken
    await call(spec.p.title);
    await chip("Our furnace stopped and the house is getting cold"); await chip("A few hours");
    await send("wait, the CO alarm just went off");
    await page.waitForSelector("#end:not([hidden])", { timeout: 8000 });
    t = await page.innerText("#smsBody");
    const said = await lines();
    ok(said.includes("If a carbon monoxide alarm is going off or you smell gas, please leave the house now and call 911 or your gas utility from outside."), "CRITICAL: leave the house, call 911 or the gas utility");
    const after = said.slice(said.findIndex((l) => /^If a carbon monoxide alarm/.test(l)));
    ok(after.length === 2 && !after.some((l) => /\?$/.test(l)), `CRITICAL: intake stops, no further questions (after: ${after.join(" / ")})`);
    ok((await page.$eval("#smsBody .sms-banner", (e) => e.textContent)) === "CRITICAL - Carbon monoxide or gas" && /Priority: CRITICAL/.test(t), "CRITICAL banner and Priority line");
    ok(/Caller: Not taken \(call ended for safety\)/.test(t) && /Number: Not taken/.test(t) && /Vulnerable occupants: Not taken/.test(t), "intake fields marked not taken");
    ok(/Next step: Caller told to leave the house and call 911 or the gas utility/.test(t), "CRITICAL next step");
  }

  if (slug === "salliss-plumbing") {
    const LINE = "If you already know where your main water shut-off is, closing it will limit the damage.";
    // URGENT: the one allowed safety line, once, and nothing else how-to
    await call(spec.p.title);
    await chip("A pipe burst in our basement and there's water everywhere"); await chip("Basement, by the laundry");
    await chip("Yes, still running"); await settle();
    let said = await lines();
    ok(said.some((l) => l === "I'm marking this call URGENT so Marty sees it first. " + LINE), "URGENT message adds the one shut-off safety line");
    ok(said.filter((l) => l.includes("shut-off")).length === 1, "the shut-off line appears once");
    ok(!said.some((l) => /\b(turn|twist|rotate|clockwise|lefty|wrench|valve handle|step)\b/i.test(l)), "no other how-to");
    // PRIORITY: stopped and shut off
    await call(spec.p.title);
    await chip("A pipe burst in our basement and there's water everywhere"); await chip("Basement, by the laundry");
    await chip("No, it's stopped"); await chip("Yes, it's shut off");
    for (const a of ["Dina Ross", "77 Oakland Avenue, London", "519-555-0271"]) await chip(a);
    await chip("Yes, that's right"); await page.waitForSelector("#end:not([hidden])");
    let t = await page.innerText("#smsBody");
    ok((await page.$eval("#smsBody .sms-banner", (e) => e.className + "|" + e.textContent)) === "sms-banner priority|PRIORITY - Water shut off and contained", "contained leak: amber PRIORITY banner");
    ok(/Priority: Priority/.test(t) && /Next step: Marty gets this summary as a text right away\./.test(t) && /Water still running: No/.test(t) && /Shut off: Yes/.test(t), "contained leak: Priority line, next step and fields");
    ok(!(await lines()).some((l) => l.includes("shut-off")), "contained leak: no shut-off line needed");
    ok((await page.innerText("#smsStamp")) === "Tuesday 10:25 AM", "burst-pipe text stamped Tuesday");
    // where's the shut-off? -> only the allowed line
    await call(spec.p.title);
    await send("Where's my main shut-off valve?"); await settle();
    said = await lines();
    ok(said.includes(`I can't walk you through repairs over the phone. ${LINE} Marty will take care of the rest.`), "shut-off location question: allowed line only");
  }

  /* ---- voice: unlocked on the Call tap; blocked speech never stalls ---- */
  for (const mode of ["gesture", "blocked"]) {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.addInitScript((m) => {
      window.__spoken = []; window.__primed = false; let unlocked = false;
      const synth = { speaking: false, pending: false, getVoices: () => [{ name: "T", lang: "en-CA" }], addEventListener() {}, resume() {}, cancel() { this.speaking = false; },
        speak(u) {
          if (navigator.userActivation && navigator.userActivation.isActive) { unlocked = true; window.__primed = true; }
          if (m === "blocked" || !unlocked) { this.pending = true; return; }
          window.__spoken.push(u.text); this.speaking = true;
          setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => { this.speaking = false; u.onend && u.onend(); }, 30);
        } };
      Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    }, mode);
    await p.goto(URL);
    const t0 = Date.now();
    await p.click("#callBtn");
    await p.waitForFunction(() => !document.getElementById("input").disabled, null, { timeout: 20000 });
    const r = await p.evaluate(() => ({ primed: window.__primed, spoken: window.__spoken.filter((x) => x.trim()) }));
    ok(r.primed, `voice (${mode}): speech unlocked on the Call tap`);
    if (mode === "gesture") ok(/this is Ava/.test(r.spoken[0] || ""), "voice: greeting is spoken");
    else ok(Date.now() - t0 < 5000, `voice (blocked): greeting didn't stall (${Date.now() - t0}ms)`);
    await p.close();
  }

  /* ---- randomized calls ---- */
  const JUNK = ["", "?", "<img src=x onerror=alert(1)>", "x".repeat(2000), "😀", "how much is it", "are you a robot", "when can you come", "what's wrong with it?", spec.diy];
  let done = 0, aborted = 0;
  for (let run = 0; run < RUNS; run++) {
    await call(rand() < 0.5 ? spec.p.title : spec.r.title);
    let ended = false;
    for (let i = 0; i < 70; i++) {
      try { await settle(); } catch (e) { const s = await W().catch(() => ({})); ok(false, `random call ${run}: stuck (phase ${s.phase}, busy ${s.busy})`); break; }
      if (await page.isVisible("#end")) { ended = true; break; }
      const r = rand();
      if (r < 0.03) { await page.click("#restartTop"); aborted++; break; }
      if (r < 0.15) { await page.fill("#input", pick(JUNK)); await page.press("#input", "Enter"); continue; }
      const chips = await page.$$eval(".chip:not([disabled])", (n) => n.map((x) => x.textContent));
      if (chips.length && rand() < 0.7) await page.click(`.chip:text-is(${JSON.stringify(pick(chips))})`);
      else await send(pick(["yes", "no", "not sure", "Jo Park", "1 Main Street", "5195550100", "next month", "mornings", "it's leaking", "it stopped working"]));
    }
    if (!ended) { if (await page.isVisible("#call") && !(await page.isVisible("#intro"))) { const s = await W(); if (s.phase !== "intro") ok(false, `random call ${run}: still going after 70 actions (phase ${s.phase})`); } continue; }
    done++;
    st = await W();
    const t = await page.innerText("#smsBody");
    const banners = await page.$$eval("#smsBody .sms-banner", (n) => n.map((x) => x.textContent));
    const tier = tierOf(st);
    ok(tier === "routine" ? banners.length === 0 || /STORM/.test(banners[0]) : banners.length === 1, `random call ${run}: banner matches ${tier}`);
    ok(/Priority: \S/.test(t) && /Next step: \S/.test(t), `random call ${run}: Priority and Next step lines present`);
    const all = (await lines()).join("\n");
    ok(!/\$\s?\d|\b\d+\s*(minutes?|hours?|days?)\b|\bwithin \d|\b24\/7\b/i.test(all), `random call ${run}: no prices or times`);
    ok(!HOWTO.test(all), `random call ${run}: no how-to`);
    ok((await page.$$eval("#chat img, #smsBody img", (n) => n.length)) === 0, `random call ${run}: no injected HTML`);
  }
  ok(done + aborted === RUNS, `random calls all finished or restarted (${done}+${aborted}/${RUNS})`);
  ok(errors.length === 0, "no page errors: " + errors.slice(0, 3).join(" | "));
  await page.close();
}
