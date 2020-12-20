const express = require("express");
const app = express();
var cors = require("cors");
app.use(cors())

require("./startup/logging")();
require("./startup/routes")(app);
require("./startup/db")();
require("./startup/logging")();
require("./startup/config")();
require("./startup/prod")(app)
require("./middleware/ok")(app);


app.listen(3900);
