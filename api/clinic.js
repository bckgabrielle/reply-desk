"use strict";
const clinic = require("../lib/clinic");
const cases = require("../eval/cases.json");

module.exports = (req, res) => {
  res.status(200).json({ ...clinic, samples: cases.map((c) => ({ id: c.id, reply: c.reply })) });
};