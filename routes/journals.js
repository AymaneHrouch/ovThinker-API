const express = require("express");
const router = express.Router();
const { find } = require("lodash");
const { User } = require("../models/user");
const { Journal } = require("../models/journal")
const auth = require("../middleware/auth");

router.get('/', auth, async (req, res) => {
    let user = await User.findOne({ _id: req.user._id });
    res.send(user.data);
})

router.post('/', auth, async(req, res) => {
    let user = await User.findOne({ _id: req.user._id });
    let journal = new Journal({
        comment: req.body.str,
        date: Date.now()
    })
    user.data.push(journal);
    await user.save();
    res.send(user)
})

router.delete('/:id', auth, async(req, res) => {
    let user =  await User.findByIdAndUpdate(req.user._id, {
        $pull: {
            data: { _id: req.params.id }
        }
    }, { new: true })
    res.send(user.data)
})

router.put('/:id', auth, async (req, res) => {
    const query = { _id: req.user._id };
    const updateDocument = { $set: { "data.$[element].comment": req.body.str } };
    const options = { arrayFilters: [ { "element._id": req.params.id } ] } 

    let user = await User.update(query, updateDocument, options)
    res.send(user)
})

module.exports = router;