const express = require("express");
const app = express();

require("./startup/logging")();
require("./startup/routes")(app);
require("./startup/db")();
require("./startup/logging")();
require("./startup/config")();
require("./middleware/ok")(app);

const port = process.env.PORT || 3000;
app.listen(port);
