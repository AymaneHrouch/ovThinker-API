const crypto = require("crypto");
const config = require("config");

// Server-only concern: encrypting the user's chosen export passphrase for
// storage at rest in the DB, using a key derived from jwtPrivateKey so no
// extra secret needs to be configured. Deliberately kept separate from
// utils/exportCrypto.js, which stays dependency-free so it can be copied
// out and used completely offline to decrypt a backup.
function deriveMasterKey() {
  return crypto.scryptSync(
    config.get("jwtPrivateKey"),
    "aymanediary-export-master-v1",
    32
  );
}

function encryptAtRest(buffer) {
  const masterKey = deriveMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64"),
  };
}

function decryptAtRest(encrypted) {
  const masterKey = deriveMasterKey();
  const iv = Buffer.from(encrypted.iv, "base64");
  const tag = Buffer.from(encrypted.tag, "base64");
  const data = Buffer.from(encrypted.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

module.exports = { encryptAtRest, decryptAtRest };
