const { User, validate } = require("../models/user");
const express = require("express");
const router = express.Router();
const _ = require("lodash");
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const Joi = require("joi");

router.get("/", [auth, admin], async (req, res) => {
  let users = await User.find();
  res.send(users);
});

router.get("/:id", auth, async (req, res) => {
  let user = await User.findById(req.params.id).select("-password -isAdmin");
  res.send(user);
});

router.post("/", async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  let user = await User.findOne({ email: req.body.email });
  if (user) return res.status(400).send("User already registered.");

  user = new User(_.pick(req.body, ["name", "email", "password"]));
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  await user.save();

  res.send(user);
});

router.put("/changepassword", auth, async (req, res) => {
  const user = await User.findById(req.user._id);

  const oldPassword = await bcrypt.compare(req.body.oldPassword, user.password);
  if (!oldPassword) return res.status(400).send("Invalid password.");

  if (req.user._id === "6025d7a61adafc001705d0c6")
    return res.status(400).send("Yo! Chill Satan. This isn't your account. Nice try tho ;)");

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(req.body.newPassword, salt);

  schema = {
    oldPassword: Joi.string().required().label("Old password"),
    newPassword: Joi.string().min(5).required().label("New password"),
  };

  const { error } = Joi.validate(req.body, schema);
  if (error) return res.status(400).send(error.details[0].message);

  await user.save();
  res.send(user);
});

router.put("/changename", auth, async (req, res) => {
  const user = await User.findById(req.user._id);
  user.name = req.body.name;
  const token = user.genAuthToken();
  res.header("x-auth-token", token);
  await user.save();
  res.send(user);
});

module.exports = router;
