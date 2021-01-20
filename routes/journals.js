const express = require("express");
const router = express.Router();
const { Journal } = require("../models/journal");
const auth = require("../middleware/auth");
const _ = require("lodash");
const { Types } = require("mongoose");

process.env.TZ = 'UTC';

router.get("/", auth, async (req, res) => {
  let { pageNumber, pageSize, year, month, day } = req.query;
  pageNumber = parseInt(pageNumber);
  pageSize = parseInt(pageSize);
  year = parseInt(year);
  month = parseInt(month);
  day = parseInt(day);

  if (year) {
    if (day) {
      const start = new Date(year, month, day);
      const end = new Date(year, month, day + 1);

      let journals = await Journal.find({
        user: req.user._id,
        date: { $gte: start, $lt: end },
        locked: false,
      })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .sort("-date");

      return res.send(journals);
    }
    if (month !== null) {
      const start = new Date(year, month);
      const end = new Date(year, month + 1);
      let journals = await Journal.find({
        user: req.user._id,
        date: { $gte: start, $lt: end },
        locked: false,
      })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .sort("-date");

      return res.send(journals);
    }
  } else {
    let journals = await Journal.find({ user: req.user._id, locked: false })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .sort("-date");

    return res.send(journals);
  }
});

router.get("/:id", auth, async (req, res) => {
  let { pageNumber, pageSize } = req.query;
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
        .sort("-date")
        .select("date unlockDate");
      return res.send(journals);
    } catch (ex) {
      return res.status(404).send("Journal collection is empty.");
    }
  }

  if (req.params.id === "starred") {
    try {
      let journals = await Journal.find({ starred: true, locked: false, user: req.user._id })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .sort("-date");
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

    res.send(journal);
  } catch (ex) {
    winston.error(ex);
  }
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
  await Journal.findOneAndRemove(
    { _id: req.params.id, user: req.user._id },
    function (err, doc) {
      if (err) res.status(404).send("entry with given id not found");
      if (doc) res.send(doc);
    }
  );
});

module.exports = router;
