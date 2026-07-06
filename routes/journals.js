const express = require("express");
const router = express.Router();
const { Journal } = require("../models/journal");
const auth = require("../middleware/auth");
const _ = require("lodash");
const { Types } = require("mongoose");
const winston = require("winston");

router.get("/", auth, async (req, res) => {
  let { pageNumber, pageSize, start, end, sort } = req.query;
  const sorting = sort === "asc" ? "date" : "-date";
  pageNumber = parseInt(pageNumber);
  pageSize = parseInt(pageSize);

  if (start) {
    let journals = await Journal.find({
      user: req.user._id,
      date: { $gte: start, $lt: end },
      locked: false,
    })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .sort(sorting);

    return res.send(journals);
  } else {
    let journals = await Journal.find({ user: req.user._id, locked: false })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .sort(sorting);

    return res.send(journals);
  }
});

router.get("/backup", auth, async (req, res) => {
  const journals = await Journal.find({
    user: req.user._id
  })
  return res.send(journals);
})

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
      return res.send(journals);
    } catch (ex) {
      return res.status(404).send("Journal collection is empty.");
    }
  }

  if (req.params.id === "search") {
    if (!req.query.term)
      return res.status(400).send("Search term is not allowed to be empty.");

    const escapedTerm = req.query.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const query = {
      comment: { $regex: escapedTerm, $options: "i" },
      locked: false,
      user: req.user._id,
    };

    const [journals, total] = await Promise.all([
      Journal.find(query)
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .sort(sorting),
      Journal.countDocuments(query),
    ]);

    return res.send({ total, journals });
  }

  if (req.params.id === "stats") {
    const journals = await Journal.find(
      { user: req.user._id, locked: false },
      "date comment starred"
    );

    const totalEntries = journals.length;
    const starredCount = journals.filter(j => j.starred).length;

    const weekdayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const weekdayCounts = new Array(7).fill(0);

    let totalWords = 0;
    let longestEntry = null;
    let firstEntryDate = null;

    for (const j of journals) {
      const words = j.comment
        .replace(/\n/g, " ")
        .split(" ")
        .filter(w => w !== "").length;

      totalWords += words;

      if (!longestEntry || words > longestEntry.words)
        longestEntry = { id: j._id, date: j.date, words };

      if (!firstEntryDate || j.date < firstEntryDate) firstEntryDate = j.date;

      weekdayCounts[j.date.getUTCDay()]++;
    }

    const averageWords = totalEntries
      ? Math.round(totalWords / totalEntries)
      : 0;

    const maxWeekdayCount = Math.max(0, ...weekdayCounts);
    const mostActiveWeekday = maxWeekdayCount
      ? weekdayNames[weekdayCounts.indexOf(maxWeekdayCount)]
      : null;

    const dayKeys = [
      ...new Set(journals.map(j => j.date.toISOString().slice(0, 10))),
    ].sort();

    const dayMs = 24 * 60 * 60 * 1000;
    let longestStreak = 0;
    let run = 0;
    for (let i = 0; i < dayKeys.length; i++) {
      if (
        i === 0 ||
        (Date.parse(dayKeys[i]) - Date.parse(dayKeys[i - 1])) / dayMs === 1
      )
        run++;
      else run = 1;
      longestStreak = Math.max(longestStreak, run);
    }

    let currentStreak = 0;
    if (dayKeys.length) {
      const todayKey = new Date().toISOString().slice(0, 10);
      const yesterdayKey = new Date(Date.now() - dayMs)
        .toISOString()
        .slice(0, 10);
      const lastDay = dayKeys[dayKeys.length - 1];
      if (lastDay === todayKey || lastDay === yesterdayKey) {
        currentStreak = 1;
        for (let i = dayKeys.length - 1; i > 0; i--) {
          const diff =
            (Date.parse(dayKeys[i]) - Date.parse(dayKeys[i - 1])) / dayMs;
          if (diff === 1) currentStreak++;
          else break;
        }
      }
    }

    return res.send({
      totalEntries,
      starredCount,
      totalWords,
      averageWords,
      currentStreak,
      longestStreak,
      firstEntryDate,
      mostActiveWeekday,
      longestEntry,
    });
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
