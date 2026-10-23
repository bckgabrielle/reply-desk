"use strict";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
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
    60000
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
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }]
      })
    },
    8000
  );
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
}

async function withRetry(fn, attempts) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      const retryable = !e.status || e.status === 429 || e.status >= 500;
      if (!retryable || i === attempts - 1) break;
      await sleep(1000 * (i + 1));
    }
  }
  throw last;
}

// Tries Gemini, then Groq (if a key is set). `parse` turns the raw text into a value;
// if parsing fails, the next provider is tried.
async function callModel(prompt, parse) {
  const providers = [];
  if (process.env.GEMINI_API_KEY) providers.push(["gemini", gemini, 2]);
  if (process.env.GROQ_API_KEY) providers.push(["groq", groq, 1]);
  if (!providers.length) throw new Error("No API key set. Add GEMINI_API_KEY to your .env file");
  const errors = [];
  for (const [name, fn, attempts] of providers) {
    try {
      const text = await withRetry(() => fn(prompt), attempts);
      return { value: parse(text), provider: name };
    } catch (e) {
      errors.push(`${name}: ${e.message}${e.body ? " " + e.body : ""}`);
    }
  }
  throw new Error(errors.join(" | "));
}

module.exports = { callModel };