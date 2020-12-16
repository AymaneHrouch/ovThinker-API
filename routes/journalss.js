const express = require("express");
const router = express.Router();
const { find } = require("lodash");
const { User } = require("../models/user");
const { Journal } = require("../models/journal");
const auth = require("../middleware/auth");
const { Types } = require("mongoose");

router.get("/", auth, async (req, res) => {
  let journals = await User.findOne({ _id: req.user._id }, { data: 1, _id: 0 });
  res.send(journals.data);
});

router.get("/:id", auth, async (req, res) => {
  if (req.params.id === "locked") {
    let journals = await User.find(
      {
        _id: req.user._id,
        data: { $elemMatch: { locked: true } },
      },
      { "data": 1 }
    );
    return res.send(journals);
  }

  try {
    let journal = await User.findOne(
      {
        _id: new Types.ObjectId(req.user._id),
        "data._id": new Types.ObjectId(req.params.id),
      },
      { "data.$": 1, _id: 0 }
    );
    res.send(journal.data[0]);
  } catch (ex) {
    console.log(ex);
    res.status(404).send("oops");
  }
});

router.post("/", auth, async (req, res) => {
  let user = await User.findOne({ _id: req.user._id });
  let journal = new Journal({
    comment: req.body.str,
    date: Date.now(),
  });
  user.data.push(journal);
  await user.save();
  res.send(user);
});

router.delete("/:id", auth, async (req, res) => {
  let user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $pull: {
        data: { _id: req.params.id },
      },
    },
    { new: true }
  );
  res.send(user.data);
});

router.put("/:id", auth, async (req, res) => {
  const query = { _id: req.user._id };
  const updateDocument = { $set: { "data.$[element].comment": req.body.str } };
  const options = { arrayFilters: [{ "element._id": req.params.id }] };

  let user = await User.update(query, updateDocument, options);
  res.send(user);
});

module.exports = router;
