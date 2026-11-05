#!/usr/bin/env node
/*
 * Performance checks for the AI receptionist demos, run on a throttled CPU to mimic a
 * mid-range phone.
 *
 *   node tests/performance.test.js [demo/index.html]
 *
 * Measures: file size, load/paint time, tap/typing-to-screen latency, frame rate while
 * the call is animating, long main-thread tasks, and memory growth over many calls.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const DEMO = path.resolve(__dirname, "..", process.argv[2] || "demos/ai-receptionist/clc-tree-services/index.html");
const THROTTLE = Number(process.env.THROTTLE || 4); // 4x slower CPU ~ mid-range Android phone

const BUDGET = {
  fileKB: 150,          // whole demo, uncompressed
  fcpMs: 800,           // first contentful paint (throttled)
  inputMs: 100,         // Enter/tap -> caller bubble on screen (throttled)
  minFps: 50,           // median fps while the chat is animating (throttled)
  longTaskMs: 100,      // no single main-thread task longer than this (throttled)
  heapGrowthMB: 5,      // heap growth after 40 more calls
};

let failures = 0;
const report = (name, value, unit, limit, higherIsBetter = false) => {
  const pass = higherIsBetter ? value >= limit : value <= limit;
  if (!pass) failures++;
  console.log(`  ${pass ? "✓" : "✗"} ${name}: ${value}${unit} (budget ${higherIsBetter ? "≥" : "≤"} ${limit}${unit})`);
};

async function throttledPage(browser, query = "") {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  await page.addInitScript(() => {
    try { localStorage.setItem("receptionist-voice", "0"); } catch (e) {}
    window.__long = [];
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: "longtask", buffered: true });
    } catch (e) {}
  });
  await page.goto("file://" + DEMO + query);
  return { page, cdp, context };
}

const ready = (page) => page.waitForFunction(() => !document.getElementById("input").disabled, null, { timeout: 30000 });

(async () => {
  const browser = await chromium.launch();
  console.log(`Performance (CPU throttled ${THROTTLE}x, phone viewport)`);

  report("file size", Math.round(fs.statSync(DEMO).size / 1024), "KB", BUDGET.fileKB);

  // ---- load + paint
  {
    const { page, context } = await throttledPage(browser);
    const fcp = await page.evaluate(() => new Promise((res) => {
      const e = performance.getEntriesByName("first-contentful-paint")[0];
      if (e) return res(e.startTime);
      new PerformanceObserver((l) => res(l.getEntries()[0].startTime)).observe({ type: "paint", buffered: true });
    }));
    report("first contentful paint", Math.round(fcp), "ms", BUDGET.fcpMs);
    await context.close();
  }

  // ---- input latency + fps during a real-speed call
  {
    const { page, context } = await throttledPage(browser);
    await page.tap("#callBtn");
    await ready(page);

    // fps sampler
    await page.evaluate(() => {
      window.__frames = []; let last = performance.now();
      const loop = (t) => { window.__frames.push(t - last); last = t; if (window.__frames.length < 100000) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });

    const latencies = [];
    const answers = ["A tree came down", null, "no", "Jane Doe", "12 Oak St, London", "519 555 0199", "no"];
    for (const a of answers) {
      await ready(page);
      if (a === null) { // multi-select step: tap a chip then Continue
        await page.tap('.chip:text-is("House")');
        const t = await page.evaluate(() => new Promise((res) => {
          const t0 = performance.now();
          const mo = new MutationObserver(() => { if (document.querySelector("#chat .row.caller:last-child")) { mo.disconnect(); requestAnimationFrame(() => res(performance.now() - t0)); } });
          mo.observe(document.getElementById("chat"), { childList: true });
          document.querySelector(".chip.primary").click();
        }));
        latencies.push(t);
        continue;
      }
      await page.fill("#input", a);
      const t = await page.evaluate(() => new Promise((res) => {
        const before = document.querySelectorAll("#chat .row.caller").length;
        const t0 = performance.now();
        const mo = new MutationObserver(() => {
          if (document.querySelectorAll("#chat .row.caller").length > before) { mo.disconnect(); requestAnimationFrame(() => res(performance.now() - t0)); }
        });
        mo.observe(document.getElementById("chat"), { childList: true });
        document.getElementById("form").requestSubmit();
      }));
      latencies.push(t);
    }
    latencies.sort((a, b) => a - b);
    report("input → on screen (worst of " + latencies.length + ")", Math.round(latencies[latencies.length - 1]), "ms", BUDGET.inputMs);

    const frames = await page.evaluate(() => window.__frames.slice(5));
    const fps = frames.map((d) => 1000 / d).sort((a, b) => a - b);
    const median = Math.round(fps[Math.floor(fps.length / 2)]);
    const jank = frames.filter((d) => d > 50).length;
    report("median frame rate during call", median, "fps", BUDGET.minFps, true);
    console.log(`    (${frames.length} frames sampled, ${jank} over 50ms)`);
    const longTasks = await page.evaluate(() => window.__long);
    report("longest main-thread task", Math.round(Math.max(0, ...longTasks)), "ms", BUDGET.longTaskMs);
    await context.close();
  }

  // ---- memory across repeated calls (fast mode)
  {
    const { page, cdp, context } = await throttledPage(browser, "?fast");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const call = async () => {
      await page.click((await page.isVisible("#callBtn")) ? "#callBtn" : (await page.isVisible("#restartEnd")) ? "#restartEnd" : "#restartTop");
      for (const a of ["A tree came down", "none", "no", "Jane Doe", "12 Oak St, London", "519 555 0199", "no", "yes"]) {
        await ready(page); await page.fill("#input", a); await page.press("#input", "Enter");
      }
      await page.waitForSelector("#end:not([hidden])");
    };
    const heap = async () => { await cdp.send("HeapProfiler.collectGarbage"); return (await cdp.send("Runtime.getHeapUsage")).usedSize / 1048576; };
    for (let i = 0; i < 10; i++) await call();       // warm up
    const h0 = await heap();
    for (let i = 0; i < 40; i++) await call();
    const h1 = await heap();
    report("heap growth over 40 calls", Number((h1 - h0).toFixed(2)), "MB", BUDGET.heapGrowthMB);
    const nodes = await page.evaluate(() => document.getElementsByTagName("*").length);
    console.log(`    (DOM nodes after 50 calls: ${nodes})`);
    await context.close();
  }

  await browser.close();
  console.log(failures ? `\n${failures} budget(s) exceeded` : "\nAll performance budgets met");
  process.exit(failures ? 1 : 0);
})();
