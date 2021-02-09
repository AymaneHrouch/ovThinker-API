const express = require("express");
const helmet = require("helmet");
const users = require("../routes/users");
const journals = require("../routes/journals");
const auth = require("../routes/auth");
const error = require("../middleware/error");

module.exports = function (app) {
  app.use(helmet());
  app.use(express.json());
  app.use("/api/users", users);
  app.use("/api/auth", auth);
  app.use("/api/journals", journals);
  app.use(error);
};
