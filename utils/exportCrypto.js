const crypto = require("crypto");

// Versioned, self-contained container - every .enc file carries its own
// salt and iv, so decrypting it never needs anything but the passphrase.
// MAGIC(4) + salt(16) + iv(12) + ciphertext + authTag(16).
//
// Zero dependencies beyond Node's builtin crypto/zlib - this file (plus
// zlib for gunzip) is everything scripts/decryptExport.js and the browser
// decryptor need, so decrypting a backup never requires the rest of this
// repo, the DB, or the live server to be reachable.
const MAGIC = Buffer.from("ADX1");
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
// Must stay in sync with ITERATIONS in aymanediary's
// src/components/utils/exportCrypto.js (the browser-side decryptor).
const ITERATIONS = 210000;
const DIGEST = "sha256";

function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, DIGEST);
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function encryptPayload(passphrase, plaintextBuffer) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(passphrase, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintextBuffer),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, salt, iv, ciphertext, tag]);
}

function decryptPayload(passphrase, container) {
  const minLength = MAGIC.length + SALT_LENGTH + IV_LENGTH + TAG_LENGTH;
  if (
    container.length < minLength ||
    !container.subarray(0, MAGIC.length).equals(MAGIC)
  ) {
    throw new Error("Unrecognized export file format.");
  }

  let offset = MAGIC.length;
  const salt = container.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;
  const iv = container.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const rest = container.subarray(offset);
  const tag = rest.subarray(rest.length - TAG_LENGTH);
  const ciphertext = rest.subarray(0, rest.length - TAG_LENGTH);

  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = {
  deriveKey,
  generateToken,
  hashToken,
  encryptPayload,
  decryptPayload,
};
