#!/usr/bin/env node
/*
 * Test + stress suite for the AI receptionist demos.
 *
 *   node tests/receptionist.test.js                      # default demo, 300 random calls
 *   node tests/receptionist.test.js 1000                 # more random calls
 *   node tests/receptionist.test.js 300 demos/ai-receptionist/<client>/index.html
 *
 * Needs Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`).
 * The page is loaded with ?fast so the receptionist's typing delays are skipped.
 */
const path = require("path");
const { chromium } = require("playwright");

const RUNS = Number(process.argv[2] || 300);
const DEMO = path.resolve(__dirname, "..", process.argv[3] || "demos/ai-receptionist/clc-tree-services/index.html");
const URL = "file://" + DEMO + "?fast";
const LANDING = "file://" + path.resolve(__dirname, "..", "index.html");

let failures = 0, passes = 0;
const fail = (msg) => { failures++; console.log("  ✗ " + msg); };
const ok = (cond, msg) => { if (cond) passes++; else fail(msg); };

// Deterministic pseudo-random so failures are reproducible (seed via SEED=…)
let seed = Number(process.env.SEED || 12345);
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rand() * a.length)];

const JUNK = [
  "", "   ", "?", "a", "asdf", "x".repeat(5000), "<img src=x onerror=alert(1)>", "<script>alert(1)</script>",
  "😀🌲⚡", "'; DROP TABLE calls;--", "null", "undefined", "‮evil", "123", "..."
];
const GUARDS = [
  "how much will this cost", "are you a robot?", "when will you get here", "is it safe to cut it myself?",
  "Is this a real person", "can you give me a quote", "how soon can someone come out"
];
const VALID = {
  greeting: ["A tree came down", "hello", "hi I need help", "the power lines are down and someone is hurt", "a big limb fell on my car",
             "I'd like a free estimate", "can someone prune my maples", "I need a dead tree removed", "do you sell firewood"],
  incident: ["a big branch came down", "tree is leaning on the garage", "Tree fell over", "there's a crack in the trunk"],
  damage: ["the house", "my car", "nothing", "it hit the fence", "neither"],
  powerLines: ["no", "yes", "not sure", "the lines are down", "none", "I don't know"],
  injuries: ["no", "yes", "nobody is hurt", "my son is hurt", "no one is hurt"],
  service: ["pruning", "removal", "my oak looks sick", "firewood", "I need advice on a permit"],
  details: ["two maples over the driveway", "one big oak", "a row of cedars"],
  bestTime: ["mornings", "after 5", "any time", "weekends"],
  name: ["Jane Doe", "bob smith", "My name is Priya Patel", "O'Neil-Ramírez"],
  address: ["12 Oak St, London", "45 King St", "100 Elm Rd N6A 1B2", "22 Pine Cres, Strathroy"],
  phone: ["519-555-0199", "(226) 555 0100", "1 519 555 0123", "five one nine five five five zero one two three"],
  backup: ["no", "My wife Ana 519 555 0111", "No, just me", "my neighbour Tom"],
  followUp: ["a stump is rotting", "roots lifting the driveway"],
  confirm: ["yes", "yes", "yep that's right", "no the address is wrong", "something's wrong"],
  editPick: ["address", "name", "phone", "backup", "best time"],
};

async function newPage(browser, viewport = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", async (d) => { errors.push("dialog opened (possible XSS): " + d.message()); await d.dismiss(); });
  await page.addInitScript(() => { try { localStorage.setItem("receptionist-voice", "0"); } catch (e) {} });
  await page.goto(URL);
  return { page, errors };
}

// Wait until the call is ready for input, or the end screen is showing.
async function settle(page) {
  await page.waitForFunction(() => {
    const end = document.getElementById("end");
    if (!end.hidden) return true;
    const w = window.__receptionist && window.__receptionist.state();
    return w && !w.busy && w.phase !== "intro" && !document.getElementById("input").disabled;
  }, null, { timeout: 8000 });
  return page.evaluate(() => (document.getElementById("end").hidden ? window.__receptionist.state().phase : "ended"));
}

async function send(page, text) {
  await settle(page);
  await page.fill("#input", text);
  await page.press("#input", "Enter");
}
async function chip(page, label) {
  await settle(page);
  await page.click(`.chip:text-is(${JSON.stringify(label)})`);
}
async function startCall(page) {
  // "Start over" returns to the scenario picker; then Call starts the selected scenario.
  if (!(await page.isVisible("#callBtn"))) {
    await page.click(await page.isVisible("#restartEnd") ? "#restartEnd" : "#restartTop");
    await page.waitForSelector("#intro:not([hidden])");
  }
  await page.click("#callBtn");
  await settle(page);
}
const smsText = (page) => page.innerText("#smsBody");
const agentLines = (page) => page.$$eval("#chat .row.agent .bubble", (ns) => ns.map((n) => n.innerText));

/* ------------------------------------------------------------------ */
async function pickScenario(page, title) {
  if (!(await page.isVisible("#intro"))) await page.reload();
  await page.click(`.pick:has-text(${JSON.stringify(title)})`);
}

async function scenarios(browser) {
  console.log("Scenarios");
  const { page, errors } = await newPage(browser);

  // 1. Storm scenario tapped straight through with chips and sample answers (the demo's main path)
  ok(/Sunday morning/i.test(await page.innerText(".pick[aria-checked='true']")), "storm scenario is selected by default");
  ok(/Call \(519\) 685-0257/.test(await page.innerText("#callBtn")), "call button shows CLC's real number");
  ok(/Serving London and the surrounding area/.test(await page.innerText("#introWhere")), "service area uses CLC's own wording");
  await startCall(page);
  await chip(page, "A big tree came down in the storm last night");
  ok((await page.evaluate(() => window.__receptionist.state().flow)) === "emergency", "storm call routes to the emergency intake");
  await chip(page, "Neither"); await chip(page, "Continue"); await settle(page);
  ok(/Are any power lines down or involved\?/.test((await agentLines(page)).slice(-1)[0]), "power lines asked as its own question");
  await chip(page, "No lines involved");
  await chip(page, "No one is hurt");
  await chip(page, "Dave Morrison"); await chip(page, "123 Maple St, London"); await chip(page, "519-555-0148");
  await chip(page, "No, just me");
  ok(!(await agentLines(page)).some((l) => /Priority/.test(l)), "read-back card has no priority line");
  await chip(page, "Yes, that's right");
  await page.waitForSelector("#end:not([hidden])");
  let t = await smsText(page);
  ok(!/URGENT/.test(t), "storm call with nothing hit, no lines, no injuries is not URGENT");
  ok(/Priority: Standard/.test(t) && /Power lines: None involved/.test(t), "storm summary has priority + power lines fields");
  ok((await page.$eval("#smsBody .sms-banner", (e) => e.className + e.textContent)) === "sms-banner stormSTORM DAMAGE", "non-urgent storm text has the amber storm banner");
  let closing = (await agentLines(page)).find((l) => /sent this summary/.test(l));
  ok(/stay clear of the tree\.$/.test(closing) && !/downed lines/.test(closing), "no lines involved: closing drops the downed-lines warning");
  ok(/Storm damage call/.test(t) && /Caller: Dave Morrison/.test(t) && /Number: \(519\) 555-0148/.test(t), "storm summary has caller + number");
  ok(/What happened: Tree down/.test(t) && /Backup: None/.test(t), "storm summary has incident + backup");
  ok(/\(519\) 685-0257/.test(await page.innerText(".thread-head")), "SMS header shows CLC's number");
  ok((await page.innerText("#smsStamp")) === "Sunday 8:12 AM", "storm text is stamped Sunday morning");

  // 2. Urgent from the first sentence: injury pre-filled, power lines pre-ticked
  await startCall(page);
  await send(page, "A tree fell on the power lines and my husband is hurt");
  await settle(page);
  let st = await page.evaluate(() => window.__receptionist.state());
  ok(st.urgentReasons.length === 2, "urgent flagged from first sentence (got " + st.urgentReasons.join(",") + ")");
  ok(await page.isVisible("#urgentPill"), "urgent banner visible");
  ok(st.answers.powerLines === "YES, down or involved", "power lines recorded from first sentence");
  await chip(page, "Neither"); await chip(page, "Continue");
  ok(!/power lines|hurt\?/i.test((await agentLines(page)).slice(-1)[0]), "power-lines and injury questions skipped");
  await send(page, "Sam Lee"); await send(page, "5 Elm Ave");
  await send(page, "five one nine five five five zero one nine nine");
  await send(page, "my brother Ray 226 555 0142");
  await send(page, "yes");
  await page.waitForSelector("#end:not([hidden])");
  t = await smsText(page);
  ok(/URGENT/.test(t) && /Power lines involved/.test(t) && /Someone is hurt/.test(t), "SMS shows URGENT + both reasons");
  ok((await page.$eval("#smsBody .sms-banner", (e) => e.className + e.textContent)) === "sms-banner urgentURGENT", "URGENT banner sits at the top of the text mockup");
  ok(/Priority: URGENT/.test(t) && /Power lines: YES/.test(t), "priority URGENT and power lines field on the text");
  closing = (await agentLines(page)).find((l) => /sent this summary/.test(l));
  ok(/downed lines/.test(closing), "lines down: closing keeps the downed-lines warning");
  ok(/Number: \(519\) 555-0199/.test(t), "spoken digits parsed");
  ok(/Backup: My brother Ray \(226\) 555-0142/.test(t), "backup number formatted");

  // 3. Free estimate scenario, tapped straight through: never URGENT
  await pickScenario(page, "Free estimate"); await startCall(page);
  ok((await agentLines(page)).some((l) => /crew's out on a job/.test(l)), "estimate greeting says the crew is out");
  await chip(page, "I'd like a free estimate for pruning");
  st = await page.evaluate(() => window.__receptionist.state());
  ok(st.flow === "estimate" && st.answers.service === "Pruning & maintenance", "pruning request routes to estimate intake with service detected");
  ok(!(await agentLines(page)).some((l) => /pricing|prices/.test(l)), "asking for a free estimate doesn't trigger the price answer");
  await chip(page, "Two big maples hanging over the driveway");
  await chip(page, "Linda Chen"); await chip(page, "45 Elm Ave, London"); await chip(page, "519-555-0163"); await chip(page, "Mornings");
  await chip(page, "Yes, that's right");
  await page.waitForSelector("#end:not([hidden])");
  t = await smsText(page);
  ok(!/URGENT/.test(t), "estimate request is never URGENT");
  ok((await page.$$("#smsBody .sms-banner")).length === 0 && /Priority: Routine/.test(t), "estimate text has no banner and routine priority");
  ok(/Free estimate request/.test(t) && /Service: Pruning & maintenance/.test(t) && /Best time to call: Mornings/.test(t), "estimate summary fields");
  ok((await page.innerText("#smsStamp")) === "Tuesday 10:40 AM", "estimate text is stamped Tuesday");
  ok((await agentLines(page)).some((l) => /ISA Certified Arborists will call you/.test(l) && /CLC's/.test(l)), "estimate closing names the arborists");

  // 4. Guardrails: AI / price / ETA / safety, and the receptionist never quotes
  await startCall(page);
  await send(page, "Are you an AI? How much do you charge? When can you get here? Is it safe to cut it myself?");
  await settle(page);
  const lines = (await agentLines(page)).join("\n");
  ok(/(^|\n)I'm an AI receptionist for CLC Tree Services\./.test(lines) && !/Yes, I'm an AI/.test(lines), "AI answer leads with the truth (no 'Yes,')");
  ok(/can't give prices over the phone, but CLC's estimates are free/.test(lines), "price deflected toward free estimate");
  ok(/can't promise an arrival time/.test(lines), "ETA deflected");
  ok(/stay clear of the tree and any downed lines/.test(lines), "safety answer limited to stay-clear");

  // 5. Typed estimate (removal), contradictory answers in the storm flow, edit flow
  await startCall(page);
  await send(page, "I want a dead tree taken down");
  st = await page.evaluate(() => window.__receptionist.state());
  ok(st.flow === "estimate" && st.answers.service === "Tree removal", "removal request routes to estimate intake");
  await send(page, "one ash in the backyard"); await send(page, "Al Ng"); await send(page, "9 Oak St, London");
  await send(page, "5195550100"); await send(page, "after 5");
  await settle(page);
  ok((await page.evaluate(() => window.__receptionist.state().answers.bestTime)) === "Evenings", "'after 5' understood as evenings");
  await send(page, "no the address is wrong");
  await settle(page);
  ok((await page.evaluate(() => window.__receptionist.state().editing)) === "address", "edit jumps straight to address");
  await send(page, "14 Oak St, London");
  await send(page, "Something needs fixing");
  await chip(page, "Best time to call");
  await chip(page, "Any time");
  await send(page, "yes");
  await page.waitForSelector("#end:not([hidden])");
  t = await smsText(page);
  ok(/Address: 14 Oak St, London/.test(t) && /Best time to call: Any time/.test(t), "edits kept");

  await pickScenario(page, "Storm emergency"); await startCall(page);
  await chip(page, "A big tree came down in the storm last night");
  await chip(page, "House"); await chip(page, "Continue");
  ok((await page.evaluate(() => window.__receptionist.state().urgentReasons)).includes("Tree hit a house"), "tree hitting a house flags URGENT");
  await chip(page, "Not sure");
  await send(page, "yes and no");
  await settle(page);
  ok((await page.evaluate(() => window.__receptionist.state().answers.injuries)) == null, "contradictory injury answer is re-asked");

  // 6. Copy summary + transcript
  await send(page, "no"); await chip(page, "Dave Morrison"); await chip(page, "123 Maple St, London"); await chip(page, "519-555-0148");
  await chip(page, "No, just me"); await chip(page, "Yes, that's right");
  await page.waitForSelector("#end:not([hidden])");
  ok((await page.$$("#transcript p")).length > 10, "transcript rendered");
  closing = (await agentLines(page)).find((l) => /sent this summary/.test(l));
  ok(/downed lines/.test(closing), "lines unsure: closing keeps the downed-lines warning");
  ok(/Damage: House/.test(await smsText(page)) && /URGENT/.test(await smsText(page)), "house hit: URGENT on the text");
  await page.click("#copyBtn");
  await page.waitForTimeout(1500);
  ok(/Copied|Couldn't copy/.test(await page.innerText("#copyBtn")), "copy button responds");
  await page.click("#restartEnd");
  ok(await page.isVisible("#intro") && await page.isHidden("#call") && await page.isHidden("#end"), "Start over returns to the scenario picker");

  ok(errors.length === 0, "no page errors in scenarios: " + errors.join(" | "));
  await page.close();
}

/* ------------------------------------------------------------------ */
async function stress(browser) {
  console.log(`Stress: ${RUNS} randomized calls (SEED=${process.env.SEED || 12345})`);
  let { page, errors } = await newPage(browser);
  let completed = 0, aborted = 0, actions = 0, urgentCalls = 0;
  const t0 = Date.now();

  for (let run = 0; run < RUNS; run++) {
    if (run && run % 50 === 0) { await page.close(); ({ page, errors } = await newPage(browser)); }
    if (rand() < 0.4) { // sometimes go back to the intro screen and switch scenario
      await page.reload();
      await page.click(`.pick >> nth=${rand() < 0.5 ? 0 : 1}`, { timeout: 2000 });
    }
    const tC = Date.now();
    try { await startCall(page); if (process.env.DEBUG) console.log(`  startCall ${Date.now() - tC}ms`); } catch (e) { fail(`run ${run}: could not start call: ${e.message}`); continue; }
    let typedBraces = false, done = false;
    const trail = [];

    for (let step = 0; step < 90; step++) {
      let phase;
      const tS = Date.now();
      try { phase = await settle(page); if (process.env.DEBUG && Date.now() - tS > 400) console.log(`  slow settle ${Date.now() - tS}ms run=${run}`); } catch (e) {
        const st = await page.evaluate(() => window.__receptionist && window.__receptionist.state()).catch(() => null);
        fail(`run ${run}: stuck (phase=${st && st.phase}, busy=${st && st.busy}) after: ${trail.slice(-4).join(" → ")}`); break;
      }
      if (phase === "ended") { done = true; break; }
      actions++;
      const r = rand();
      const tA = Date.now();
      const stepKey = await page.evaluate(() => { const s = window.__receptionist.state(); return s.phase === "step" ? window.__receptionist.steps()[s.idx].key : s.phase; });
      trail.push(`${stepKey}:${r.toFixed(2)}`);

      if (r < 0.03) { // restart mid-call
        await page.click("#restartTop"); aborted++; break;
      } else if (r < 0.13) { // junk
        const j = pick(JUNK); if (j.includes("{")) typedBraces = true;
        await page.fill("#input", j); await page.press("#input", "Enter");
      } else if (r < 0.2) { // guardrail question
        await send(page, pick(GUARDS));
      } else if (r < 0.23) { // double submit
        await page.fill("#input", pick(VALID[stepKey] || ["ok"]));
        await page.press("#input", "Enter"); await page.press("#input", "Enter", { timeout: 300 }).catch(() => {});
      } else {
        const chips = await page.$$eval(".chip", (n) => n.map((x) => ({ t: x.textContent, primary: x.classList.contains("primary") })));
        if (chips.length && rand() < 0.55) {
          const opts = chips.filter((c) => !c.primary);
          if (chips.some((c) => c.primary)) { // multi-select
            const n = 1 + Math.floor(rand() * 2);
            for (let i = 0; i < n; i++) await page.click(`.chip:text-is(${JSON.stringify(pick(opts).t)})`);
            const cont = await page.$(".chip.primary:not([disabled])");
            if (cont) { await cont.click(); if (rand() < 0.2) await cont.click({ timeout: 300 }).catch(() => {}); }
          } else {
            await page.click(`.chip:text-is(${JSON.stringify(pick(opts).t)})`);
          }
        } else {
          await send(page, pick(VALID[stepKey] || ["yes"]));
        }
      }
      if (process.env.DEBUG && Date.now() - tA > 400) console.log(`  slow action ${Date.now() - tA}ms run=${run} r=${r.toFixed(2)} step=${stepKey}`);
    }

    if (!done) {
      if (await page.isVisible("#end")) done = true;
      else { if (!(await page.isVisible("#call"))) continue; continue; }
    }
    completed++;

    // ---- invariants on the finished call ----
    const st = await page.evaluate(() => window.__receptionist.state());
    const sms = await smsText(page);
    const wl = (await page.$$eval("#chat .row.agent .bubble", (n) => n.map((x) => x.innerText))).join("\n");
    if (st.urgentReasons.length) urgentCalls++;
    ok(/\(\d{3}\) \d{3}-\d{4}/.test(st.answers.phone || ""), `run ${run}: phone formatted (${st.answers.phone})`);
    ok(!!st.answers.name && sms.includes(st.answers.name.slice(0, 50)), `run ${run}: name in SMS`);
    ok(/URGENT/.test(sms) === st.urgentReasons.length > 0, `run ${run}: URGENT tag matches state`);
    ok(st.raw.powerLines !== "Yes" || st.urgentReasons.includes("Power lines involved"), `run ${run}: power lines => urgent`);
    const hit = Array.isArray(st.raw.damage) ? st.raw.damage : [];
    ok(!hit.includes("House") || st.urgentReasons.includes("Tree hit a house"), `run ${run}: house hit => urgent`);
    ok(!hit.includes("Car") || st.urgentReasons.includes("Tree hit a car"), `run ${run}: car hit => urgent`);
    ok(/URGENT/.test(sms) === (await page.$$("#smsBody .sms-banner.urgent")).length > 0, `run ${run}: URGENT banner on the text matches`);
    if (st.flow === "emergency") {
      const closingLine = wl.split("\n").find((l) => /sent this summary/.test(l)) || "";
      ok(/downed lines/.test(closingLine) === (st.raw.powerLines !== "No"), `run ${run}: downed-lines warning only when lines down/unsure`);
    }
    ok(st.raw.injuries !== "Yes" || st.urgentReasons.includes("Someone is hurt"), `run ${run}: injury => urgent`);
    ok(st.flow !== "estimate" || st.urgentReasons.length === 0 || st.mentioned.length > 0, `run ${run}: estimate calls only urgent if caller reported danger`);
    ok(/\(519\) 685-0257/.test(await page.innerText(".thread-head")), `run ${run}: SMS shows CLC's number`);
    ok(!st.urgentReasons.includes("Someone is hurt") || st.raw.injuries === "Yes", `run ${run}: urgent injury only if injuries=Yes`);
    ok(await page.$$eval("#chat img, #chat script, #smsBody img, #transcript img", (n) => n.length) === 0, `run ${run}: no injected HTML`);
    ok(!/\$\s?\d|\b\d+\s*(minutes?|mins?|hours?|hrs?)\b|\bwithin\b|\bon (our|the) way\b/i.test(wl), `run ${run}: receptionist never quotes price/time`);
    if (!typedBraces) ok(!/\{(first|name|phone|address|business|receptionist|role|town|label|phrase)\}/.test(wl + sms), `run ${run}: no unfilled placeholders`);
    ok(sms.length < 3000, `run ${run}: SMS stays a sane length (${sms.length})`);
    if (errors.length) { fail(`run ${run}: ${errors.join(" | ")}`); errors.length = 0; }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ${completed} calls completed, ${aborted} restarted mid-call, ${urgentCalls} urgent, ${actions} caller actions, ${secs}s`);
  ok(completed + aborted === RUNS, `every random call either finished or was restarted on purpose (${completed}+${aborted}/${RUNS})`);
  ok(errors.length === 0, "no page errors in stress run: " + errors.join(" | "));
  await page.close();
}

/* ------------------------------------------------------------------ */
async function layout(browser) {
  console.log("Layout");
  for (const width of [320, 375, 414, 768, 1280]) {
    const { page, errors } = await newPage(browser, { width, height: 800 });
    const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok(await noOverflow(), `${width}px intro: no horizontal scroll`);
    await startCall(page);
    await send(page, "power lines are down"); await settle(page);
    ok(await noOverflow(), `${width}px call: no horizontal scroll`);
    const headOk = await page.evaluate(() => { const r = document.querySelector(".call-head").getBoundingClientRect(); return r.height < 80; });
    ok(headOk, `${width}px header stays one row`);
    ok(errors.length === 0, `${width}px no errors`);
    await page.close();
  }
  const { page, errors } = await newPage(browser);
  await page.goto(LANDING);
  ok((await page.$$("a")).length === 0, "root page lists no client demos");
  ok(!/CLC|NZ Systems/.test(await page.content()), "root page names no clients");
  ok((await page.getAttribute('meta[name="robots"]', "content")) === "noindex, nofollow", "root page is noindex");
  ok(errors.length === 0, "landing page has no errors");
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await scenarios(browser);
    await layout(browser);
    await stress(browser);
  } catch (e) {
    fail("suite crashed: " + (e.stack || e.message));
  } finally {
    await browser.close();
  }
  console.log(`\n${passes} checks passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})();
