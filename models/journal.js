const mongoose = require("mongoose");

const journalSchema = new mongoose.Schema({
    comment: String,
    date: Date
})

const Journal = mongoose.model('Journal', journalSchema);


exports.Journal = Journal;
exports.journalSchema = journalSchema;