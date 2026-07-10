const express = require("express");
const router = express.Router();
const { Journal } = require("../models/journal");
const auth = require("../middleware/auth");
const _ = require("lodash");
const { Types } = require("mongoose");
const winston = require("winston");
const { extractTags, sanitizeTags } = require("../utils/extractTags");

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

  if (req.params.id === "tags") {
    const tags = await Journal.aggregate([
      { $match: { user: new Types.ObjectId(req.user._id), locked: false } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);
    return res.send(tags.map(t => ({ tag: t._id, count: t.count })));
  }

  if (req.params.id === "tag") {
    if (!req.query.tag)
      return res.status(400).send("Tag is not allowed to be empty.");

    const tag = req.query.tag.toLowerCase();
    const query = { tags: tag, locked: false, user: req.user._id };

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
    const [journals, lockedCount] = await Promise.all([
      Journal.find(
        { user: req.user._id, locked: false },
        "date comment starred"
      ),
      Journal.countDocuments({ user: req.user._id, locked: true }),
    ]);

    const totalEntries = journals.length;
    const starredCount = journals.filter(j => j.starred).length;
    const starredPercent = totalEntries
      ? Math.round((starredCount / totalEntries) * 100)
      : 0;

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
    const monthCounts = {};
    const yearCounts = {};
    const timeOfDayCounts = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();

    let totalWords = 0;
    let longestEntry = null;
    let firstEntryDate = null;
    let entriesThisMonth = 0;
    let entriesThisYear = 0;

    for (const j of journals) {
      const words = j.comment
        .replace(/\n/g, " ")
        .split(" ")
        .filter(w => w !== "").length;

      totalWords += words;

      if (!longestEntry || words > longestEntry.words)
        longestEntry = { id: j._id, date: j.date, words };

      if (!firstEntryDate || j.date < firstEntryDate) firstEntryDate = j.date;

      const year = j.date.getUTCFullYear();
      const month = j.date.getUTCMonth();
      const hour = j.date.getUTCHours();

      weekdayCounts[j.date.getUTCDay()]++;

      const monthKey = `${year}-${month}`;
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
      yearCounts[year] = (yearCounts[year] || 0) + 1;

      if (hour >= 5 && hour < 12) timeOfDayCounts.Morning++;
      else if (hour >= 12 && hour < 17) timeOfDayCounts.Afternoon++;
      else if (hour >= 17 && hour < 21) timeOfDayCounts.Evening++;
      else timeOfDayCounts.Night++;

      if (year === currentYear) {
        entriesThisYear++;
        if (month === currentMonth) entriesThisMonth++;
      }
    }

    const averageWords = totalEntries
      ? Math.round(totalWords / totalEntries)
      : 0;

    const maxWeekdayCount = Math.max(0, ...weekdayCounts);
    const mostActiveWeekday = maxWeekdayCount
      ? weekdayNames[weekdayCounts.indexOf(maxWeekdayCount)]
      : null;

    const minWeekdayCount = totalEntries ? Math.min(...weekdayCounts) : 0;
    const leastActiveWeekday = totalEntries
      ? weekdayNames[weekdayCounts.indexOf(minWeekdayCount)]
      : null;

    const entriesPerYear = Object.entries(yearCounts)
      .map(([year, count]) => ({ year: Number(year), count }))
      .sort((a, b) => a.year - b.year);

    const timeOfDayEntries = Object.entries(timeOfDayCounts);
    const maxTimeOfDayCount = Math.max(0, ...timeOfDayEntries.map(([, c]) => c));
    const mostActiveTimeOfDay = maxTimeOfDayCount
      ? timeOfDayEntries.find(([, c]) => c === maxTimeOfDayCount)[0]
      : null;

    let busiestMonth = null;
    for (const [key, count] of Object.entries(monthCounts)) {
      if (!busiestMonth || count > busiestMonth.count) {
        const [year, month] = key.split("-").map(Number);
        busiestMonth = { year, month, count };
      }
    }

    const dayKeys = [
      ...new Set(journals.map(j => j.date.toISOString().slice(0, 10))),
    ].sort();

    const dayMs = 24 * 60 * 60 * 1000;
    let longestStreak = 0;
    let longestStreakStart = null;
    let longestStreakEnd = null;
    let longestGapDays = 0;
    let longestGapStart = null;
    let longestGapEnd = null;
    let run = 0;
    let runStart = null;
    for (let i = 0; i < dayKeys.length; i++) {
      if (i === 0) {
        run = 1;
        runStart = dayKeys[0];
      } else {
        const diff =
          (Date.parse(dayKeys[i]) - Date.parse(dayKeys[i - 1])) / dayMs;
        if (diff === 1) run++;
        else {
          run = 1;
          runStart = dayKeys[i];
          const gap = diff - 1;
          if (gap > longestGapDays) {
            longestGapDays = gap;
            longestGapStart = dayKeys[i - 1];
            longestGapEnd = dayKeys[i];
          }
        }
      }
      if (run > longestStreak) {
        longestStreak = run;
        longestStreakStart = runStart;
        longestStreakEnd = dayKeys[i];
      }
    }

    let currentStreak = 0;
    if (dayKeys.length) {
      const todayKey = now.toISOString().slice(0, 10);
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

    let consistencyRate = 0;
    let daysSinceFirstEntry = 0;
    if (dayKeys.length) {
      const todayKey = now.toISOString().slice(0, 10);
      daysSinceFirstEntry =
        Math.floor((Date.parse(todayKey) - Date.parse(dayKeys[0])) / dayMs) +
        1;
      consistencyRate = Math.round(
        (dayKeys.length / daysSinceFirstEntry) * 100
      );
    }

    const avgEntriesPerWeek = daysSinceFirstEntry
      ? Math.round((totalEntries / (daysSinceFirstEntry / 7)) * 10) / 10
      : 0;

    return res.send({
      totalEntries,
      starredCount,
      starredPercent,
      lockedCount,
      totalWords,
      averageWords,
      currentStreak,
      longestStreak,
      longestStreakStart,
      longestStreakEnd,
      longestGapDays,
      longestGapStart,
      longestGapEnd,
      firstEntryDate,
      daysSinceFirstEntry,
      mostActiveWeekday,
      leastActiveWeekday,
      mostActiveTimeOfDay,
      longestEntry,
      entriesThisMonth,
      entriesThisYear,
      entriesPerYear,
      busiestMonth,
      consistencyRate,
      avgEntriesPerWeek,
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

    journal.tags = [
      ...new Set([
        ...extractTags(journal.comment),
        ...sanitizeTags(Array.isArray(req.body.tags) ? req.body.tags : []),
      ]),
    ];

    await journal.save();
    res.send(journal);
  } catch (ex) {
    const obj = ex.errors;
    res.status(400).send(obj[Object.keys(obj)[0]].message);
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const update = _.pick(req.body, [
      "comment",
      "date",
      "starred",
      "locked",
      "unlockDate",
    ]);
    if (update.comment !== undefined) {
      update.tags = [
        ...new Set([
          ...extractTags(update.comment),
          ...sanitizeTags(Array.isArray(req.body.tags) ? req.body.tags : []),
        ]),
      ];
    }

    let journal = await Journal.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
      },
      update,
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
