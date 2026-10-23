"use strict";
const { UserError } = require("./core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function settings() {
  return {
    key: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "Reply Desk <onboarding@resend.dev>",
    inbox: (process.env.EMAIL_TEST_INBOX || "").trim()
  };
}

function status() {
  const s = settings();
  return {
    configured: Boolean(s.key && s.inbox),
    inbox_hint: s.inbox ? s.inbox.replace(/^(.).*(@.*)$/, "$1***$2") : null
  };
}

function friendly(e) {
  let msg;
  if (e.name === "AbortError") msg = "Resend did not answer in time. The email may or may not have been sent, so check your Resend dashboard before trying again.";
  else if (e.status === 401) msg = "Resend rejected the API key. Check RESEND_API_KEY in your .env file.";
  else if (e.status === 403) msg = "Resend only allows test emails to the address you signed up with. Set EMAIL_TEST_INBOX to that address, or verify a domain in Resend.";
  else if (e.status === 422) msg = `Resend rejected the email details: ${e.message}`;
  else if (e.status === 429) msg = "Resend's sending limit was reached. Wait a while and try again.";
  else msg = `The email could not be sent (${e.message}).`;
  const err = new Error(msg);
  err.statusCode = 502;
  return err;
}

async function sendEmail({ patient, subject, text }) {
  const s = settings();
  if (!s.key) { const e = new UserError("Email is not set up. Add RESEND_API_KEY to your .env file."); e.statusCode = 503; throw e; }
  if (!s.inbox) { const e = new UserError("Email is not set up. Add EMAIL_TEST_INBOX (the address you signed up to Resend with) to your .env file."); e.statusCode = 503; throw e; }

  const payload = JSON.stringify({
    from: s.from,
    to: [s.inbox],
    subject,
    text: `[This message is for ${patient}, a synthetic patient. It is delivered to the test inbox instead.]\n\n${text}`
  });

  let last;
  for (let i = 0; i < 2; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${s.key}`, "Content-Type": "application/json" },
        body: payload,
        signal: ctl.signal
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.id) return { id: body.id };
      const err = new Error(body.message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    } catch (e) {
      last = e;
      // Retry only when Resend answered with a rate limit or server error.
      // Never retry a timeout, since that could send the email twice.
      const retryable = e.status === 429 || e.status >= 500;
      if (!retryable || i === 1) break;
      await sleep(1000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw friendly(last);
}

module.exports = { sendEmail, status };