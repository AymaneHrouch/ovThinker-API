const express = require("express");
const router = express.Router();
const { Journal } = require("../models/journal");
const auth = require("../middleware/auth");
const _ = require("lodash");
const { Types } = require("mongoose");
const winston = require("winston");
const Cryptr = require("cryptr");
const config = require("config");
const cryptr = new Cryptr(config.get("cryptrKey"));

const decryptJournals = journals =>
  journals.map(j => ({
    comment: cryptr.decrypt(j.comment),
    ..._.pick(j, ["date", "starred", "locked", "unlockDate", "_id"]),
  }));

router.get("/", auth, async (req, res) => {
  let { pageNumber, pageSize, start, end, sort } = req.query;
  const sorting = sort === "asc" ? "date" : "-date";
  pageNumber = parseInt(pageNumber);
  pageSize = parseInt(pageSize);
  let journals;

  if (start) {
    journals = await Journal.find({
      user: req.user._id,
      date: { $gte: start, $lt: end },
      locked: false,
    })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .sort(sorting);
  } else {
    journals = await Journal.find({ user: req.user._id, locked: false })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .sort(sorting);
  }
  journals = decryptJournals(journals);
  return res.send(journals);
});

router.get("/:id", auth, async (req, res) => {
  let { pageNumber, pageSize, sort } = req.query;
  const sorting = sort === "asc" ? "date" : "-date";
  pageNumber = parseInt(pageNumber);
  pageSize = parseInt(pageSize);

  if (req.params.id === "random") {
    let journal = await Journal.aggregate([
      {
        $match: {
          user: new Types.ObjectId(req.user._id),
          locked: false,
        },
      },
      { $sample: { size: 1 } },
    ]);
    if (journal[0]) return res.send(journal[0]["_id"]);
    else return res.status(404).send("Journal collection is empty.");
  }

  if (req.params.id === "locked") {
    try {
      let journals = await Journal.find({ locked: true, user: req.user._id })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .sort(sorting)
        .select("date unlockDate");
      return res.send(journals);
    } catch (ex) {
      return res.status(404).send("Journal collection is empty.");
    }
  }

  if (req.params.id === "starred") {
    try {
      let journals = await Journal.find({
        starred: true,
        locked: false,
        user: req.user._id,
      })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .sort(sorting);

      journals = decryptJournals(journals);
      return res.send(journals);
    } catch (ex) {
      return res.status(404).send("Journal collection is empty.");
    }
  }

  try {
    let journal = await Journal.findOne({
      _id: req.params.id,
      user: req.user._id,
      locked: false,
    });

    journal = {
      comment: cryptr.decrypt(journal.comment),
      ..._.pick(journal, ["date", "starred", "locked", "unlockDate", "_id"]),
    };

    res.send(journal);
  } catch (ex) {
    winston.error(ex);
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const comment = cryptr.encrypt(req.body.comment);
    let journal = new Journal({
      user: req.user._id,
      comment: comment,
      ..._.pick(req.body, ["date", "starred", "locked", "unlockDate"]),
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
    const comment = cryptr.encrypt(req.body.comment);
    let journal = await Journal.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
      },
      {
        comment: comment,
        ..._.pick(req.body, ["date", "starred", "locked", "unlockDate"]),
      },
      { new: true }
    );
    res.send(journal);
  } catch (ex) {
    res.status(400).send("Entry with given ID not found.");
  }
});

router.delete("/:id", auth, async (req, res) => {
  await Journal.findOneAndRemove(
    { _id: req.params.id, user: req.user._id },
    function (err, doc) {
      if (err) res.status(404).send("entry with given id not found");
      if (doc) res.send(doc);
    }
  );
});

module.exports = router;
