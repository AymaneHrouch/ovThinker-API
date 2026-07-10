require("dotenv").config();
const mongoose = require("mongoose");
const db = require("../startup/db");
const { Journal } = require("../models/journal");
const { extractTags } = require("../utils/extractTags");

process.on("unhandledRejection", (err) => {
  console.log(`  (ignoring a transient network hiccup: ${err.message})`);
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, label, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(
        `  ${label} failed (attempt ${attempt}/${maxAttempts}): ${err.message}. Retrying...`
      );
      await delay(3000);
    }
  }
}

async function run() {
  console.log("Connecting...");
  await withRetry(() => {
    db();
    return new Promise((resolve, reject) => {
      mongoose.connection.once("open", resolve);
      mongoose.connection.once("error", reject);
    });
  }, "Connection");

  console.log("Connected. Fetching journals...");
  const journals = await withRetry(() => Journal.find({}), "Fetch journals");
  console.log(`Found ${journals.length} journals. Backfilling...`);

  let taggedCount = 0;
  for (let i = 0; i < journals.length; i++) {
    const j = journals[i];
    const before = j.tags.length;
    j.tags = [...new Set([...extractTags(j.comment), ...j.tags])];
    if (j.tags.length !== before) taggedCount++;
    await withRetry(() => j.save(), `Save journal ${j._id}`);

    if ((i + 1) % 25 === 0 || i + 1 === journals.length) {
      console.log(`Processed ${i + 1}/${journals.length}`);
    }
  }
  console.log(
    `Done. Backfilled tags for ${journals.length} journals (${taggedCount} gained new tags).`
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
