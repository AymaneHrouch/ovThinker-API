const express = require("express");
const router = express.Router();
const { find } = require("lodash");
const { User } = require("../models/user");
const { Journal, journalSchema } = require("../models/journal");
const auth = require("../middleware/auth");
const _ = require("lodash");

router.get("/", auth, async (req, res) => {
  let journals = await Journal.find({ user: req.user._id });
  res.send(journals);
});

router.get("/:id", auth, async (req, res) => {
  if (req.params.id === "locked") {
    let journals = await Journal.find({ locked: true, user: req.user._id });
    return res.send(journals);
  }
  await Journal.findOne(
    {
      _id: req.params.id,
      user: req.user._id,
    },
    function (err, doc) {
      if (err) return res.status(404).send("not found");
      if (doc) res.send(doc);
    }
  );
});

router.post("/", auth, async (req, res) => {
  try {
    let journal = new Journal({
      user: req.user._id,
      ..._.pick(req.body, [
        "comment",
        "date",
        "starred",
        "locked",
        "unlockDate",
      ]),
    });

    await journal.save();
    res.send(journal);
  } catch (ex) {
    const obj = ex.errors;
    res.status(400).send(obj[Object.keys(obj)[0]].message);
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    let journal = await Journal.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
      },
      _.pick(req.body, ["comment", "date", "starred", "locked", "unlockDate"]),
      { new: true }
    );
    res.send(journal);
  } catch (ex) {
    res.status(400).send("Entry with given ID not found.");
  }
});

router.delete("/:id", auth, async (req, res) => {
  let journal = await Journal.findOneAndRemove(
    { _id: req.params.id, user: req.user._id },
    function (err, doc) {
      if (err) res.status(404).send("entry with given id not found");
      if (doc) res.send(doc);
    }
  );
});

module.exports = router;
