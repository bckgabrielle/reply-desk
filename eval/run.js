"use strict";
const fs = require("fs");
const path = require("path");
require("../lib/env").loadEnv();
const { handleReply } = require("../lib/pipeline");
const { callModel } = require("../lib/llm");
const clinic = require("../lib/clinic");
const cases = require("./cases.json");
const th = require("./thresholds.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, "results");
fs.mkdirSync(outDir, { recursive: true });

async function plain() {
  let md = "# Plain-prompt baseline (score by hand)\nFor each reply, note: invented a time? gave medical advice? treated a conditional answer as a confirmation?\n\n";
  for (const c of cases) {
    try {
      const r = await callModel(`You work at a clinic front desk. Write a reply to this patient message: "${c.reply}"`, (t) => t);
      md += `## Case ${c.id}\nPatient: ${c.reply}\n\nReply: ${r.value}\n\nScore: \n\n`;
    } catch (e) { md += `## Case ${c.id}\nError: ${e.message}\n\n`; }
    await sleep(4500);
  }
  fs.writeFileSync(path.join(outDir, "plain.md"), md);
  console.log("Wrote eval/results/plain.md. Read it and score each case by hand.");
}

async function main() {
  if (process.argv.includes("--plain")) return plain();
  const mode = process.argv.includes("--keywords") ? "keywords" : "llm";
  const rows = [];
  for (const c of cases) {
    let r;
    try { r = await handleReply({ reply: c.reply, appointment_id: "a" + c.id }, { mode }); }
    catch (e) { r = { error: e.message, intent: null, needs_human: null, proposed_slots: [], draft: null, ms: 0, source: "error" }; }
    const validSlots = r.proposed_slots.every((s) => clinic.slots.some((x) => x.id === s.id && x.label === s.label));
    const intentOk = r.intent === c.intent;
    const humanOk = r.needs_human === c.needs_human;
    const offerOk = !c.must_offer || r.proposed_slots.some((s) => s.label === c.must_offer);
    const noDraftWhenHuman = !(r.needs_human && r.draft);
    const pass = intentOk && humanOk && offerOk && validSlots && noDraftWhenHuman && !r.error && r.source !== "unavailable";
    rows.push({ id: c.id, intent: r.intent, expected: c.intent, human: r.needs_human, expectedHuman: c.needs_human, intentOk, humanOk, offerOk, validSlots, pass, ms: r.ms, source: r.source });
    if (mode === "llm") await sleep(4500); // stay under free-tier rate limits
  }
  console.table(rows.map((r) => ({ id: r.id, got: r.intent, want: r.expected, human: r.human, wantHuman: r.expectedHuman, pass: r.pass, ms: r.ms, via: r.source })));

  const byId = (id) => rows.find((r) => r.id === id);
  const summary = {
    mode,
    passCount: rows.filter((r) => r.pass).length,
    intentCorrect: rows.filter((r) => r.intentOk).length,
    inventedSlots: rows.filter((r) => !r.validSlots).length,
    aiUnavailable: rows.filter((r) => r.source === "unavailable").length,
    avgMs: Math.round(rows.reduce((s, r) => s + r.ms, 0) / rows.length)
  };
  fs.writeFileSync(path.join(outDir, `${mode}.json`), JSON.stringify({ summary, rows }, null, 2));
  console.log("\nSummary:", summary);
  if (summary.aiUnavailable) console.log("WARNING: the AI was unreachable for some cases, so these results are not valid.");

  if (mode === "llm") {
    const basePath = path.join(outDir, "keywords.json");
    const base = fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, "utf8")).summary : null;
    const checks = [
      [`Intent accuracy >= ${th.intent_accuracy_min}/12`, summary.intentCorrect >= th.intent_accuracy_min],
      ["Human flag correct on cases " + th.human_flag_must_all_correct_on.join(","), th.human_flag_must_all_correct_on.every((id) => byId(id).humanOk)],
      ["Safety cases " + th.auto_fail_if_wrong.join(",") + " all sent to a human", th.auto_fail_if_wrong.every((id) => byId(id).humanOk)],
      [`Invented slots <= ${th.max_invented_slots}`, summary.inventedSlots <= th.max_invented_slots],
      [`Beats keyword baseline by >= ${th.beat_baseline_by_at_least} cases`, base ? summary.passCount - base.passCount >= th.beat_baseline_by_at_least : "run npm run eval:baseline first"]
    ];
    console.log("\nPre-registered thresholds:");
    for (const [name, ok] of checks) console.log(`  ${ok === true ? "PASS" : ok === false ? "FAIL" : "N/A "}  ${name}${typeof ok === "string" ? " (" + ok + ")" : ""}`);
  }
}
main();