require("dotenv").config();
const db = require("../startup/db");
const { Journal } = require("../models/journal");
const { extractTags } = require("../utils/extractTags");

async function run() {
  db();
  const journals = await Journal.find({});
  for (const j of journals) {
    j.tags = extractTags(j.comment);
    await j.save();
  }
  console.log(`Backfilled tags for ${journals.length} journals.`);
  process.exit(0);
}

run();
