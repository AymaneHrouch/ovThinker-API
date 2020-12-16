const { User, validate } = require("../models/user");
const express = require("express");
const router = express.Router();
const _ = require("lodash");
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

router.get('/', [auth, admin], async (req, res) => {
    let users = await User.find();
    res.send(users);
})

router.get('/:id', auth, async (req, res) => {
    let user = await User.findById(req.params.id).select('-password -isAdmin')
    res.send(user)
})

router.post('/', async (req, res) => {
    const { error } = validate(req.body)
    if(error) return res.status(400).send(error.details[0].message)
    
    let user = await User.findOne({ email: req.body.email });
    if (user) return res.status(400).send('User already registered.')

    user = new User(_.pick(req.body, ['name', 'email', 'password']))
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    await user.save();

    res.send(user)
})

module.exports = router;