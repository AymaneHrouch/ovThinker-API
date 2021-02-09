const mongoose = require("mongoose");

const journalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  comment: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true,
  },
  starred: {
    type: Boolean,
    default: false,
  },
  locked: {
    type: Boolean,
    default: false,
  },
  unlockDate: {
    type: Date,
    required: function () {
      return this.locked;
    },
  },
});

const Journal = mongoose.model("Journal", journalSchema);

exports.Journal = Journal;
exports.journalSchema = journalSchema;
