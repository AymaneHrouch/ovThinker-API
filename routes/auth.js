const bcrypt = require("bcrypt");
const Joi = require("joi");
const express = require("express")
const router = express.Router();
const { User } = require("../models/user");

router.post('/', async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message)

    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).send('Invalid email or password.');

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if(!validPassword) return res.status(400).send('Invalid email or password.');

    const token = user.genAuthToken();
    res.header('x-auth-token', token).send(user.name + " logged in")
})

function validate(req) {
    schema = {
        email: Joi.string().min(5).max(255).required().email(),
        password: Joi.string()
    }
    return(Joi.validate(req, schema))
}










module.exports = router;