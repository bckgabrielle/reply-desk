"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
require("./lib/env").loadEnv();
const handle = require("./api/handle");
const clinic = require("./api/clinic");
const send = require("./api/send");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const ROUTES = { "/api/handle": handle, "/api/clinic": clinic, "/api/send": send };

if (!process.env.GEMINI_API_KEY) console.log("Note: GEMINI_API_KEY is not set. Replies will go to staff as 'AI unavailable'. See README.");
if (!process.env.RESEND_API_KEY || !process.env.EMAIL_TEST_INBOX) console.log("Note: RESEND_API_KEY or EMAIL_TEST_INBOX is not set. Approving a reply will show an error. See README.");

http.createServer(async (req, res) => {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
  const url = new URL(req.url, "http://localhost");

  if (ROUTES[url.pathname]) {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 20000) return res.status(413).json({ error: "Request too large" });
    }
    try { req.body = body ? JSON.parse(body) : {}; }
    catch { return res.status(400).json({ error: "Bad request" }); }
    return ROUTES[url.pathname](req, res);
  }

  const file = url.pathname === "/" ? "/index.html" : url.pathname;
  const full = path.join(PUBLIC, path.normalize(file));
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  res.setHeader("Content-Type", TYPES[path.extname(full)] || "application/octet-stream");
  fs.createReadStream(full).pipe(res);
}).listen(PORT, () => console.log(`Open http://localhost:${PORT} in your browser`));