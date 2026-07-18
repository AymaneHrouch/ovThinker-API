#!/usr/bin/env node
// Fully offline decryption of an aymanediary export - no server, no DB, no
// config needed. Keep a copy of this file (and utils/exportCrypto.js)
// somewhere safe alongside your backups: if you ever lose the rest of this
// repo, these two files plus your passphrase are all you need to read them
// back.
//
// Usage:
//   node scripts/decryptExport.js <file.enc> [output.json]
//   EXPORT_PASSPHRASE=... node scripts/decryptExport.js <file.enc>   (non-interactive)

const fs = require("fs");
const zlib = require("zlib");
const { decryptPayload } = require("../utils/exportCrypto");

const [, , inputPath, outputPath] = process.argv;

if (!inputPath) {
  console.error("Usage: node decryptExport.js <file.enc> [output.json]");
  console.error(
    "Passphrase is read from the EXPORT_PASSPHRASE env var, or prompted."
  );
  process.exit(1);
}

function readPassphrase() {
  if (process.env.EXPORT_PASSPHRASE)
    return Promise.resolve(process.env.EXPORT_PASSPHRASE);

  return new Promise(resolve => {
    process.stdout.write("Export passphrase: ");
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", data => resolve(data.toString().trim()));
  });
}

(async () => {
  const passphrase = await readPassphrase();
  const container = fs.readFileSync(inputPath);

  let decompressed;
  try {
    const gzipped = decryptPayload(passphrase, container);
    decompressed = zlib.gunzipSync(gzipped);
  } catch (ex) {
    console.error("Could not decrypt - wrong passphrase or corrupted file.");
    process.exit(1);
  }

  const out = outputPath || inputPath.replace(/\.enc$/, "") + ".json";
  fs.writeFileSync(out, decompressed);
  console.log(`Decrypted -> ${out}`);
  process.exit(0);
})();
