"use strict";
const clinic = require("../lib/clinic");
const { UserError } = require("../lib/core");
const { sendEmail } = require("../lib/email");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const b = req.body || {};
    const appt = clinic.appointments.find((a) => a.id === b.appointment_id);
    if (!appt) throw new UserError("Unknown appointment.");
    const doctor = clinic.doctors.find((d) => d.id === appt.doctor);
    const text = typeof b.text === "string" ? b.text.trim() : "";
    if (!text) throw new UserError("The message is empty.");
    if (text.length > 2000) throw new UserError("The message is too long (2000 characters at most).");

    const t0 = Date.now();
    const r = await sendEmail({ patient: appt.patient, subject: `Your appointment with ${doctor.name}`, text });
    // The message text is deliberately not logged.
    console.log(JSON.stringify({ event: "email_sent", appointment_id: appt.id, email_id: r.id, ms: Date.now() - t0 }));
    return res.status(200).json({ id: r.id });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    console.error(JSON.stringify({ event: "server_error", message: e.message }));
    return res.status(500).json({ error: "Something went wrong on the server. Try again." });
  }
};