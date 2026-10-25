"use strict";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (name, fallback) => Number(process.env[name]) || fallback;

const cooldownUntil = {};
const COOLDOWN_MS = 60 * 1000;

async function fetchJson(url, opts, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal });
    const body = await res.text();
    if (!res.ok) {
      const e = new Error(`HTTP ${res.status}`);
      e.status = res.status;
      e.body = body.slice(0, 200);
      throw e;
    }
    return JSON.parse(body);
  } finally {
    clearTimeout(timer);
  }
}

async function gemini(prompt) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" }
      })
    },
    num("GEMINI_TIMEOUT_MS", 20000)
  );
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parts.map((p) => p.text || "").join("");
}

async function groq(prompt) {
  const data = await fetchJson(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        temperature: 0,
        messages: [{ role: "user", content: prompt }]
      })
    },
    num("GROQ_TIMEOUT_MS", 20000)
  );
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
}

//retry rate limits and server errors.
async function withRetry(fn, attempts, retryOn429) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      if (e.status === 429 && !retryOn429) break;
      const retryable = e.status === 429 || e.status >= 500 || (!e.status && e.name !== "AbortError");
      if (!retryable || i === attempts - 1) break;
      await sleep(1000 * (i + 1));
    }
  }
  throw last;
}

async function callModel(prompt, parse) {
  const providers = [];
  if (process.env.GEMINI_API_KEY) providers.push(["gemini", gemini]);
  if (process.env.GROQ_API_KEY) providers.push(["groq", groq]);
  if (!providers.length) throw new Error("No API key set. Add GEMINI_API_KEY or GROQ_API_KEY to your .env file");

  const errors = [];
  for (let i = 0; i < providers.length; i++) {
    const [name, fn] = providers[i];
    const isLast = i === providers.length - 1;
    if (!isLast && Date.now() < (cooldownUntil[name] || 0)) {
      errors.push(`${name}: skipped, quota recently used up`);
      continue;
    }
    try {
      const text = await withRetry(() => fn(prompt), isLast ? 2 : 1, isLast);
      return { value: parse(text), provider: name };
    } catch (e) {
      if (e.status === 429) cooldownUntil[name] = Date.now() + COOLDOWN_MS;
      const msg = e.name === "AbortError" ? "timed out" : e.message;
      errors.push(`${name}: ${msg}${e.body ? " " + e.body : ""}`);
    }
  }
  throw new Error(errors.join(" | "));
}

module.exports = { callModel };