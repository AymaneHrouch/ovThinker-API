const mongoose = require("mongoose");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const config = require("config");

function validateUser(user) {
    schema = {
        name: Joi.string().min(2).max(30).required(),
        email: Joi.string().min(5).max(255).required().email(),
        password: Joi.string(),
        isAdmin: Joi.boolean()
    }
    return(Joi.validate(user, schema))
}

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        minlength: 2,
        maxlength: 30,
        required: true
    },
    email: {
        type: String,
        minlength: 5,
        maxlength: 255,
        required: true
    },
    password: {
        type: String
    },
    isAdmin: {
        type: Boolean,
        default: false
    }
})

userSchema.methods.genAuthToken = function() {
    return jwt.sign({ _id: this._id, isAdmin: this.isAdmin }, config.get("jwtPrivateKey"))
}

const User = mongoose.model('User', userSchema);

exports.User = User;
exports.validate = validateUser;