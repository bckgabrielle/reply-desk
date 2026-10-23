"use strict";
const clinic = require("../lib/clinic");
const cases = require("../eval/cases.json");
const { status } = require("../lib/email");

module.exports = (req, res) => {
  res.status(200).json({ ...clinic, email: status(), samples: cases.map((c) => ({ id: c.id, reply: c.reply })) });
};