#!/usr/bin/env node
/*
 * Tests for the batch of 14 receptionist demos built on the shared engine.
 *
 *   node tests/batch-demos.test.js            # all 14, 20 random calls each
 *   node tests/batch-demos.test.js 40 rosco-electric jackson-electric
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
  "silver-concrete": { who: "Frank",
    p: { title: "Ready-to-book driveway", choices: { timeline: "Within the next month" }, banner: "PRIORITY - Ready-to-book quote", priority: "Priority", next: "Frank calls back to arrange the site visit" },
    r: { title: "Patio question", choices: { timeline: "Later, or not sure yet" }, banner: null, priority: "Routine", next: "Frank calls back about the project" },
    neg: [["How soon could you start a driveway next month?"], ["Do you do driveways?"], ["driveway"], ["I want a driveway", "Could you start within the next month?"]],
    pos: [[["I want a quote on a driveway", "14 Cedar Lane, Komoka", "Not sure", "We want to start within the next month"], "priority"]],
    diy: "How do I patch a crack in my driveway myself?" },
  "jackson-electric": { who: "the team",
    p: { title: "No heat, kids at home", choices: {}, banner: "URGENT - No heat, children in the home", priority: "URGENT", next: "Flagged for an emergency callback" },
    r: { title: "Service enquiry", choices: {}, banner: null, priority: "Routine", next: "Call back next business day" },
    neg: [["Do you fix furnaces when there's no heat?"], ["My kids are home today"], ["Is it bad if the furnace makes a burning smell?"], ["I need a new CO detector installed"], ["Do you test for carbon monoxide?"]],
    pos: [[["The furnace isn't working and it's freezing in here"], "urgent"], [["There are sparks coming from an outlet"], "urgent"], [["Our carbon monoxide alarm is going off"], "critical"], [["I smell gas near the furnace"], "critical"]],
    diy: "Should I reset the breaker?" },
  "apes-tree-service": { who: "the team",
    p: { title: "Dead tree leaning", choices: { threatens: ["House"], powerLines: "No lines involved", injuries: "No one is hurt" }, banner: "URGENT - Threatening a house", priority: "URGENT", next: "Call back as soon as possible" },
    r: { title: "Removal quote", choices: { threatens: ["Neither"], powerLines: "No lines involved", injuries: "No one is hurt" }, banner: null, priority: "Routine", next: "Call back to arrange the quote" },
    neg: [["How much to remove a dead tree near the house?"], ["There's a tree by my house"], ["Do power lines make removal harder?"]],
    pos: [[["A tree came down on the power lines"], "urgent"], [["A dead tree is leaning", "the house"], "urgent"]],
    diy: "Should I cut it down myself?" },
  "conservatree": { who: "Alex",
    p: { title: "Storm-damaged limb", choices: { hazards: ["Driveway"], powerLines: "No lines involved", bestTime: "Mornings" }, banner: "URGENT - Storm-damaged limb over a house, driveway or car", priority: "URGENT", next: "Alex calls back as soon as possible" },
    r: { title: "Book a tree visit", choices: { hazards: ["None of those"], powerLines: "No lines involved", bestTime: "Afternoons" }, banner: null, priority: "Routine", next: "Alex calls back to book the visit" },
    neg: [["Does storm damage get priority?"], ["There's a limb over our driveway"], ["I'd like pruning", "Front yard", "the driveway"]],
    pos: [[["The storm snapped a big branch", "Back yard", "the house"], "urgent"]],
    diy: "Can I pull it down myself?" },
  "jackson-renovations": { who: "Jeff",
    p: { title: "Kitchen, ready to start", choices: { timeline: "Within the next two months", times: "Weekday mornings" }, banner: "PRIORITY - Consultation request", priority: "Priority", next: "Jeff calls back to set up the consultation" },
    r: { title: "Bathroom idea", choices: { timeline: "No timeline yet", times: "Evenings" }, banner: null, priority: "Routine", next: "Jeff calls back to talk through the idea" },
    neg: [["Could you start a kitchen within two months?"], ["kitchen"], ["A kitchen", "New cabinets", "3 Front Street", "How soon could you start?"]],
    pos: [[["A kitchen", "New cabinets", "3 Front Street", "We'd like to start in the next two months"], "priority"]],
    diy: "How do I fix a leaky faucet myself?" },
  "waynes-dridek-and-roofing": { who: "Wayne",
    p: { title: "Roof leaking in the rain", choices: {}, banner: "PRIORITY - Active leak", priority: "Priority", next: "Wayne calls back about the leak as soon as Wayne's off the roof" },
    r: { title: "Free roof quote", choices: {}, banner: null, priority: "Routine", next: "Wayne calls back to arrange the free quote" },
    neg: [["Do you fix roof leaks?"], ["We had a leak last year and want a quote"], ["Is a sagging ceiling dangerous?"], ["roof"]],
    pos: [[["Our roof is leaking", "Water is dripping from the ceiling light"], "urgent"], [["The roof is leaking and the ceiling is sagging"], "urgent"], [["Water is coming in through the ceiling"], "priority"]],
    diy: "Should I get up on the roof and tarp it?" },
  "rosco-electric": { who: "the team",
    p: { title: "Business losing power", choices: { category: "Power outage or repair" }, banner: "PRIORITY - Business power outage", priority: "Priority", next: "Priority callback about the outage" },
    r: { title: "Service upgrade question", choices: { category: "Service upgrade" }, banner: null, priority: "Routine", next: "Call back to discuss the work" },
    neg: [["Do you handle outages for businesses?"], ["We run a business"], ["Is a burning smell from a panel dangerous?"]],
    pos: [[["There's smoke coming from our electrical panel"], "urgent"], [["We have exposed wires hanging in the hallway"], "urgent"]],
    diy: "Should I reset the breaker?" },
  "radiant-electric": { who: "the team",
    p: { title: "Facility issue", choices: { urgency: "Affecting operations now" }, banner: "PRIORITY - Facility issue", priority: "Priority", next: "Priority callback about the facility issue" },
    r: { title: "Solar enquiry", choices: { urgency: "Just planning" }, banner: null, priority: "Routine", next: "Call back about the enquiry" },
    neg: [["Do you do facility maintenance?"], ["We have a facility"], ["Is sparking dangerous?"]],
    pos: [[["There are exposed wires hanging from the ceiling at our plant"], "urgent"], [["Our breaker panel is sparking"], "urgent"]],
    diy: "Should I reset the breaker?" },
  "otter-creek-construction": { who: "the team",
    p: { title: "Book a consultation", choices: { times: "Weekday mornings" }, banner: "PRIORITY - Consultation request", priority: "Priority", next: "Otter Creek calls back to confirm a time" },
    r: { title: "Early question", choices: { times: "Not ready to book yet" }, banner: null, priority: "Routine", next: "Otter Creek calls back to answer the question" },
    neg: [["Are consultations free?"], ["A basement", "Finish it", "2 Main St", "Do you do evening consultations?"], ["consultation"]],
    pos: [[["A basement", "Finish it", "2 Main St", "Weekday evenings work"], "priority"]],
    diy: "How do I frame a wall myself?" },
  "jonkers-lawn-care": { who: "the team",
    p: { title: "Fall clean-up booking", choices: { timing: "As soon as possible" }, banner: "PRIORITY - Booking request", priority: "Priority", next: "Call back to book the work" },
    r: { title: "Interlock for next season", choices: { timing: "Next season" }, banner: null, priority: "Routine", next: "Call back about the project" },
    neg: [["How soon can you do a fall clean-up?"], ["fall clean-up"], ["A fall clean-up", "40 Dundas Street", "Jo Park", "5195550100", "How soon can you come?"]],
    pos: [[["A fall clean-up", "40 Dundas Street", "Jo Park", "5195550100", "As soon as possible please"], "priority"]],
    diy: "How do I lay sod myself?" },
  "moore-flooring-and-design": { who: "the team",
    p: { title: "Sunday quote request", choices: { timeline: "Within a month" }, banner: "PRIORITY - Quote request", priority: "Priority", next: "First call when the shop opens Monday" },
    r: { title: "Product question", choices: {}, banner: null, priority: "Routine", next: "Call back about the product" },
    neg: [["How much is a quote for new flooring?"], ["Do you install hardwood?"], ["Do you have vinyl plank in stock?"]],
    pos: [[["We need new flooring in the kitchen"], "priority"]],
    diy: "How do I install laminate myself?" },
  "painting-in-a-nutshell": { who: "Sandy",
    p: { title: "Free estimate request", choices: { times: "Weekday mornings" }, banner: "PRIORITY - Estimate request", priority: "Priority", next: "Sandy calls back to book the free estimate" },
    r: { title: "Interior question", choices: { times: "Just have a question for now" }, banner: null, priority: "Routine", next: "Sandy calls back to answer the question" },
    neg: [["Are estimates free?"], ["estimate"], ["Exterior", "Siding", "21 Wortley Road", "Can Sandy come Tuesday morning?"]],
    pos: [[["Exterior", "Siding", "21 Wortley Road", "Tuesday mornings work"], "priority"]],
    diy: "How do I paint my trim myself?" },
  "ultimate-touch-concrete": { who: "the team",
    p: { title: "Driveway quote this season", choices: { timeline: "This season" }, banner: "PRIORITY - Quote request", priority: "Priority", next: "Call back to arrange the free quote" },
    r: { title: "Walkway question", choices: { timeline: "Not sure yet" }, banner: null, priority: "Routine", next: "Call back about the project" },
    neg: [["Can you pour a driveway this season?"], ["driveway"], ["A driveway", "12 Huron", "Not sure", "Could it be done this season?"]],
    pos: [[["A driveway", "12 Huron", "Not sure", "This season please"], "priority"]],
    diy: "How do I seal my driveway myself?" },
  "floorsource": { who: "the team",
    p: { title: "Consultation after closing", choices: { times: "Evenings" }, banner: "PRIORITY - Consultation request", priority: "Priority", next: "FloorSource calls back the next business day" },
    r: { title: "Product question", choices: {}, banner: null, priority: "Routine", next: "Call back the next business day about the product" },
    neg: [["Do you offer free consultations?"], ["How much is a consultation for new flooring?"], ["Do you carry waterproof laminate?"]],
    pos: [[["I'd like a consultation for new hardwood flooring"], "priority"]],
    diy: "How do I install vinyl plank myself?" },
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
  ok(said.some((l) => /don't try to|can't give (how-to|troubleshooting)|don't go up on the roof/i.test(l)), `DIY question gets no advice: "${spec.diy}"`);
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
