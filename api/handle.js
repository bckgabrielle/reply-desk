"use strict";
const { handleReply } = require("../lib/pipeline");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const out = await handleReply(req.body || {});
    return res.status(200).json(out);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    console.error(JSON.stringify({ event: "server_error", message: e.message }));
    return res.status(500).json({ error: "Something went wrong on the server. Try again, or handle this reply by hand." });
  }
};