"use strict";
const core = require("./core");
const { callModel } = require("./llm");
const clinic = require("./clinic");

async function handleReply(input, { mode = "llm" } = {}) {
  const t0 = Date.now();
  const text = core.cleanReply(input.reply);
  const appt = clinic.appointments.find((a) => a.id === input.appointment_id);
  if (!appt) throw new core.UserError("Unknown appointment.");
  const doctor = clinic.doctors.find((d) => d.id === appt.doctor);
  const ids = Array.isArray(input.open_slot_ids) ? input.open_slot_ids : clinic.slots.map((s) => s.id);
  const open = clinic.slots.filter((s) => ids.includes(s.id)); // labels always come from the server table

  let intent, day, needs, reasons = [], source, note = "";
  if (mode === "keywords") {
    const k = core.keywordClassify(text);
    intent = k.intent; day = k.preferred_day; source = "keywords";
    needs = core.ALWAYS_HUMAN.has(intent);
    if (needs) reasons.push("Keyword rules could not handle this.");
  } else {
    try {
      const r = await callModel(core.buildPrompt(text, appt, doctor), core.parseModelJson);
      const g = core.guards(text, r.value.intent);
      intent = g.intent; needs = g.needs_human; reasons = g.reasons;
      day = r.value.preferred_day || core.findDay(text);
      note = r.value.note; source = r.provider;
    } catch (e) {
      intent = "unclear"; needs = true; day = null; source = "unavailable";
      reasons = [`The AI service did not respond (${e.message}). Please handle this reply by hand.`];
    }
  }

  const proposal = intent === "reschedule" ? core.proposeSlots(open, day) : null;
  if (!needs && proposal && proposal.slots.length === 0) {
    needs = true;
    reasons.push("No open slots left for this doctor.");
  }
  const draft = needs ? null : core.draftReply(intent, appt, doctor, proposal);
  const out = {
    intent, needs_human: needs, reasons, source, model_note: note,
    day_requested: day,
    day_available: proposal ? proposal.dayMatched : null,
    proposed_slots: !needs && proposal ? proposal.slots.map((s) => ({ id: s.id, label: s.label })) : [],
    draft, ms: Date.now() - t0
  };
  // The reply text is deliberately not logged.
  console.log(JSON.stringify({ event: "reply_handled", appointment_id: appt.id, intent, needs_human: needs, source, ms: out.ms }));
  return out;
}

module.exports = { handleReply };