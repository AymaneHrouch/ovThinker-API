const express = require("express");
const router = express.Router();
const zlib = require("zlib");
const Joi = require("joi");
const { Journal } = require("../models/journal");
const { User } = require("../models/user");
const auth = require("../middleware/auth");
const asyncMiddleware = require("../middleware/async");
const { generateToken, hashToken, encryptPayload } = require("../utils/exportCrypto");
const { encryptAtRest, decryptAtRest } = require("../utils/exportKeyStorage");

// Authenticates GET / using the standalone export token instead of the
// login JWT, so a script can pull backups without ever holding real
// account credentials.
async function exportAuth(req, res, next) {
  const token = req.header("x-export-token");
  if (!token)
    return res.status(401).send("Access denied. No export token provided.");

  const user = await User.findOne({ exportTokenHash: hashToken(token) });
  if (!user) return res.status(401).send("Invalid export token.");

  req.exportUser = user;
  next();
}

router.post(
  "/passphrase",
  auth,
  asyncMiddleware(async (req, res) => {
    const { error } = Joi.validate(req.body, {
      passphrase: Joi.string().min(8).required(),
    });
    if (error) return res.status(400).send(error.details[0].message);

    const exportPassphrase = encryptAtRest(
      Buffer.from(req.body.passphrase, "utf8")
    );
    await User.findByIdAndUpdate(req.user._id, { exportPassphrase });

    res.send({ updatedAt: new Date() });
  })
);

router.get(
  "/passphrase/status",
  auth,
  asyncMiddleware(async (req, res) => {
    const user = await User.findById(req.user._id).select("exportPassphrase");
    res.send({
      hasPassphrase: !!(user.exportPassphrase && user.exportPassphrase.data),
    });
  })
);

router.post(
  "/token",
  auth,
  asyncMiddleware(async (req, res) => {
    const token = generateToken();
    const createdAt = new Date();
    await User.findByIdAndUpdate(req.user._id, {
      exportTokenHash: hashToken(token),
      exportTokenCreatedAt: createdAt,
    });
    // Only time the raw token is ever sent back.
    res.send({ token, createdAt });
  })
);

router.delete(
  "/token",
  auth,
  asyncMiddleware(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { exportTokenHash: "", exportTokenCreatedAt: "" },
    });
    res.send({ revoked: true });
  })
);

router.get(
  "/token/status",
  auth,
  asyncMiddleware(async (req, res) => {
    const user = await User.findById(req.user._id).select(
      "exportTokenHash exportTokenCreatedAt"
    );
    res.send({
      hasToken: !!user.exportTokenHash,
      createdAt: user.exportTokenCreatedAt || null,
    });
  })
);

async function sendExport(user, res) {
  if (!user.exportPassphrase || !user.exportPassphrase.data)
    return res.status(400).send("Set an export passphrase in Settings first.");

  const passphrase = decryptAtRest(user.exportPassphrase).toString("utf8");

  const journals = await Journal.find({ user: user._id }).sort("date");
  const plaintext = zlib.gzipSync(
    JSON.stringify({ exportedAt: new Date().toISOString(), journals })
  );
  const encrypted = encryptPayload(passphrase, plaintext);

  const filename = `aymanediary-export-${new Date()
    .toISOString()
    .slice(0, 10)}.enc`;
  res.set({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": encrypted.length,
  });
  res.send(encrypted);
}

// For the Settings page "Download now" button - your login session is
// already proof of who you are, so it shouldn't need the export token too.
// The token stays reserved for scripts that don't have a login session.
router.get(
  "/mine",
  auth,
  asyncMiddleware(async (req, res) => {
    const user = await User.findById(req.user._id);
    await sendExport(user, res);
  })
);

// For scripts: authenticated by the standalone export token instead of a
// login session, so a periodic backup job never needs real credentials.
router.get(
  "/",
  exportAuth,
  asyncMiddleware(async (req, res) => {
    await sendExport(req.exportUser, res);
  })
);

module.exports = router;
