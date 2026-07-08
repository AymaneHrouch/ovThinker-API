const express = require("express");
const router = express.Router();

const startTime = Date.now();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

module.exports = router;
