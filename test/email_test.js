"use strict";
const assert = require("assert");
const { sendEmail, status } = require("../lib/email");

(async () => {
  const args = { patient: "Amina W.", subject: "Your appointment", text: "Hello" };

  delete process.env.RESEND_API_KEY; delete process.env.EMAIL_TEST_INBOX;
  await assert.rejects(() => sendEmail(args), /RESEND_API_KEY/);
  assert.strictEqual(status().configured, false);

  process.env.RESEND_API_KEY = "re_test"; process.env.EMAIL_TEST_INBOX = "owner@example.com";
  assert.strictEqual(status().configured, true);

  let sent;
  global.fetch = async (url, opts) => {
    sent = { url, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, json: async () => ({ id: "abc123" }) };
  };
  const r = await sendEmail(args);
  assert.strictEqual(r.id, "abc123");
  assert.strictEqual(sent.url, "https://api.resend.com/emails");
  assert.deepStrictEqual(sent.body.to, ["owner@example.com"]);
  assert.ok(sent.body.text.includes("synthetic"));

  let calls = 0;
  global.fetch = async () => { calls++; return { ok: false, status: 403, json: async () => ({ message: "only your own address" }) }; };
  await assert.rejects(() => sendEmail(args), /EMAIL_TEST_INBOX/);
  assert.strictEqual(calls, 1, "a 403 must not be retried");

  calls = 0;
  global.fetch = async () => {
    calls++;
    return calls === 1
      ? { ok: false, status: 429, json: async () => ({ message: "slow down" }) }
      : { ok: true, status: 200, json: async () => ({ id: "second" }) };
  };
  assert.strictEqual((await sendEmail(args)).id, "second");
  assert.strictEqual(calls, 2);

  console.log("All email tests passed.");
})().catch((e) => { console.error(e); process.exit(1); });